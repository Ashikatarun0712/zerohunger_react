import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../store/AppContext';
import P2PChatModal from '../components/P2PChatModal';

export default function Activity() {
  const { db, appState, syncDatabase } = useAppContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [chatPartner, setChatPartner] = useState(null);
  const [chatPartnerRole, setChatPartnerRole] = useState(null);

  const handleRefresh = async () => {
    setLoading(true);
    await syncDatabase();
    setLoading(false);
  };

  const getMyActivity = () => {
    const un = appState.name?.toLowerCase() || '';
    const myDonations = db.donations
      .filter(d => (d.donor_name || '').toLowerCase() === un)
      .map(d => ({ 
        ...d, 
        type: 'Donation', 
        partner: d.claimed_by || '—',
        partnerRole: d.claimed_by ? 'receiver' : null,
        action: d.status === 'available' ? 'Cancel' : '—' 
      }));
    
    const myRequests = db.requests
      .filter(r => (r.requester_name || '').toLowerCase() === un)
      .map(r => ({ 
        ...r, 
        type: 'Request', 
        food_name: r.food_name, 
        qty: r.quantity || 0, 
        status: r.status, 
        partner: r.assigned_to || '—', 
        partnerRole: r.assigned_to ? (db.volunteers.some(v => v.vol_name === r.assigned_to) ? 'volunteer' : 'donor') : null,
        action: r.status === 'pending' ? 'Cancel' : '—' 
      }));

    return [...myDonations, ...myRequests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const activities = getMyActivity();

  return (
    <div className="page active">
      
      {chatPartner && (
        <P2PChatModal 
          partner={chatPartner} 
          partnerRole={chatPartnerRole} 
          currentUser={appState.name || ''} 
          onClose={() => setChatPartner(null)} 
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
                          {act.partner !== '—' && (
                            <button 
                              className="btn btn-sm btn-outline" 
                              onClick={() => {
                                setChatPartner(act.partner);
                                setChatPartnerRole(act.partnerRole);
                              }}
                              style={{ borderColor: 'var(--g2)', color: 'var(--g2)' }}
                            >
                              💬 Chat
                            </button>
                          )}
                          {act.action !== '—' && (
                            <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
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
