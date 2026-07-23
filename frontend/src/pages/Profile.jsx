import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import { useTranslation } from '../store/LanguageContext';
import LeafletMap from '../components/LeafletMap';

export default function Profile() {
  const { appState, db, updateApp, syncDatabase } = useAppContext();
  const navigate = useNavigate();
  const { t, lang, setLang } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Profile Update State
  const [editName, setEditName] = useState(appState.name || '');
  const [editEmoji, setEditEmoji] = useState(appState.emoji || '👤');
  const [editPush, setEditPush] = useState(appState.pushEnabled !== false);
  const [editTheme, setEditTheme] = useState(appState.theme || 'system');
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    updateApp({ user: null, role: null, name: null });
    navigate('/');
  };

  const handleSaveSettings = async () => {
    setIsUpdating(true);
    try {
      // Update in Supabase (MVP assume user is unique by username)
      if (appState.user) {
         await supabaseClient.from('users')
           .update({ name: editName, emoji: editEmoji })
           .eq('username', appState.user);
      }
      
      // Update local state
      updateApp({ name: editName, emoji: editEmoji, pushEnabled: editPush, theme: editTheme });
      await syncDatabase();
      setShowSettings(false);
    } catch (e) {
      console.error(e);
      alert('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUpdating(true);
    try {
      const fileName = `${appState.user}_${Date.now()}`;
      const { data, error } = await supabaseClient.storage.from('avatars').upload(fileName, file);
      if (error) throw error;
      
      const { data: publicUrlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = publicUrlData.publicUrl;

      if (appState.user) {
        await supabaseClient.from('users').update({ profile_image_url: publicUrl }).eq('username', appState.user);
      }
      updateApp({ profile_image_url: publicUrl });
      alert('Profile image updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to upload image.');
    } finally {
      setIsUpdating(false);
    }
  };

  const emoji = appState.emoji || '👤';

  // Calculate user stats
  const un = (appState.user || '').toLowerCase();
  const myDons = (db.donations || []).filter(d => (d.donor_name || '').toLowerCase() === un).length;
  const myReqs = (db.requests || []).filter(r => (r.req_name || '').toLowerCase() === un).length;
  const myNotifications = (db.notifications || []).filter(n => (n.user_username || '').toLowerCase() === un).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadCount = myNotifications.filter(n => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      const unreadIds = myNotifications.filter(n => !n.is_read).map(n => n.id);
      if (unreadIds.length > 0) {
        await supabaseClient.from('notifications').update({ is_read: true }).in('id', unreadIds);
        await syncDatabase();
      }
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="page active">
      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-bg">
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <div className="modal-head">
              <div className="modal-title">⚙️ {t('settings')}</div>
              <button className="x-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            
            <div className="fg">
              <label>{t('language')}</label>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">🇺🇸 English</option>
                <option value="es">🇪🇸 Español (Spanish)</option>
                <option value="fr">🇫🇷 Français (French)</option>
                <option value="hi">🇮🇳 हिन्दी (Hindi)</option>
                <option value="ta">🇮🇳 தமிழ் (Tamil)</option>
              </select>
            </div>

            <div className="fg">
              <label>Profile Theme</label>
              <select value={editTheme} onChange={(e) => setEditTheme(e.target.value)}>
                <option value="system">💻 System Preference</option>
                <option value="light">🟢 Light Emerald</option>
                <option value="dark">🌙 Dark Mode</option>
              </select>
            </div>
            
            <div className="fg">
              <label>Push Notifications</label>
              <select value={editPush ? 'enabled' : 'disabled'} onChange={e => setEditPush(e.target.value === 'enabled')}>
                <option value="enabled">Enabled (Real-time)</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            
            <div className="fg">
              <label>P2P Privacy</label>
              <select>
                <option>Show exact location to matches</option>
                <option>Show approximate location only</option>
              </select>
            </div>

            <div style={{ margin: '20px 0', borderBottom: '1px solid var(--border)' }}></div>
            
            <div className="modal-title" style={{ marginBottom: '12px', fontSize: '1rem' }}>{t('profile')} Update</div>

            <div className="fg">
              <label>Display Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            
            <div className="fg">
              <label>Avatar Emoji</label>
              <input type="text" value={editEmoji} onChange={e => setEditEmoji(e.target.value)} maxLength={2} />
            </div>
            
            <button className="btn btn-primary btn-full" onClick={handleSaveSettings} disabled={isUpdating} style={{ marginTop: '16px' }}>
              {isUpdating ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* 1. Global Navbar restored with Settings & Logout */}
      <div className="navbar">
        <div className="nav-brand">
          <div className="nav-dot"></div> Zero Hunger P2P
        </div>
        <div className="nav-right">
          <div className="nav-user">{emoji} {appState.user || 'User'}</div>
          <div className="notif-badge" onClick={() => setShowNotifications(!showNotifications)} style={{ cursor: 'pointer' }}>
            {appState.pushEnabled === false ? '🔕' : unreadCount}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} style={{ padding: '6px 12px' }}>⚙️ {t('settings')}</button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ padding: '6px 12px', background: 'var(--r1)', borderColor: 'var(--r1)' }}>🚪 {t('logout')}</button>
        </div>
      </div>

      {showNotifications && appState.pushEnabled !== false && (
        <div className="notif-dropdown" style={{ position: 'absolute', top: '70px', right: '20px', width: '340px', background: 'var(--card)', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', zIndex: 1000, overflow: 'hidden', border: '1px solid var(--border)', animation: 'popIn 0.2s ease' }}>
          <div style={{ padding: '14px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔔 Notifications {unreadCount > 0 && <span className="badge bg-r" style={{ fontSize: '0.7rem' }}>{unreadCount} New</span>}
            </h4>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={handleMarkAllRead} style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--p1)' }}>Mark all read</button>
            )}
          </div>
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {myNotifications.length === 0 ? (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--txt1)', fontSize: '0.9rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px', opacity: 0.5 }}>📭</div>
                You're all caught up!
              </div>
            ) : (
              myNotifications.map(n => (
                <div key={n.id} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: n.is_read ? 'transparent' : 'rgba(59, 130, 246, 0.05)', transition: 'background 0.2s' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--txt)', fontWeight: n.is_read ? 'normal' : '600', lineHeight: '1.4' }}>{n.message}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--txt1)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                     {new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                     {n.urgency === 'High' && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ High Priority</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. Profile Top with tags */}
      <div className="prof-top">
        <div className="prof-avatar-wrap" style={{ position: 'relative' }}>
          {appState.profile_image_url ? (
            <img src={appState.profile_image_url} alt="Profile" className="prof-avatar-big" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="prof-avatar-big">{emoji}</div>
          )}
          <label className="prof-avatar-overlay" style={{ cursor: 'pointer' }}>
            {isUpdating ? '⏳' : '📷'}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={isUpdating} />
          </label>
        </div>
        <div className="prof-name">{appState.name || 'User'}</div>
        <div style={{ fontSize: '.85rem', opacity: .8, marginTop: '4px' }}>
          {appState.role === 'admin' ? 'System Administrator' : appState.role === 'trust' ? 'Trust/NGO' : 'Community Member'}
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span className="badge bg-g">{appState.role || 'user'}</span>
          <span className="badge bg-t">📅 20/7/2026</span>
          <span className="badge bg-b">✉️ {appState.user}@gmail.com</span>
        </div>
      </div>
      
      <div className="dash-wrap">
        {/* 3. Stats Grid with 4th card */}
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-num">{myDons}</div><div className="stat-lbl">Donations</div></div>
          <div className="stat-card"><div className="stat-num">{myReqs}</div><div className="stat-lbl">Requests</div></div>
          <div className="stat-card"><div className="stat-num">7</div><div className="stat-lbl">Volunteers</div></div>
          <div className="stat-card"><div className="stat-num">91%</div><div className="stat-lbl">AI Score</div></div>
        </div>
        
        {/* 4. AI Cert with missing metrics */}
        <div className="profile-ai-cert">
          <div className="cert-header">
            <div className="cert-title">🏅 ZeroHungerVision AI System Status</div>
            <div className="cert-live-badge"><div className="cert-live-dot"></div>LIVE</div>
          </div>
          <div className="cert-metrics" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="cert-metric"><div className="cert-metric-val">17</div><div className="cert-metric-lbl">Donations</div></div>
            <div className="cert-metric"><div className="cert-metric-val">7.4</div><div className="cert-metric-lbl">Avg Freshness</div></div>
            <div className="cert-metric"><div className="cert-metric-val">91%</div><div className="cert-metric-lbl">AI Accuracy</div></div>
            <div className="cert-metric"><div className="cert-metric-val">447</div><div className="cert-metric-lbl">Meals Saved</div></div>
            <div className="cert-metric"><div className="cert-metric-val" style={{ color: '#ef4444' }}>2</div><div className="cert-metric-lbl">Food Wasted 🗑️</div></div>
          </div>
          <div className="cert-footer">
            <div className="cert-seal">✅</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '.8rem', marginBottom: '2px' }}>TensorFlow.js MobileNet · ZeroHungerVision-v2 · AI Safety Certified</div>
              <div style={{ opacity: .65, fontSize: '.72rem' }}>CNN freshness classification (Fresh/Medium/Spoiled) · Real-time P2P proximity matching</div>
            </div>
          </div>
        </div>

        {/* 5. Trust Score Component */}
        <div className="trust-new-card">
          <div className="trust-new-inner">
            <div className="trust-new-icon">🏅</div>
            <div className="trust-new-body">
              <div className="trust-new-title">Your Community Trust Score</div>
              <div className="trust-new-sub">Build your reputation by donating food, completing deliveries, and receiving community ratings.</div>
              <div className="trust-new-steps">
                <span className="trust-step-chip">🎁 Donate Food</span>
                <span className="trust-step-chip">🚗 Complete Delivery</span>
                <span className="trust-step-chip">⭐ Get Rated</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, opacity: .6, marginBottom: '2px' }}>NOT YET RATED</div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.8rem', fontWeight: 800, color: 'var(--g1)' }}>--/100</div>
            </div>
          </div>
        </div>

        {/* 6. History Navigation Cards */}
        <div className="history-metrics-container">
          <div className="history-metric-btn don-btn" onClick={() => navigate('/activity')}>
            <div className="hm-glow"></div>
            <div className="hm-inner">
              <div className="hm-icon">📜</div>
              <div style={{ textAlign: 'left' }}>
                <div className="hm-title">MY DONATIONS</div>
                <div className="hm-count">{myDons}</div>
                <div className="hm-sub">View detailed history ↗</div>
              </div>
            </div>
          </div>
          <div className="history-metric-btn req-btn" onClick={() => navigate('/activity')}>
            <div className="hm-glow"></div>
            <div className="hm-inner">
              <div className="hm-icon">📥</div>
              <div style={{ textAlign: 'left' }}>
                <div className="hm-title">MY REQUESTS</div>
                <div className="hm-count">{myReqs}</div>
                <div className="hm-sub">View received items ↗</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="module-grid">
          <div className="mod-card module-card" onClick={() => navigate('/donor')}>
            <div className="mod-icon" style={{ background: '#dbeafe', color: '#2563eb' }}>🎁</div>
            <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px' }}>Donor Module</div>
            <div className="mod-desc">Donate food with TensorFlow MobileNet freshness scan & expiry prediction.</div>
          </div>
          <div className="mod-card module-card" onClick={() => navigate('/request')}>
            <div className="mod-icon" style={{ background: '#fef3c7', color: '#d97706' }}>📦</div>
            <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px' }}>Receiver Module (P2P)</div>
            <div className="mod-desc">Request fresh food with AI proximity matching & community fridge.</div>
          </div>
          <div className="mod-card module-card" onClick={() => navigate('/volunteer')}>
            <div className="mod-icon" style={{ background: '#fce7f3', color: '#db2777' }}>🚗</div>
            <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px' }}>Micro-Volunteer Module</div>
            <div className="mod-desc">Register as micro-volunteer with parking radar & smart routing.</div>
          </div>
          <div className="mod-card module-card" onClick={() => navigate('/leaderboard/donor')} style={{ border: '2px solid var(--g4)', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(254, 243, 199, 0.4))' }}>
            <div className="mod-icon" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#d97706', boxShadow: '0 0 15px rgba(251, 191, 36, 0.4)' }}>🎁</div>
            <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px', color: '#b45309' }}>Top Donors Board</div>
            <div className="mod-desc">See the daily donor leaderboard and boost your community score!</div>
          </div>
          
          <div className="mod-card module-card" onClick={() => navigate('/leaderboard/volunteer')} style={{ border: '2px solid #fdba74', background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255, 237, 213, 0.4))' }}>
            <div className="mod-icon" style={{ background: 'linear-gradient(135deg, #ffedd5, #fed7aa)', color: '#ea580c', boxShadow: '0 0 15px rgba(249, 115, 22, 0.3)' }}>🚗</div>
            <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px', color: '#c2410c' }}>Micro-Volunteers Board</div>
            <div className="mod-desc">Check out the top delivery heroes making a difference in your area.</div>
          </div>

          <div className="mod-card module-card" onClick={() => navigate('/activity')}>
            <div className="mod-icon" style={{ background: '#e0e7ff', color: '#4f46e5' }}>📈</div>
            <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px' }}>My Live Activity</div>
            <div className="mod-desc">View your live donations, history, requests, and P2P chats.</div>
          </div>
          {appState.role === 'admin' && (
            <div className="mod-card module-card" onClick={() => navigate('/admin')}>
              <div className="mod-icon" style={{ background: '#f3f4f6', color: '#1f2937' }}>⚙️</div>
              <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px' }}>Admin Dashboard</div>
              <div className="mod-desc">System analytics and global oversight.</div>
            </div>
          )}
          {(appState.role === 'trust' || appState.role === 'admin') && (
            <div className="mod-card module-card" onClick={() => navigate('/trust')}>
              <div className="mod-icon" style={{ background: '#ecfdf5', color: '#059669' }}>🏛️</div>
              <div className="mod-title" style={{ fontWeight: 800, marginBottom: '5px' }}>Trust Dashboard</div>
              <div className="mod-desc">Manage large donations and funding requests.</div>
            </div>
          )}
        </div>
        
        {/* 7. Community Notice Board (Mass Events) */}
        <div className="card" style={{ marginBottom: '20px', borderTop: '4px solid #8b5cf6' }}>
          <div className="card-head">
            <h3>📌 Community Notice Board</h3>
            <span className="badge" style={{ background: '#8b5cf6' }}>Mass Events</span>
          </div>
          <div className="card-body">
            {db.mass_donations && db.mass_donations.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {db.mass_donations.map((event, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '15px', padding: '15px', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                    {event.event_photo_url ? (
                      <img src={event.event_photo_url} alt="Event" style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px' }} />
                    ) : (
                      <div style={{ width: '100px', height: '100px', background: 'var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🎪</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '4px', color: 'var(--p1)' }}>{event.organiser}'s Mass Donation Event</div>
                      <div style={{ fontSize: '.9rem', marginBottom: '4px' }}><strong>📍 Location:</strong> {event.place}</div>
                      <div style={{ fontSize: '.9rem', marginBottom: '4px' }}><strong>⏰ Time:</strong> {new Date(event.event_time).toLocaleString()}</div>
                      <div style={{ fontSize: '.85rem', color: 'var(--txt1)' }}>Organiser Contact: {event.phone_number} {event.is_phone_verified && '✅'}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No upcoming mass donation events at the moment.</div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-head"><h3>📍 Live Community Map</h3><span className="loc-tag"><span className="loc-dot"></span>Live</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            <LeafletMap 
              center={[appState.userLat || 9.9252, appState.userLng || 78.1198]} 
              markers={[
                ...db.donations.filter(d => d.status === 'available' && d.lat && d.lng).map(d => ({ lat: d.lat, lng: d.lng, popup: `🎁 Donor: ${d.food_name}`, type: 'donor' })),
                ...db.volunteers.filter(v => v.status === 'active' && v.pickup_lat && v.pickup_lng).map(v => ({ lat: v.pickup_lat, lng: v.pickup_lng, popup: `🚗 Volunteer: ${v.vol_name}`, type: 'volunteer' }))
              ]} 
              useColorDots={true}
              height="220px" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
