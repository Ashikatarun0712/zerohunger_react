/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { playNotificationSound } from '../utils/audio';

const SUPABASE_URL = 'https://gyfubwmalzsjtbmlyhgl.supabase.co';
// Using the publishable key. Since RLS is disabled in Supabase, this will work perfectly.
const SUPABASE_KEY = 'sb_publishable_X0UNvNRQfFStItXbSNlgbw_E_nT_cMC';
export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const AppContext = createContext();

const DB_VERSION = 'v4';

const initialDB = {
  donations: [],
  requests: [],
  volunteers: [],
  ratings: [],
  notifications: [],
  trusts: [],
  fund_requests: [],
  messages: [],
  platform_stats: null,
  mass_donations: [],
  users: [],
  nid: { don: 1, req: 1, vol: 1, notif: 1, fund: 1, msg: 1 }
};

const initialAPP = {
  role: null,
  user: null,
  name: null,
  slot: null,
  maps: {},
  charts: {},
  userLat: null,
  userLng: null,
  userAccuracy: null,
  userAddress: null,
  geoWatchId: null,
  prevPage: 'profile',
  routeLines: [],
  parkingState: null,
  selectedParkSlot: null,
  mobileNetModel: null,
  mobileNetLoading: false,
  theme: 'light'
};

export const AppProvider = ({ children }) => {
  const [db, setDb] = useState(() => {
    try {
      if (sessionStorage.getItem('zh_db_version') !== DB_VERSION) {
        sessionStorage.removeItem('zh_db');
        sessionStorage.setItem('zh_db_version', DB_VERSION);
      }
      const d = sessionStorage.getItem('zh_db');
      return d ? JSON.parse(d) : initialDB;
    } catch {
      return initialDB;
    }
  });

  const [appState, setAppState] = useState(initialAPP);

  const [registry, setRegistry] = useState(() => {
    try {
      const d = localStorage.getItem('zh_registry');
      return d ? JSON.parse(d) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    sessionStorage.setItem('zh_db', JSON.stringify(db));
  }, [db]);

  useEffect(() => {
    localStorage.setItem('zh_registry', JSON.stringify(registry));
  }, [registry]);

  // Apply Theme
  useEffect(() => {
    let activeTheme = appState.theme;
    if (activeTheme === 'system') {
      activeTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [appState.theme]);

  // Auto sync database and run cron on startup
  useEffect(() => {
    const runSystemCron = async () => {
      try {
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        
        // 1. Expire regular donations
        const { data: donations } = await supabaseClient.from('donations').select('id, expiry_date').eq('status', 'available');
        if (donations) {
          const expiredDonations = donations.filter(d => d.expiry_date && d.expiry_date < todayStr);
          for (const item of expiredDonations) {
            await supabaseClient.from('donations').delete().eq('id', item.id);
          }
        }

        // 2. Expire mass donations (event_time has passed)
        // Note: checking 'active' status if present, but since we are deleting we can just select all
        const { data: massEvents } = await supabaseClient.from('mass_donations').select('id, event_time');
        if (massEvents) {
          const expiredEvents = massEvents.filter(e => e.event_time && new Date(e.event_time) < now);
          for (const item of expiredEvents) {
            await supabaseClient.from('mass_donations').delete().eq('id', item.id);
          }
        }
      } catch (err) {
        console.error("Cron failed (missing columns or connection issue):", err);
      }
    };

    runSystemCron().then(() => syncDatabase());
  }, []);

  const updateApp = (updates) => {
    setAppState((prev) => ({ ...prev, ...updates }));
  };

  const syncDatabase = async () => {
    try {
      const [donRes, reqRes, volRes, ratRes, trustRes, fundRes, msgRes, statRes, notifRes, massRes, userRes] = await Promise.all([
        supabaseClient.from('donations').select('*'),
        supabaseClient.from('requests').select('*'),
        supabaseClient.from('volunteers').select('*'),
        supabaseClient.from('ratings').select('*'),
        supabaseClient.from('trusts').select('*'),
        supabaseClient.from('fund_requests').select('*'),
        supabaseClient.from('messages').select('*'),
        supabaseClient.from('platform_stats').select('*').single(),
        supabaseClient.from('notifications').select('*'),
        supabaseClient.from('mass_donations').select('*'),
        supabaseClient.from('users').select('*')
      ]);

      if (donRes.error) console.error('donations fetch error:', donRes.error);
      if (reqRes.error) console.error('requests fetch error:', reqRes.error);
      
      const now = new Date();
      const newDonations = (donRes.data || []).map(d => {
        if (d.status === 'available' && new Date(d.expiry_date) < now) {
          return { ...d, status: 'expired' };
        }
        return d;
      });

      const fetchedTrusts = trustRes.data || [];
      const fetchedUsers = userRes.data || [];

      // Merge trust role user accounts into db.trusts if not already present
      const combinedTrusts = [...fetchedTrusts];
      fetchedUsers.filter(u => u.role === 'trust').forEach(u => {
        const exists = combinedTrusts.some(t => t.trust_username === u.username || t.trust_name === u.name);
        if (!exists) {
          combinedTrusts.push({
            id: `usr_${u.id}`,
            trust_username: u.username,
            trust_name: u.name || u.username,
            reg_number: `REG-${u.username.toUpperCase()}`,
            verification_status: 'pending',
            is_user_account: true
          });
        }
      });

      setDb(prev => {
        const fetchedMessages = msgRes.data || [];
        const fetchedNotifs = notifRes.data || [];
        
        // Notification Sound Logic
        if (appState.user) {
          const oldMyMsgs = prev.messages ? prev.messages.filter(m => m.receiver_username === appState.user).length : 0;
          const newMyMsgs = fetchedMessages.filter(m => m.receiver_username === appState.user).length;
          
          const oldMyNotifs = prev.notifications ? prev.notifications.filter(n => n.user_id === appState.user).length : 0;
          const newMyNotifs = fetchedNotifs.filter(n => n.user_id === appState.user).length;
          
          if (newMyMsgs > oldMyMsgs || newMyNotifs > oldMyNotifs) {
            playNotificationSound();
            if (window.showToast) {
              window.showToast('You have a new message or notification!', 'ok');
            }
          }
        }

        return {
          ...prev,
          donations: newDonations,
          requests: reqRes.data || [],
          volunteers: volRes.data || [],
          ratings: ratRes.data || [],
          trusts: combinedTrusts,
          fund_requests: fundRes.data || [],
          messages: fetchedMessages,
          platform_stats: statRes?.data || null,
          notifications: fetchedNotifs,
          mass_donations: massRes?.data || [],
          users: fetchedUsers
        };
      });
    } catch (e) {
      console.error('Sync error:', e);
    }
  };

  return (
    <AppContext.Provider value={{ db, setDb, appState, updateApp, registry, setRegistry, syncDatabase }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
