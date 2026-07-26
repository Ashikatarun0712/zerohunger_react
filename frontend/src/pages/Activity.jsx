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

  // Rating Modal State
  const [ratingAct, setRatingAct] = useState(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingReview, setRatingReview] = useState('');
  const [isRating, setIsRating] = useState(false);

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
      
      const { error } = await supabaseClient
        .from(table)
        .update({ status: 'cancelled' })
        .eq('id', cancelAct.id);
        
      if (error) throw error;
      
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

  const handleMarkComplete = (act) => {
    setRatingAct(act);
    setRatingValue(5);
    setRatingReview('');
  };

  const handleRatingSubmit = async () => {
    setIsRating(true);
    try {
      const act = ratingAct;
      const table = act.type === 'Donation' ? 'donations' : 'requests';
      
      // Update status
      await supabaseClient.from(table).update({ status: 'completed' }).eq('id', act.id);
      if (act.donation_id) {
        await supabaseClient.from('donations').update({ status: 'completed' }).eq('id', act.donation_id).catch(() => {});
      }
      
      // Submit Rating if applicable
      if (act.partner && act.partner !== '—') {
        const ratingPayload = {
          target_username: act.partner,
          score: ratingValue,
          review: ratingReview,
          category: act.myRole || 'community'
        };
        await supabaseClient.from('ratings').insert([ratingPayload]);
      }
      
      await syncDatabase();
      if (window.showToast) window.showToast("🤝 Activity marked as completed & rated!", "ok");
      setRatingAct(null);
    } catch (e) {
      console.error(e);
      alert("Failed to complete transaction.");
    } finally {
      setIsRating(false);
    }
  };

  const getMyActivity = () => {
    const un = (appState.user || '').toLowerCase();
    const unName = (appState.name || '').toLowerCase();

    const myDonations = (db.donations || [])
      .filter(d => {
        const du = (d.donor_username || '').toLowerCase();
        const dn = (d.donor_name || '').toLowerCase();
        const cb = (d.claimed_by || '').toLowerCase();
        return (un && (du === un || dn === un || cb === un)) || (unName && (du === unName || dn === unName || cb === unName));
      })
      .map(d => {
        const du = (d.donor_username || '').toLowerCase();
        const dn = (d.donor_name || '').toLowerCase();
        const isMine = du === un || dn === un || (unName && (du === unName || dn === unName));
        const linkedReq = (db.requests || []).find(rq => rq.donation_id === d.id);
        const isPartnerTrust = linkedReq && linkedReq.priority_score === 90;
        return { 
          ...d, 
          type: 'Donation', 
          partner: isMine ? (d.claimed_by || '—') : (d.donor_name || d.donor_username || '—'),
          partnerRole: isMine ? (d.claimed_by ? (isPartnerTrust ? 'trust' : 'receiver') : null) : 'donor',
          myRole: isMine ? 'donor' : (isPartnerTrust ? 'trust' : 'receiver'),
          action: (isMine && d.status === 'available') ? 'Cancel' : '—' 
        };
      });
    
    const myRequests = (db.requests || [])
      .filter(r => {
        const ru = (r.req_username || '').toLowerCase();
        const rn = (r.req_name || '').toLowerCase();
        const at = (r.assigned_to || '').toLowerCase();
        return (un && (ru === un || rn === un || at === un)) || (unName && (ru === unName || rn === unName || at === unName));
      })
      .map(r => {
        const ru = (r.req_username || '').toLowerCase();
        const rn = (r.req_name || '').toLowerCase();
        const isMine = ru === un || rn === un || (unName && (ru === unName || rn === unName));
        const isTrust = r.priority_score === 90;
        return { 
          ...r, 
          type: 'Request', 
          food_name: r.food_name, 
          qty: r.quantity || 0, 
          status: r.status, 
          partner: isMine ? (r.assigned_to || '—') : (r.req_name || r.req_username || '—'), 
          partnerRole: isMine 
            ? (r.assigned_to ? ((db.volunteers || []).some(v => v.vol_name === r.assigned_to || v.vol_username === r.assigned_to) ? 'volunteer' : 'donor') : null) 
            : (isTrust ? 'trust' : 'receiver'),
          myRole: isMine ? (isTrust ? 'trust' : 'receiver') : ((db.volunteers || []).some(v => v.vol_name === appState.name || v.vol_username === appState.user) ? 'volunteer' : 'donor'),
          action: (isMine && r.status === 'pending') ? 'Cancel' : '—' 
        };
      });

    return [...myDonations, ...myRequests]
      .filter(act => act.status !== 'completed' && act.status !== 'expired' && act.status !== 'cancelled')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const activities = getMyActivity();

  return (
    <div className="page active">
      
      {/* Rating & Completion Modal */}
      {ratingAct && (
        <div className="modal-bg" style={{ zIndex: 4000 }}>
          <div className="modal-box" style={{ maxWidth: '400px', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head">
              <div className="modal-title" style={{ color: 'var(--g1)' }}>🌟 Rate & Complete</div>
              <button className="x-btn" onClick={() => setRatingAct(null)}>✕</button>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--txt1)', marginBottom: '16px' }}>
              You are about to mark this transaction as completed. How was your experience with <strong>{ratingAct.partner}</strong>?
            </p>
            
            <div className="fg" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', display: 'flex', justifyContent: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <span 
                    key={star} 
                    onClick={() => setRatingValue(star)}
                    style={{ color: star <= ratingValue ? '#fbbf24' : 'var(--border)', transition: 'color 0.2s' }}
                  >
                    ★
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--txt2)' }}>{ratingValue} out of 5 stars</div>
            </div>
            
            <div className="fg">
              <label>Leave a review (optional)</label>
              <textarea 
                value={ratingReview} 
                onChange={e => setRatingReview(e.target.value)}
                placeholder="Great communication, very helpful..."
                style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--txt)', resize: 'none' }}
              ></textarea>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setRatingAct(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, background: '#10b981', color: '#fff', borderColor: '#10b981' }} onClick={handleRatingSubmit} disabled={isRating}>
                {isRating ? 'Submitting...' : 'Submit & Complete'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                                background: act.partnerRole === 'donor' ? '#10b981' : (act.partnerRole === 'volunteer' ? '#fb923c' : (act.partnerRole === 'trust' ? '#eab308' : '#3b82f6'))
                              }}></div>
                           )}
                           {act.partner}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {act.status !== 'completed' && (
                            <button 
                              className="btn btn-sm" 
                              style={{ background: '#dcfce7', color: '#15803d', fontWeight: 600, border: '1px solid #bbf7d0', cursor: 'pointer' }}
                              onClick={() => handleMarkComplete(act)}
                            >
                              🤝 Complete
                            </button>
                          )}
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
