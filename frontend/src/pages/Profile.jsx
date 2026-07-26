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
  const [selectedEvent, setSelectedEvent] = useState(null);

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

  // Auto detect live device location on mount if not already present
  React.useEffect(() => {
    if (navigator.geolocation && (!appState.userLat || !appState.userLng)) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateApp({
            userLat: pos.coords.latitude,
            userLng: pos.coords.longitude,
            userAccuracy: pos.coords.accuracy
          });
        },
        (err) => console.log('Geolocation init on profile:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Calculate user stats (matching username and display name)
  const un = (appState.user || '').toLowerCase();
  const nameUn = (appState.name || '').toLowerCase();

  const myDons = (db.donations || []).filter(d => {
    const dUser = (d.donor_username || '').toLowerCase();
    const dName = (d.donor_name || '').toLowerCase();
    return (un && (dUser === un || dName === un)) || (nameUn && (dUser === nameUn || dName === nameUn));
  }).length;

  const myReqs = (db.requests || []).filter(r => {
    const rUser = (r.req_username || '').toLowerCase();
    const rName = (r.req_name || '').toLowerCase();
    return (un && (rUser === un || rName === un)) || (nameUn && (rUser === nameUn || rName === nameUn));
  }).length;

  const myDeliveries = (db.requests || []).filter(r => {
    const assigned = (r.assigned_to || '').toLowerCase();
    return (un && assigned === un) || (nameUn && assigned === nameUn);
  }).filter(r => r.status === 'completed' || r.status === 'delivered').length;

  const myRatings = (db.ratings || []).filter(rt => {
    const rated = (rt.target_username || rt.rated_username || '').toLowerCase();
    return (un && rated === un) || (nameUn && rated === nameUn);
  });
  
  const avgRatingRaw = myRatings.length > 0 
    ? myRatings.reduce((acc, rt) => acc + (rt.score || rt.rating || 5), 0) / myRatings.length 
    : 0;
    
  const displayRating = myRatings.length > 0 ? avgRatingRaw.toFixed(1) + ' ★' : '5.0 ★';

  const baseTrustScore = 40;
  const trustFromRatings = avgRatingRaw * 10;
  const trustFromActivity = (myDons * 2) + (myDeliveries * 2);
  const rawTrustScore = Math.floor(baseTrustScore + trustFromRatings + trustFromActivity);
  const finalTrustScore = myRatings.length === 0 && myDons === 0 && myDeliveries === 0 ? 0 : Math.min(100, rawTrustScore);

  // Real system-wide cert metrics derived from database
  const totalSystemDonations = db.donations?.length || 0;
  const expiredCount = (db.donations || []).filter(d => d.status === 'expired').length;
  const totalMealsSaved = (db.donations || []).reduce((acc, d) => acc + (Number(d.quantity) || 1), 0);
  const avgFreshness = (db.donations || []).length > 0 
    ? ((db.donations || []).reduce((acc, d) => acc + (Number(d.freshness_score) || 8.5), 0) / db.donations.length).toFixed(1)
    : '8.5';
    
  const totalSystemRequests = db.requests?.length || 0;
  const completedSystemRequests = (db.requests || []).filter(r => r.status === 'completed' || r.status === 'delivered').length;
  const platformSuccessRate = totalSystemRequests > 0 
    ? Math.round((completedSystemRequests / totalSystemRequests) * 100) + '%'
    : 'N/A';

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
    <div className="page active" style={{ paddingBottom: '80px', display: 'flex', flexDirection: 'column' }}>
      
      {/* Mass Event Details Modal */}
      {selectedEvent && (
        <div className="modal-bg" style={{ zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-box" style={{ maxWidth: '500px', width: '90%', padding: '0', overflow: 'hidden', animation: 'popIn 0.3s ease' }}>
            <div style={{ position: 'relative', height: '180px', background: 'var(--border)' }}>
              {selectedEvent.event_photo_url ? (
                <img src={selectedEvent.event_photo_url} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' }}>🎪</div>
              )}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}></div>
              <button className="x-btn" onClick={() => setSelectedEvent(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)', color: '#fff' }}>✕</button>
              <h3 style={{ position: 'absolute', bottom: '15px', left: '20px', color: '#fff', margin: 0, fontSize: '1.4rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                {selectedEvent.organiser}'s Event
              </h3>
            </div>
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }} className="responsive-grid">
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--txt2)', fontWeight: 600 }}>📍 LOCATION</div>
                  <div style={{ fontWeight: 500, color: 'var(--txt)' }}>{selectedEvent.place}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--txt2)', fontWeight: 600 }}>⏰ TIME</div>
                  <div style={{ fontWeight: 500, color: 'var(--txt)' }}>{new Date(selectedEvent.event_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--txt2)', fontWeight: 600 }}>📞 CONTACT</div>
                  <div style={{ fontWeight: 500, color: 'var(--txt)' }}>
                    {selectedEvent.phone_number} 
                    {selectedEvent.is_phone_verified && <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>Verified ✓</span>}
                  </div>
                </div>
              </div>
              
              {selectedEvent.additional_info && (
                <div style={{ background: 'var(--bg1)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--g1)', fontWeight: 700, marginBottom: '8px' }}>📝 Additional Information</div>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--txt1)', whiteSpace: 'pre-wrap' }}>
                    {selectedEvent.additional_info}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
          {appState.role === 'admin' ? (
            <>
              <div className="stat-card"><div className="stat-num">{db.trusts?.length || 0}</div><div className="stat-lbl">Total Trusts</div></div>
              <div className="stat-card"><div className="stat-num">{db.trusts?.filter(t => t.verification_status === 'verified').length || 0}</div><div className="stat-lbl">Verified NGOs</div></div>
              <div className="stat-card"><div className="stat-num">{db.trusts?.filter(t => t.verification_status === 'pending').length || 0}</div><div className="stat-lbl" style={{ color: '#d97706' }}>Pending Reviews</div></div>
              <div className="stat-card"><div className="stat-num" style={{ color: '#db2777' }}>{db.notifications?.length || 0}</div><div className="stat-lbl">System Alerts</div></div>
            </>
          ) : (
            <>
              <div className="stat-card"><div className="stat-num">{myDons}</div><div className="stat-lbl">Donations</div></div>
              <div className="stat-card"><div className="stat-num">{myReqs}</div><div className="stat-lbl">Requests</div></div>
              <div className="stat-card"><div className="stat-num">{myDeliveries}</div><div className="stat-lbl">Deliveries</div></div>
              <div className="stat-card"><div className="stat-num">{displayRating}</div><div className="stat-lbl">My Rating</div></div>
            </>
          )}
        </div>
        
        {/* 4. AI Cert with missing metrics */}
        {appState.role !== 'admin' && (
          <>
        <div className="profile-ai-cert">
          <div className="cert-header">
            <div className="cert-title">🏅 ZeroHungerVision AI System Status</div>
            <div className="cert-live-badge"><div className="cert-live-dot"></div>LIVE</div>
          </div>
          <div className="cert-metrics">
            <div className="cert-metric"><div className="cert-metric-val">{totalSystemDonations}</div><div className="cert-metric-lbl">Donations</div></div>
            <div className="cert-metric"><div className="cert-metric-val">{avgFreshness}</div><div className="cert-metric-lbl">Avg Freshness</div></div>
            <div className="cert-metric"><div className="cert-metric-val">{platformSuccessRate}</div><div className="cert-metric-lbl">Success Rate</div></div>
            <div className="cert-metric"><div className="cert-metric-val">{totalMealsSaved}</div><div className="cert-metric-lbl">Meals Saved</div></div>
            <div className="cert-metric"><div className="cert-metric-val" style={{ color: '#ef4444' }}>{expiredCount}</div><div className="cert-metric-lbl">Food Wasted 🗑️</div></div>
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
              <div style={{ fontSize: '.75rem', fontWeight: 700, opacity: .6, marginBottom: '2px' }}>
                {finalTrustScore > 80 ? 'EXCELLENT' : finalTrustScore > 50 ? 'GOOD' : finalTrustScore > 0 ? 'NEEDS WORK' : 'NEWCOMER'}
              </div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '1.8rem', fontWeight: 800, color: 'var(--g1)' }}>
                {finalTrustScore > 0 ? `${finalTrustScore}/100` : '--/100'}
              </div>
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
          </>
        )}
        
        <div className="module-grid">
          {appState.role !== 'admin' && (
            <>
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
            </>
          )}

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
        <div className="card" style={{ marginBottom: '20px', borderTop: '4px solid #8b5cf6', background: 'linear-gradient(145deg, var(--bg1) 0%, var(--bg) 100%)', boxShadow: '0 8px 30px rgba(139, 92, 246, 0.15)' }}>
          <div className="card-head" style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.4rem' }}>📌</span> Community Notice Board
            </h3>
            <span className="badge" style={{ background: '#8b5cf6', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem' }}>Live Events</span>
          </div>
          <div className="card-body" style={{ padding: '24px' }}>
            {db.mass_donations && db.mass_donations.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {db.mass_donations.map((event, idx) => {
                  const isExpired = event.status === 'expired' || new Date(event.event_time) < new Date();
                  return (
                  <div key={idx} style={{ 
                    position: 'relative',
                    background: 'var(--bg)', 
                    borderRadius: '16px', 
                    border: '1px solid var(--border)', 
                    overflow: 'hidden',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    opacity: isExpired ? 0.7 : 1,
                    filter: isExpired ? 'grayscale(0.5)' : 'none'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 12px 25px rgba(139, 92, 246, 0.2)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.05)'; }}
                  onClick={() => setSelectedEvent(event)}
                  >
                    {/* Status Badge */}
                    <div style={{
                      position: 'absolute', top: '10px', right: '10px', zIndex: 2,
                      background: isExpired ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.9)',
                      color: '#fff', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                      display: 'flex', alignItems: 'center', gap: '4px',
                      backdropFilter: 'blur(4px)'
                    }}>
                      <span className={isExpired ? '' : 'pulse-dot'} style={{ 
                        width: '6px', height: '6px', borderRadius: '50%', 
                        background: '#fff', display: 'inline-block' 
                      }}></span>
                      {isExpired ? 'EXPIRED' : 'UPCOMING'}
                    </div>

                    <div style={{ height: '140px', background: 'var(--border)', position: 'relative' }}>
                      {event.event_photo_url ? (
                        <img src={event.event_photo_url} alt="Event" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' }}>🎪</div>
                      )}
                      {/* Gradient overlay for text legibility */}
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '60px', background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}></div>
                      <div style={{ position: 'absolute', bottom: '10px', left: '15px', right: '15px', color: '#fff', fontWeight: 800, fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                        {event.organiser}'s Event
                      </div>
                    </div>
                    
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>📍</span>
                        <div style={{ fontSize: '0.9rem', color: 'var(--txt)' }}>{event.place}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                        <span style={{ fontSize: '1.2rem' }}>⏰</span>
                        <div style={{ fontSize: '0.9rem', color: 'var(--txt)', fontWeight: 600 }}>{new Date(event.event_time).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ borderTop: '1px dashed var(--border)', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--txt1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          📞 {event.phone_number}
                        </div>
                        {event.is_phone_verified && <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#059669', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, border: '1px solid #a7f3d0' }}>Verified ✓</span>}
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="empty" style={{ padding: '40px', background: 'var(--bg)', borderRadius: '16px', border: '2px dashed var(--border)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '15px' }}>📭</div>
                No upcoming mass donation events at the moment.
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px', border: '2px solid #10b981', overflow: 'hidden', boxShadow: '0 8px 25px rgba(16, 185, 129, 0.15)' }}>
          <div className="card-head" style={{ background: 'rgba(16, 185, 129, 0.05)', borderBottom: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ color: '#047857' }}>📍 Live Community Map</h3>
            <span className="loc-tag" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #10b981' }}>
              <span className="loc-dot" style={{ background: '#10b981' }}></span>Live
            </span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <LeafletMap 
              center={[appState.userLat || 9.9252, appState.userLng || 78.1198]} 
              markers={[
                ...(appState.userLat && appState.userLng ? [{
                  lat: appState.userLat,
                  lng: appState.userLng,
                  popup: `<div style="font-family: inherit;"><div style="font-weight: bold; color: #10b981;">📍 Your Live Location</div></div>`,
                  type: 'user'
                }] : []),
                ...(db.donations || []).filter(d => d.lat && d.lng && d.status !== 'cancelled').map(d => ({
                  lat: Number(d.lat), 
                  lng: Number(d.lng), 
                  popup: `<div style="font-family: inherit;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: #10b981;">🎁 ${d.food_name || 'Donation'}</div>
                            <div style="font-size: 12px; color: #4b5563;">Donor: <strong>${d.donor_name || d.donor_username || 'Donor'}</strong></div>
                            <div style="font-size: 12px; color: #4b5563; margin-bottom: 2px;">📦 ${d.quantity || 1} units</div>
                            <div style="font-size: 12px; color: #4b5563;">🌿 Freshness: <strong>${d.freshness_score || 9}/10</strong></div>
                          </div>`,
                  type: 'donor' 
                })),
                ...(db.requests || []).filter(r => r.lat && r.lng && r.status !== 'cancelled').map(r => ({
                  lat: Number(r.lat), 
                  lng: Number(r.lng), 
                  popup: `<div style="font-family: inherit;">
                            <div style="font-weight: bold; font-size: 14px; margin-bottom: 4px; color: #f59e0b;">📦 ${r.food_name || 'Request'}</div>
                            <div style="font-size: 12px; color: #4b5563;">Receiver: <strong>${r.req_name || r.req_username || 'Receiver'}</strong></div>
                            <div style="font-size: 12px; color: #4b5563;">Urgency: <strong>${r.urgency || 'Normal'}</strong></div>
                          </div>`,
                  type: 'request' 
                })),
                ...(db.volunteers || []).filter(v => v.status === 'active' && v.pickup_lat && v.pickup_lng).map(v => ({ 
                  lat: Number(v.pickup_lat), 
                  lng: Number(v.pickup_lng), 
                  popup: `<div style="font-family: inherit;"><div style="font-weight: bold; color: #3b82f6;">🚗 Volunteer: ${v.vol_name || v.vol_username}</div></div>`, 
                  type: 'volunteer' 
                }))
              ]} 
              useColorDots={true}
              height="240px" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
