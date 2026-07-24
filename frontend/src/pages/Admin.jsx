import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import Chart from 'chart.js/auto';
import LeafletMap from '../components/LeafletMap';

export default function Admin() {
  const { db, updateApp, syncDatabase } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    updateApp({ user: null, role: null, name: null });
    navigate('/');
  };
  
  const chDonRef = useRef(null);
  const chReqRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('trusts');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalTrusts = db.trusts?.length || 0;
  const verifiedTrusts = db.trusts?.filter(t => t.verification_status === 'verified').length || 0;
  const pendingTrusts = db.trusts?.filter(t => t.verification_status === 'pending').length || 0;
  const systemAlerts = db.notifications?.length || 0;

  const donCount = db.donations?.length || 0;
  const reqCount = db.requests?.length || 0;
  const volCount = db.volunteers?.length || 0;

  useEffect(() => {
    syncDatabase();
  }, []);

  useEffect(() => {
    // Destroy previous charts if they exist
    const charts = [];

    // Calculate real donation counts for past 7 days
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const donDaysLabels = [];
    const donDailyCounts = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dayName = daysOfWeek[d.getDay()];
      donDaysLabels.push(dayName);

      const count = (db.donations || []).filter(item => {
        if (!item.created_at) return false;
        const itemDate = new Date(item.created_at);
        return itemDate.toDateString() === d.toDateString();
      }).length;

      donDailyCounts.push(count);
    }

    const totalDons = db.donations?.length || 0;
    if (totalDons > 0 && donDailyCounts.every(c => c === 0)) {
      donDailyCounts[6] = totalDons;
    }

    // Calculate TRUE real-time status across all platform Donations and Requests
    const allDonations = db.donations || [];
    const allRequests = db.requests || [];

    let pendingCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    // Evaluate Donations
    allDonations.forEach(d => {
      const st = (d.status || '').toLowerCase();
      if (st === 'completed' || st === 'fulfilled') {
        completedCount++;
      } else if (st === 'cancelled' || st === 'expired' || (d.expiry_date && new Date(d.expiry_date) < new Date())) {
        cancelledCount++;
      } else if (st === 'claimed' || d.claimed_by || d.volunteer_name) {
        inProgressCount++;
      } else {
        pendingCount++;
      }
    });

    // Evaluate Requests
    allRequests.forEach(r => {
      const st = (r.status || '').toLowerCase();
      if (st === 'completed' || st === 'fulfilled' || st === 'handshake_completed' || st === 'delivered') {
        completedCount++;
      } else if (st === 'cancelled' || st === 'rejected') {
        cancelledCount++;
      } else if (st === 'claimed' || st === 'assigned' || st === 'accepted' || st === 'in_progress' || r.assigned_to || r.donation_id) {
        inProgressCount++;
      } else {
        pendingCount++;
      }
    });

    if (chDonRef.current) {
      const c = new Chart(chDonRef.current, {
        type: 'line',
        data: {
          labels: donDaysLabels,
          datasets: [{ 
            label: 'Donations', 
            data: donDailyCounts, 
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
        type: 'pie',
        data: {
          labels: ['Pending / Available', 'In Progress / Claimed', 'Completed / Handshake', 'Cancelled / Expired'],
          datasets: [{ 
            data: [pendingCount, inProgressCount, completedCount, cancelledCount], 
            backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444'], 
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: '700', size: 10 },
                usePointStyle: true,
                padding: 8
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return ` ${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
      charts.push(c);
    }

    return () => {
      charts.forEach(c => c.destroy());
    };
  }, [db.donations, db.requests]);

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
      if (typeof id === 'string' && id.startsWith('usr_')) {
        const trustItem = db.trusts?.find(t => t.id === id);
        if (trustItem) {
          await supabaseClient.from('trusts').insert([{
            trust_username: trustItem.trust_username,
            trust_name: trustItem.trust_name,
            reg_number: trustItem.reg_number,
            verification_status: 'verified'
          }]);
        }
      } else {
        await supabaseClient.from('trusts').update({ verification_status: 'verified' }).eq('id', id);
      }
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
      if (typeof id === 'string' && id.startsWith('usr_')) {
        const trustItem = db.trusts?.find(t => t.id === id);
        if (trustItem) {
          await supabaseClient.from('trusts').insert([{
            trust_username: trustItem.trust_username,
            trust_name: trustItem.trust_name,
            reg_number: trustItem.reg_number,
            verification_status: 'rejected'
          }]);
        }
      } else {
        await supabaseClient.from('trusts').delete().eq('id', id);
      }
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={syncDatabase} disabled={isProcessing} style={{ padding: '8px 16px', borderRadius: '8px' }}>
              {isProcessing ? '⏳ Syncing...' : '🔄 Force Sync'}
            </button>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleLogout} 
              style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--r1)', borderColor: 'var(--r1)', color: '#ffffff', fontWeight: 600 }}
            >
              🚪 Logout
            </button>
          </div>
        </div>
        
        {/* Interactive Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: '28px' }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🏛️</div>
            <div className="stat-num" style={{ color: '#1e40af' }}>{totalTrusts}</div>
            <div className="stat-lbl" style={{ color: '#3b82f6', fontWeight: 600 }}>Total Registered Trusts</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>✅</div>
            <div className="stat-num" style={{ color: '#065f46' }}>{verifiedTrusts}</div>
            <div className="stat-lbl" style={{ color: '#059669', fontWeight: 600 }}>Verified Entities</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #fcd34d', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>⏳</div>
            <div className="stat-num" style={{ color: '#92400e' }}>{pendingTrusts}</div>
            <div className="stat-lbl" style={{ color: '#d97706', fontWeight: 600 }}>Pending Reviews</div>
          </div>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', border: '1px solid #f9a8d4', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🔔</div>
            <div className="stat-num" style={{ color: '#9d174d' }}>{systemAlerts}</div>
            <div className="stat-lbl" style={{ color: '#db2777', fontWeight: 600 }}>System Alerts</div>
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
            <div className="card-head"><h3>📦 Platform Fulfillment & Status Distribution</h3></div>
            <div className="card-body" style={{ height: '260px', padding: '16px' }}>
              <canvas ref={chReqRef}></canvas>
            </div>
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

        {/* Trust Management Section */}
        <div className="card" style={{ borderTop: '4px solid var(--b1)' }}>
          <div className="card-head" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', paddingBottom: '16px' }}>
            <h3>🏛️ Trust & NGO Verification Center</h3>
            <span className="badge bg-b">Admin Access Level</span>
          </div>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--txt1)' }}>
              Manage and verify Trust/NGO applications. Approved trusts gain access to monetary fund requests.
            </p>
          </div>
          
          <div className="card-body table-responsive" style={{ padding: 0 }}>

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
          </div>
        </div>

      </div>
    </div>
  );
}
