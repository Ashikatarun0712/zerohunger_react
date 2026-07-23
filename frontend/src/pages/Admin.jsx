import React, { useEffect, useRef } from 'react';
import { useAppContext } from '../store/AppContext';
import Chart from 'chart.js/auto';
import LeafletMap from '../components/LeafletMap';

export default function Admin() {
  const { db } = useAppContext();
  
  const chDonRef = useRef(null);
  const chReqRef = useRef(null);

  const donCount = db.donations?.length || 0;
  const reqCount = db.requests?.length || 0;
  const volCount = db.volunteers?.length || 0;

  const co2Saved = (donCount * 2.5).toFixed(1);
  const mealsSaved = donCount * 4;
  const saveRatio = donCount > 0 ? '92%' : '0%';

  useEffect(() => {
    // Destroy previous charts if they exist
    const charts = [];
    
    if (chDonRef.current) {
      const c = new Chart(chDonRef.current, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{ label: 'Donations', data: [12, 19, 15, 25, 22, 30, donCount], borderColor: '#3b82f6', tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      charts.push(c);
    }
    
    if (chReqRef.current) {
      const c = new Chart(chReqRef.current, {
        type: 'bar',
        data: {
          labels: ['Pending', 'Completed', 'Cancelled'],
          datasets: [{ label: 'Requests', data: [reqCount, 15, 2], backgroundColor: ['#f59e0b', '#10b981', '#ef4444'] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
      });
      charts.push(c);
    }

    return () => {
      charts.forEach(c => c.destroy());
    };
  }, [donCount, reqCount]);

  return (
    <div className="page active">
      <div className="dash-wrap">
        <div className="sec-title">⚙️ Admin Dashboard</div>
        
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-num">{donCount}</div><div className="stat-lbl">Donations</div></div>
          <div className="stat-card"><div className="stat-num">{reqCount}</div><div className="stat-lbl">Requests</div></div>
          <div className="stat-card"><div className="stat-num">{volCount}</div><div className="stat-lbl">Volunteers</div></div>
          <div className="stat-card"><div className="stat-num">91%</div><div className="stat-lbl">AI Accuracy</div></div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px', marginBottom: '24px' }}>
          <div className="carbon-card">
            <div style={{ fontSize: '.78rem', opacity: .7, marginBottom: '4px' }}>🌿 CO₂ Saved (Est.)</div>
            <div className="carbon-num">{co2Saved} kg</div>
            <div style={{ marginTop: '8px' }}><span className="co2-chip">≈ {(co2Saved / 20).toFixed(1)} trees/yr</span></div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#0a1a4a,#0d2a7a)', borderRadius: 'var(--radius)', padding: '20px', color: '#fff' }}>
            <div style={{ fontSize: '.78rem', opacity: .7, marginBottom: '4px' }}>🍽️ Meals Redistributed</div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '2.2rem', fontWeight: 800, color: '#93c5fd' }}>{mealsSaved}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#3a0a2a,#5a0d3a)', borderRadius: 'var(--radius)', padding: '20px', color: '#fff' }}>
            <div style={{ fontSize: '.78rem', opacity: .7, marginBottom: '4px' }}>♻️ Food Saved vs Wasted</div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '2.2rem', fontWeight: 800, color: '#f9a8d4' }}>{saveRatio}</div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,#1a2a0a,#2a4a0d)', borderRadius: 'var(--radius)', padding: '20px', color: '#fff' }}>
            <div style={{ fontSize: '.78rem', opacity: .7, marginBottom: '4px' }}>📍 Avg Delivery Distance</div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: '2.2rem', fontWeight: 800, color: '#86efac' }}>3.2 km</div>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '20px', marginBottom: '24px' }}>
          <div className="card"><div className="card-head"><h3>📈 Donation Trends</h3></div><div className="card-body" style={{ height: '220px' }}><canvas ref={chDonRef}></canvas></div></div>
          <div className="card"><div className="card-head"><h3>📦 Request Status</h3></div><div className="card-body" style={{ height: '220px' }}><canvas ref={chReqRef}></canvas></div></div>
        </div>
        
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-head">
            <h3>🔔 Notifications</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm btn-outline">🔄</button>
              <button className="btn btn-sm btn-primary">📋 Details</button>
            </div>
          </div>
          <div className="card-body">
            <div id="notif-list">
              {db.notifications?.length === 0 ? (
                <div className="empty">No notifications</div>
              ) : (
                db.notifications?.map((n, i) => (
                  <div key={i} style={{ padding: '10px', borderBottom: '1px solid var(--border)' }}>{n.message}</div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-head">
            <h3>📍 P2P Distribution Map + Routes</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-sm btn-primary">All</button>
              <button className="btn btn-sm btn-outline">Quality</button>
              <button className="btn btn-sm btn-outline">Routes</button>
            </div>
          </div>
          <div className="card-body">
            <LeafletMap 
              center={[9.9252, 78.1198]} 
              markers={db.donations.map(d => ({ lat: d.lat, lng: d.lng, popup: d.food_name }))} 
              height="380px" 
            />
          </div>
        </div>
      </div>
    </div>
  );
}
