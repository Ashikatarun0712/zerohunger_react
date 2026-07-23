import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';

import P2PChatModal from '../components/P2PChatModal';

export default function Activity() {
  const { db, appState, syncDatabase } = useAppContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [chatPartnerRole, setChatPartnerRole] = useState(null);
  const [chatActivity, setChatActivity] = useState(null);
  
  // Cancel Modal State
  const [cancelAct, setCancelAct] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    await syncDatabase();
    setLoading(false);
  };

  const handleCancelConfirm = async () => {
    if (!cancelReason.trim()) return alert("Please specify a reason for cancellation.");
    setIsCancelling(true);
    
    try {
      const table = cancelAct.type === 'Donation' ? 'donations' : 'requests';
      
      // Update status to 'cancelled' and append the reason to notes/description if possible, 
      // or simply update status since cancel_reason column might not exist yet.
      const { error } = await supabaseClient
        .from(table)
        .update({ status: 'cancelled' })
        .eq('id', cancelAct.id);
        
      if (error) throw error;
      
      // Attempt to save reason if column exists, else it fails silently
      await supabaseClient.from(table).update({ cancel_reason: cancelReason }).eq('id', cancelAct.id).catch(() => {});
      
      await syncDatabase();
      setCancelAct(null);
      setCancelReason('');
    } catch (e) {
      console.error("Failed to cancel:", e);
      alert("Failed to cancel item.");
    } finally {
      setIsCancelling(false);
    }
  };

  const getMyActivity = () => {
    const un = (appState.user || '').toLowerCase();
    const unName = (appState.name || '').toLowerCase();
    const myDonations = db.donations
      .filter(d => (d.donor_username || '').toLowerCase() === un || (d.claimed_by || '').toLowerCase() === unName)
      .map(d => {
        const isMine = (d.donor_username || '').toLowerCase() === un;
        return { 
          ...d, 
          type: 'Donation', 
          partner: isMine ? (d.claimed_by || '—') : (d.donor_name || '—'),
          partnerRole: isMine ? (d.claimed_by ? 'receiver' : null) : 'donor',
          myRole: isMine ? 'donor' : 'receiver',
          action: (isMine && d.status === 'available') ? 'Cancel' : '—' 
        };
      });
    
    const myRequests = db.requests
      .filter(r => (r.req_username || '').toLowerCase() === un || (r.assigned_to || '').toLowerCase() === unName)
      .map(r => {
        const isMine = (r.req_username || '').toLowerCase() === un;
        return { 
          ...r, 
          type: 'Request', 
          food_name: r.food_name, 
          qty: r.quantity || 0, 
          status: r.status, 
          partner: isMine ? (r.assigned_to || '—') : (r.req_name || '—'), 
          partnerRole: isMine 
            ? (r.assigned_to ? (db.volunteers.some(v => v.vol_name === r.assigned_to) ? 'volunteer' : 'donor') : null) 
            : 'receiver',
          myRole: isMine ? 'receiver' : (db.volunteers.some(v => v.vol_name === appState.name) ? 'volunteer' : 'donor'),
          action: (isMine && r.status === 'pending') ? 'Cancel' : '—' 
        };
      });

    return [...myDonations, ...myRequests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const activities = getMyActivity();

  return (
    <div className="page active">
      
      {/* Cancel Modal (Glassmorphism & Premium UI) */}
      {cancelAct && (
        <div className="modal-bg" style={{ zIndex: 4000 }}>
          <div className="modal-box" style={{ maxWidth: '400px', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head">
              <div className="modal-title" style={{ color: 'var(--r2)' }}>⚠️ Cancel {cancelAct.type}</div>
              <button className="x-btn" onClick={() => setCancelAct(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--txt1)', marginBottom: '16px' }}>
              Are you sure you want to cancel this {cancelAct.type.toLowerCase()}? Please specify a reason so we can maintain community trust.
            </p>
            <div className="fg">
              <label>Reason for Cancellation</label>
              <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} style={{ marginBottom: '10px' }}>
                <option value="">-- Select a reason --</option>
                <option value="Food spoiled/unusable">Food spoiled or unusable</option>
                <option value="No longer available">No longer available</option>
                <option value="Made a mistake">Made a mistake</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setCancelAct(null)}>Keep it</button>
              <button className="btn" style={{ flex: 1, background: 'var(--r2)', color: '#fff' }} onClick={handleCancelConfirm} disabled={isCancelling}>
                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {chatPartner && (
        <P2PChatModal 
          partner={chatPartner} 
          partnerRole={chatPartnerRole} 
          currentUser={appState.name || ''} 
          currentUserRole={chatActivity.myRole}
          activity={chatActivity}
          onClose={() => { setChatPartner(null); setChatActivity(null); }} 
          db={db}
          syncDatabase={syncDatabase}
        />
      )}

      <div className="dash-wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="sec-title" style={{ margin: 0 }}>My Live Activity</h2>
        </div>
        
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-head">
            <h3>My Donations & Requests</h3>
            <button className="btn btn-sm btn-outline" onClick={handleRefresh} disabled={loading}>
              {loading ? '🔄 Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
          <div className="card-body table-responsive" style={{ padding: 0 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Food</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Partner</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr><td colSpan="6" className="empty">No activity found.</td></tr>
                ) : (
                  activities.map((act, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`badge ${act.type === 'Donation' ? 'bg-g' : 'bg-y'}`}>{act.type}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{act.food_name}</td>
                      <td>{act.quantity || act.qty}</td>
                      <td>
                        <span className="badge" style={{ background: 'var(--border)', color: 'var(--txt1)' }}>
                          {act.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                           {act.partnerRole && (
                              <div style={{ 
                                width: '8px', height: '8px', borderRadius: '50%', 
                                background: act.partnerRole === 'donor' ? '#10b981' : (act.partnerRole === 'volunteer' ? '#fb923c' : '#3b82f6')
                              }}></div>
                           )}
                           {act.partner}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {act.partner !== '—' && act.status !== 'completed' && (
                            <button 
                              className="btn btn-sm btn-outline" 
                              onClick={() => {
                                setChatPartner(act.partner);
                                setChatPartnerRole(act.partnerRole);
                                setChatActivity(act);
                              }}
                              style={{ borderColor: 'var(--g2)', color: 'var(--g2)' }}
                            >
                              💬 Chat
                            </button>
                          )}
                          {act.action !== '—' && (
                            <button 
                              className="btn btn-sm" 
                              style={{ background: '#fee2e2', color: '#dc2626', transition: 'all 0.2s' }}
                              onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                              onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                              onClick={() => setCancelAct(act)}
                            >
                              {act.action}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
