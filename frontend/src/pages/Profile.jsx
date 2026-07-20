import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import LeafletMap from '../components/LeafletMap';

export default function Profile() {
  const { appState, db, updateApp } = useAppContext();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);

  const handleLogout = () => {
    updateApp({ user: null, role: null, name: null });
    navigate('/');
  };

  const emoji = appState.emoji || '👤';

  // Calculate user stats
  const un = (appState.user || '').toLowerCase();
  const myDons = db.donations.filter(d => (d.donor_name || '').toLowerCase() === un).length;
  const myReqs = db.requests.filter(r => (r.requester_name || '').toLowerCase() === un).length;

  return (
    <div className="page active">
      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-bg">
          <div className="modal-box">
            <div className="modal-head">
              <div className="modal-title">⚙️ Account Settings</div>
              <button className="x-btn" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            
            <div className="fg">
              <label>Profile Theme</label>
              <select>
                <option>🟢 Light Emerald (Default)</option>
                <option>🌙 Dark Mode (Coming Soon)</option>
              </select>
            </div>
            <div className="fg">
              <label>Push Notifications</label>
              <select>
                <option>Enabled (Real-time)</option>
                <option>Disabled</option>
              </select>
            </div>
            <div className="fg">
              <label>P2P Privacy</label>
              <select>
                <option>Show exact location to matches</option>
                <option>Show approximate location only</option>
              </select>
            </div>
            
            <button className="btn btn-primary btn-full" onClick={() => setShowSettings(false)} style={{ marginTop: '10px' }}>
              Save Preferences
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
          <div className="notif-badge">0</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(true)} style={{ padding: '6px 12px' }}>⚙️ Settings</button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} style={{ padding: '6px 12px', background: 'var(--r1)', borderColor: 'var(--r1)' }}>🚪 Logout</button>
        </div>
      </div>

      {/* 2. Profile Top with tags */}
      <div className="prof-top">
        <div className="prof-avatar-wrap">
          <div className="prof-avatar-big">{emoji}</div>
          <div className="prof-avatar-overlay">📷</div>
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
          <div className="history-metric-btn don-btn" onClick={() => navigate('/history-donations')}>
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
          <div className="history-metric-btn req-btn" onClick={() => navigate('/history-requests')}>
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
