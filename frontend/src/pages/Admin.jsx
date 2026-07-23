import React, { useEffect, useRef, useState } from 'react';
import { useAppContext, supabaseClient } from '../store/AppContext';
import Chart from 'chart.js/auto';
import LeafletMap from '../components/LeafletMap';

export default function Admin() {
  const { db, syncDatabase } = useAppContext();
  
  const chDonRef = useRef(null);
  const chReqRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('donations');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const donCount = db.donations?.length || 0;
  const reqCount = db.requests?.length || 0;
  const volCount = db.volunteers?.length || 0;

  useEffect(() => {
    // Destroy previous charts if they exist
    const charts = [];
    
    if (chDonRef.current) {
      const c = new Chart(chDonRef.current, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{ 
            label: 'Donations', 
            data: [12, 19, 15, 25, 22, 30, donCount], 
            borderColor: '#8b5cf6', 
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            tension: 0.4,
            fill: true
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
      });
      charts.push(c);
    }
    
    if (chReqRef.current) {
      const c = new Chart(chReqRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Pending', 'Completed', 'Cancelled'],
          datasets: [{ data: [reqCount, 15, 2], backgroundColor: ['#f59e0b', '#10b981', '#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%' }
      });
      charts.push(c);
    }

    return () => {
      charts.forEach(c => c.destroy());
    };
  }, [donCount, reqCount]);

  const handleCancelDonation = async (id) => {
    if (!window.confirm('⚠️ Are you sure you want to forcefully cancel this donation?')) return;
    setIsProcessing(true);
    try {
      await supabaseClient.from('donations').update({ status: 'cancelled' }).eq('id', id);
      await syncDatabase();
      if (window.showToast) window.showToast('Donation cancelled by Admin.', 'ok');
    } catch (e) {
      console.error(e);
      alert('Failed to cancel donation');
    }
    setIsProcessing(false);
  };

  const handleVerifyTrust = async (id) => {
    if (!window.confirm('✅ Approve and verify this Trust?')) return;
    setIsProcessing(true);
    try {
      await supabaseClient.from('trusts').update({ verification_status: 'verified' }).eq('id', id);
      await syncDatabase();
      if (window.showToast) window.showToast('Trust verified successfully.', 'ok');
    } catch (e) {
      console.error(e);
      alert('Failed to verify trust');
    }
    setIsProcessing(false);
  };

  const handleDeleteTrust = async (id) => {
    if (!window.confirm('🚫 Reject and delete this Trust application?')) return;
    setIsProcessing(true);
    try {
      await supabaseClient.from('trusts').delete().eq('id', id);
      await syncDatabase();
      if (window.showToast) window.showToast('Trust application rejected.', 'ok');
    } catch (e) {
      console.error(e);
      alert('Failed to delete trust');
    }
    setIsProcessing(false);
  };

  return (
    <div className="page active">
      {/* Notifications Modal */}
      {showNotifModal && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '500px', width: '90%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head">
              <div className="modal-title">🔔 System Notifications</div>
              <button className="x-btn" onClick={() => setShowNotifModal(false)}>✕</button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '5px' }}>
              {db.notifications?.length === 0 ? (
                <div className="empty">No system notifications found.</div>
              ) : (
                db.notifications?.map((n, i) => (
                  <div key={i} style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg)', borderRadius: '8px', marginBottom: '10px', boxShadow: '0 2px 6px rgba(0,0,0,0.03)' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--txt)' }}>{n.message}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--txt1)', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                      {n.urgency === 'High' && <span style={{ color: '#dc2626', fontWeight: 'bold' }}>⚠️ High Priority</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div className="dash-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div className="sec-title" style={{ margin: 0 }}>⚙️ Admin Control Panel</div>
          <button className="btn btn-primary" onClick={syncDatabase} disabled={isProcessing} style={{ padding: '8px 16px', borderRadius: '8px' }}>
            {isProcessing ? '⏳ Syncing...' : '🔄 Force Sync'}
          </button>
        </div>
        
        {/* Interactive Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: '28px' }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🎁</div>
            <div className="stat-num" style={{ color: '#1e40af' }}>{donCount}</div>
            <div className="stat-lbl" style={{ color: '#3b82f6', fontWeight: 600 }}>Total Donations</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #fcd34d', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>📦</div>
            <div className="stat-num" style={{ color: '#92400e' }}>{reqCount}</div>
            <div className="stat-lbl" style={{ color: '#d97706', fontWeight: 600 }}>Total Requests</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', border: '1px solid #f9a8d4', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🚗</div>
            <div className="stat-num" style={{ color: '#9d174d' }}>{volCount}</div>
            <div className="stat-lbl" style={{ color: '#db2777', fontWeight: 600 }}>Volunteers</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🤖</div>
            <div className="stat-num" style={{ color: '#065f46' }}>91%</div>
            <div className="stat-lbl" style={{ color: '#059669', fontWeight: 600 }}>AI Vision Accuracy</div>
          </div>
        </div>
        
        {/* Charts Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
          <div className="card" style={{ borderTop: '4px solid #8b5cf6' }}>
            <div className="card-head"><h3>📈 Donation Velocity</h3></div>
            <div className="card-body" style={{ height: '260px', padding: '16px' }}>
              <canvas ref={chDonRef}></canvas>
            </div>
          </div>
          
          <div className="card" style={{ borderTop: '4px solid #f59e0b' }}>
            <div className="card-head"><h3>📦 Request Fulfillment</h3></div>
            <div className="card-body" style={{ height: '260px', padding: '16px', position: 'relative' }}>
              <canvas ref={chReqRef}></canvas>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none', marginTop: '10px' }}>
                 <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--txt)', lineHeight: '1' }}>{reqCount}</div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--txt1)', fontWeight: 600 }}>Requests</div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Distribution Map */}
        <div className="card" style={{ marginBottom: '28px', border: '1px solid #10b981', boxShadow: '0 10px 30px rgba(16, 185, 129, 0.1)' }}>
          <div className="card-head" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
            <h3 style={{ color: '#047857' }}>📍 Live Global P2P Map</h3>
            <span className="badge bg-g">System Tracking Active</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <LeafletMap 
              center={[9.9252, 78.1198]} 
              markers={[
                ...db.donations.filter(d => d.lat && d.lng && d.status === 'available').map(d => ({ lat: d.lat, lng: d.lng, popup: `🎁 Donation: ${d.food_name}`, type: 'donor' })),
                ...db.volunteers.filter(v => v.pickup_lat && v.pickup_lng && v.status === 'active').map(v => ({ lat: v.pickup_lat, lng: v.pickup_lng, popup: `🚗 Volunteer: ${v.vol_name}`, type: 'volunteer' }))
              ]} 
              useColorDots={true}
              height="350px" 
            />
          </div>
        </div>
        
        {/* Notifications Bar */}
        <div className="card" style={{ marginBottom: '28px', background: 'linear-gradient(90deg, #1e1e1e, #2d2d2d)', color: '#fff', borderRadius: '12px', border: 'none', overflow: 'hidden' }}>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }}>🔔</div>
              <div>
                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.3rem', fontWeight: 700 }}>System Alerts & Activity</h3>
                <div style={{ fontSize: '0.9rem', color: '#a3a3a3', marginTop: '4px' }}>{db.notifications?.length || 0} alerts currently logged in the global system.</div>
              </div>
            </div>
            <button 
              className="btn" 
              style={{ background: 'var(--p1)', color: '#fff', border: 'none', padding: '10px 20px', fontSize: '1rem', fontWeight: 600, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)' }} 
              onClick={() => setShowNotifModal(true)}
            >
              📋 View Details
            </button>
          </div>
        </div>

        {/* Data Management Section */}
        <div className="card" style={{ borderTop: '4px solid var(--b1)' }}>
          <div className="card-head" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', paddingBottom: '16px' }}>
            <h3>🛠️ Data Management Center</h3>
            <span className="badge bg-b">Admin Access Level</span>
          </div>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '12px', background: 'var(--bg)' }}>
            <button className={`btn ${activeTab === 'donations' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 16px' }} onClick={() => setActiveTab('donations')}>🎁 Manage Donations</button>
            <button className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 16px' }} onClick={() => setActiveTab('requests')}>📦 View Requests</button>
            <button className={`btn ${activeTab === 'trusts' ? 'btn-primary' : 'btn-outline'}`} style={{ padding: '8px 16px' }} onClick={() => setActiveTab('trusts')}>🏛️ Manage Trusts / NGOs</button>
          </div>
          
          <div className="card-body table-responsive" style={{ padding: 0 }}>
            {activeTab === 'donations' && (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID / Date</th>
                    <th>Donor</th>
                    <th>Food Item</th>
                    <th>Status</th>
                    <th>Admin Action</th>
                  </tr>
                </thead>
                <tbody>
                  {db.donations?.length === 0 ? <tr><td colSpan="5" className="empty" style={{ padding: '40px' }}>No donations found in the database.</td></tr> : null}
                  {db.donations?.map(d => (
                    <tr key={d.id} style={{ transition: 'background 0.2s' }}>
                      <td>
                        <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--p1)', fontWeight: 600 }}>#{d.id?.toString().slice(0,6)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--txt1)' }}>{new Date(d.created_at).toLocaleDateString()}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--txt)' }}>{d.donor_name}</td>
                      <td>{d.food_name} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>(x{d.quantity})</span></td>
                      <td>
                         <span className={`badge ${d.status === 'available' ? 'bg-g' : (d.status === 'cancelled' ? 'bg-r' : 'bg-y')}`}>
                           {d.status.toUpperCase()}
                         </span>
                      </td>
                      <td>
                        {d.status !== 'cancelled' && d.status !== 'completed' && (
                          <button 
                            className="btn btn-sm" 
                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600 }} 
                            onClick={() => handleCancelDonation(d.id)} 
                            disabled={isProcessing}
                          >
                            ✖ Force Cancel
                          </button>
                        )}
                        {(d.status === 'cancelled' || d.status === 'completed') && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--txt1)', fontStyle: 'italic' }}>No action available</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'requests' && (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ID / Date</th>
                    <th>Requester</th>
                    <th>Requested Item</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {db.requests?.length === 0 ? <tr><td colSpan="4" className="empty" style={{ padding: '40px' }}>No requests found in the database.</td></tr> : null}
                  {db.requests?.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--p1)', fontWeight: 600 }}>#{r.id?.toString().slice(0,6)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--txt1)' }}>{new Date(r.created_at).toLocaleDateString()}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--txt)' }}>{r.req_name}</td>
                      <td>{r.food_name} <span style={{ opacity: 0.6, fontSize: '0.8rem' }}>(x{r.quantity})</span></td>
                      <td>
                         <span className={`badge ${r.status === 'pending' ? 'bg-y' : (r.status === 'cancelled' ? 'bg-r' : 'bg-g')}`}>
                           {r.status.toUpperCase()}
                         </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'trusts' && (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Trust / NGO Name</th>
                    <th>Registration No.</th>
                    <th>Status</th>
                    <th>Admin Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {db.trusts?.length === 0 ? <tr><td colSpan="4" className="empty" style={{ padding: '40px' }}>No trusts registered.</td></tr> : null}
                  {db.trusts?.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700, color: 'var(--txt)', fontSize: '1.05rem' }}>🏛️ {t.trust_name}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--txt1)' }}>{t.reg_number}</td>
                      <td>
                         <span className={`badge ${t.verification_status === 'verified' ? 'bg-g' : 'bg-y'}`}>
                           {t.verification_status ? t.verification_status.toUpperCase() : 'PENDING'}
                         </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {t.verification_status !== 'verified' && (
                            <button 
                              className="btn btn-sm" 
                              style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 600 }} 
                              onClick={() => handleVerifyTrust(t.id)} 
                              disabled={isProcessing}
                            >
                              ✓ Approve
                            </button>
                          )}
                          <button 
                            className="btn btn-sm" 
                            style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 600 }} 
                            onClick={() => handleDeleteTrust(t.id)} 
                            disabled={isProcessing}
                          >
                            🗑 Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
