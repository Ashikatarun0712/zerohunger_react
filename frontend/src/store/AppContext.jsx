/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

  const updateApp = (updates) => {
    setAppState((prev) => ({ ...prev, ...updates }));
  };

  const syncDatabase = async () => {
    try {
      const [donRes, reqRes, volRes, ratRes, trustRes, fundRes, msgRes, statRes, notifRes, massRes] = await Promise.all([
        supabaseClient.from('donations').select('*'),
        supabaseClient.from('requests').select('*'),
        supabaseClient.from('volunteers').select('*'),
        supabaseClient.from('ratings').select('*'),
        supabaseClient.from('trusts').select('*'),
        supabaseClient.from('fund_requests').select('*'),
        supabaseClient.from('messages').select('*'),
        supabaseClient.from('platform_stats').select('*').single(),
        supabaseClient.from('notifications').select('*'),
        supabaseClient.from('mass_donations').select('*')
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

      setDb(prev => ({
        ...prev,
        donations: newDonations,
        requests: reqRes.data || [],
        volunteers: volRes.data || [],
        ratings: ratRes.data || [],
        trusts: trustRes.data || [],
        fund_requests: fundRes.data || [],
        messages: msgRes.data || [],
        platform_stats: statRes?.data || null,
        notifications: notifRes.data || [],
        mass_donations: massRes?.data || []
      }));
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
