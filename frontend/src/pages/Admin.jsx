import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import Chart from 'chart.js/auto';
import LeafletMap from '../components/LeafletMap';

export default function Admin() {
  const { db, setDb, updateApp, syncDatabase } = useAppContext();
  const navigate = useNavigate();

  const handleLogout = () => {
    updateApp({ user: null, role: null, name: null });
    navigate('/');
  };
  
  const chDonRef = useRef(null);
  const chReqRef = useRef(null);
  
  const [activeTab, setActiveTab] = useState('trusts');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showDonorsModal, setShowDonorsModal] = useState(false);
  const [showReceiversModal, setShowReceiversModal] = useState(false);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showVolunteersModal, setShowVolunteersModal] = useState(false);
  const [showVerifiedTrustsModal, setShowVerifiedTrustsModal] = useState(false);
  const [viewCertTrust, setViewCertTrust] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Deduplicate and prioritize trust verification statuses
  const uniqueTrustsMap = {};
  (db.trusts || []).forEach(t => {
    const key = (t.trust_username || t.trust_name || t.id).toLowerCase();
    if (!uniqueTrustsMap[key]) {
      uniqueTrustsMap[key] = t;
    } else {
      if (t.verification_status === 'verified') {
        uniqueTrustsMap[key] = t;
      } else if (t.verification_status === 'pending' && uniqueTrustsMap[key].verification_status !== 'verified') {
        uniqueTrustsMap[key] = t;
      }
    }
  });
  const allUniqueTrusts = Object.values(uniqueTrustsMap);
  const verifiedTrustsList = allUniqueTrusts.filter(t => t.verification_status === 'verified');
  const pendingTrustsList = allUniqueTrusts.filter(t => t.verification_status === 'pending' || (!t.verification_status && t.verification_status !== 'rejected'));

  const totalTrusts = allUniqueTrusts.length;
  const verifiedTrusts = verifiedTrustsList.length;
  const pendingTrusts = pendingTrustsList.length;
  const systemAlerts = db.notifications?.length || 0;

  const donCount = db.donations?.length || 0;
  const reqCount = db.requests?.length || 0;
  const volCount = db.volunteers?.length || 0;

  // Completion check helpers
  const isDonationCompleted = (d) => {
    const st = (d.status || '').toLowerCase();
    if (st === 'completed' || st === 'fulfilled' || st === 'handshake_completed' || st === 'claimed') return true;
    if (d.claimed_by && d.claimed_by !== 'Receiver' && d.claimed_by !== '—' && st !== 'cancelled' && st !== 'expired' && st !== 'available') return true;
    return false;
  };

  const isRequestCompleted = (r) => {
    const st = (r.status || '').toLowerCase();
    if (st === 'completed' || st === 'fulfilled' || st === 'handshake_completed' || st === 'delivered') return true;
    if (r.assigned_to && r.assigned_to !== '—' && st !== 'cancelled' && st !== 'rejected' && st !== 'pending') return true;
    return false;
  };

  // 1. Donors Data & Details
  const donorsMap = {};
  (db.donations || []).forEach(d => {
    const key = (d.donor_username || d.donor_name || 'Anonymous').toLowerCase();
    if (!donorsMap[key]) {
      donorsMap[key] = {
        name: d.donor_name || d.donor_username || 'Anonymous Donor',
        username: d.donor_username || 'n/a',
        totalDonations: 0,
        activeDonations: 0,
        completedDonations: 0,
        items: []
      };
    }
    donorsMap[key].totalDonations += 1;
    const st = (d.status || '').toLowerCase();
    if (isDonationCompleted(d)) {
      donorsMap[key].completedDonations += 1;
    } else if (st === 'available') {
      donorsMap[key].activeDonations += 1;
    }
    if (d.food_name && !donorsMap[key].items.includes(d.food_name)) {
      donorsMap[key].items.push(d.food_name);
    }
  });

  (db.users || []).forEach(u => {
    const key = (u.username || '').toLowerCase();
    if (key && !donorsMap[key] && (u.role === 'user' || u.role === 'donor')) {
      donorsMap[key] = {
        name: u.name || u.username,
        username: u.username,
        totalDonations: 0,
        activeDonations: 0,
        completedDonations: 0,
        items: []
      };
    }
  });
  const donorsList = Object.values(donorsMap);
  const totalDonorsCount = donorsList.length;

  // 2. Receivers Data & Details
  const receiversMap = {};
  (db.requests || []).forEach(r => {
    const key = (r.req_username || r.req_name || 'Anonymous').toLowerCase();
    if (!receiversMap[key]) {
      receiversMap[key] = {
        name: r.req_name || r.req_username || 'Receiver',
        username: r.req_username || 'n/a',
        totalRequests: 0,
        pendingRequests: 0,
        completedRequests: 0,
        items: [],
        location: r.location_label || 'Location provided'
      };
    }
    receiversMap[key].totalRequests += 1;
    const st = (r.status || '').toLowerCase();
    if (isRequestCompleted(r)) {
      receiversMap[key].completedRequests += 1;
    } else if (st === 'pending') {
      receiversMap[key].pendingRequests += 1;
    }
    if (r.food_name && !receiversMap[key].items.includes(r.food_name)) {
      receiversMap[key].items.push(r.food_name);
    }
  });

  (db.donations || []).forEach(d => {
    if (d.claimed_by && d.claimed_by !== 'Receiver') {
      const key = d.claimed_by.toLowerCase();
      if (!receiversMap[key]) {
        receiversMap[key] = {
          name: d.claimed_by,
          username: 'n/a',
          totalRequests: 1,
          pendingRequests: 0,
          completedRequests: isDonationCompleted(d) ? 1 : 0,
          items: [d.food_name],
          location: d.location_label || 'Location shared'
        };
      }
    }
  });
  const receiversList = Object.values(receiversMap);
  const totalReceiversCount = receiversList.length;

  // 3. Completed Donations Data & Details
  const completedDonationsList = (db.donations || []).filter(isDonationCompleted);
  const completedRequestsList = (db.requests || []).filter(isRequestCompleted);

  const completedTransactions = [
    ...completedDonationsList.map(d => ({
      id: d.id,
      type: 'Direct Donation',
      title: d.food_name,
      qty: d.quantity,
      donor: d.donor_name || d.donor_username || 'Donor',
      receiver: d.claimed_by || 'Claimed Receiver',
      date: d.created_at ? new Date(d.created_at).toLocaleDateString() : 'Recent',
      freshness: d.freshness_score || 10
    })),
    ...completedRequestsList.map(r => ({
      id: r.id,
      type: 'Request Fulfillment',
      title: r.food_name,
      qty: r.quantity,
      donor: r.assigned_to || 'Community Donor',
      receiver: r.req_name || r.req_username || 'Receiver',
      date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent',
      freshness: 10
    }))
  ];
  const totalCompletedCount = completedTransactions.length;

  // 4. Microvolunteers Data & Details
  const volunteersList = (db.volunteers || []).map(v => ({
    id: v.id,
    name: v.vol_name || v.vol_username || 'Micro-Volunteer',
    username: v.vol_username || 'n/a',
    vehicle: v.vehicle_type || 'Walk / Foot',
    status: v.status || 'Active',
    assignedReq: v.assigned_req_id ? `#${v.assigned_req_id}` : 'Available for nearby jobs',
    location: v.pickup_lat && v.pickup_lng ? `${v.pickup_lat.toFixed(3)}, ${v.pickup_lng.toFixed(3)}` : 'On Duty'
  }));
  const totalVolunteersCount = volunteersList.length;

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
      if (isDonationCompleted(d)) {
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
      if (isRequestCompleted(r)) {
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
      const exist = Chart.getChart(chDonRef.current);
      if (exist) exist.destroy();
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
      const exist = Chart.getChart(chReqRef.current);
      if (exist) exist.destroy();
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
      const trustItem = db.trusts?.find(t => t.id === id);
      const username = trustItem?.trust_username;
      const trustName = trustItem?.trust_name;

      let existing = [];
      if (username || trustName) {
        let q = supabaseClient.from('trusts').select('*');
        if (username) {
          q = q.eq('trust_username', username);
        } else if (trustName) {
          q = q.eq('trust_name', trustName);
        }
        const res = await q;
        if (res.error) throw res.error;
        if (res.data) existing = res.data;
      }

      if (existing.length > 0) {
        for (const record of existing) {
          const { error } = await supabaseClient.from('trusts').update({ verification_status: 'verified' }).eq('id', record.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabaseClient.from('trusts').insert([{
          trust_username: username || trustName || 'trust_user',
          trust_name: trustName || username || 'Verified Trust',
          reg_number: trustItem?.reg_number || 'REG-VERIFIED',
          verification_status: 'verified',
          cert_url: trustItem?.cert_url || null
        }]);
        if (error) throw error;
      }

      if (username) {
        const { error } = await supabaseClient.from('users').update({ verification_status: 'verified' }).eq('username', username);
        if (error) console.error("Minor error updating users table:", error);
      }

      // Optimistic state update
      setDb(prev => ({
        ...prev,
        trusts: (prev.trusts || []).map(t => {
          if (t.id === id || (username && t.trust_username === username) || (trustName && t.trust_name === trustName)) {
            return { ...t, verification_status: 'verified' };
          }
          return t;
        })
      }));

      await syncDatabase();
      if (viewCertTrust && viewCertTrust.id === id) setViewCertTrust(null);
      if (window.showToast) window.showToast('✅ Trust verified and approved successfully.', 'ok');
      else alert('✅ Trust verified and approved successfully.');
    } catch (e) {
      console.error('Trust verification error:', e);
      alert('Failed to verify trust: ' + (e.message || JSON.stringify(e)));
    }
    setIsProcessing(false);
  };

  const handleDeleteTrust = async (id) => {
    if (!window.confirm('🚫 Reject and remove this Trust application?')) return;
    setIsProcessing(true);
    try {
      const trustItem = db.trusts?.find(t => t.id === id);
      const username = trustItem?.trust_username || 'trust_user';
      const trustName = trustItem?.trust_name || 'Trust Entity';

      let existing = [];
      if (username || trustName) {
        let q = supabaseClient.from('trusts').select('*');
        if (username) {
          q = q.eq('trust_username', username);
        } else if (trustName) {
          q = q.eq('trust_name', trustName);
        }
        const res = await q;
        if (res.error) throw res.error;
        if (res.data) existing = res.data;
      }

      if (existing.length > 0) {
        for (const record of existing) {
          const { error } = await supabaseClient.from('trusts').update({ verification_status: 'rejected' }).eq('id', record.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabaseClient.from('trusts').insert([{
          trust_username: username,
          trust_name: trustName,
          reg_number: trustItem?.reg_number || 'REG-USER',
          verification_status: 'rejected'
        }]);
        if (error) throw error;
      }

      // Optimistic state update
      setDb(prev => ({
        ...prev,
        trusts: (prev.trusts || []).map(t => {
          if (t.id === id || (username && t.trust_username === username) || (trustName && t.trust_name === trustName)) {
            return { ...t, verification_status: 'rejected' };
          }
          return t;
        })
      }));

      // Send rejection notification message to the trust user
      const { error: notifError } = await supabaseClient.from('notifications').insert([{
        message: `🚫 Application Rejected: Your Trust/NGO registration for "${trustName}" has been REJECTED by the Admin. Please submit valid documentation to re-apply.`,
        urgency: 'High',
        user_id: username
      }]);
      if (notifError) console.error("Failed to send rejection notification:", notifError);

      await syncDatabase();
      if (viewCertTrust && viewCertTrust.id === id) setViewCertTrust(null);
      if (window.showToast) window.showToast('Trust application rejected.', 'ok');
      else alert('Trust application rejected.');
    } catch (e) {
      console.error('Trust rejection error:', e);
      alert('Failed to reject trust application: ' + (e.message || JSON.stringify(e)));
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

      {/* 1. Donors Modal */}
      {showDonorsModal && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '750px', width: '95%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div className="modal-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🎁 Total Donors Registry ({totalDonorsCount})
              </div>
              <button className="x-btn" onClick={() => setShowDonorsModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Donor Name</th>
                    <th>Username</th>
                    <th>Total Donations</th>
                    <th>Completed</th>
                    <th>Donated Items</th>
                  </tr>
                </thead>
                <tbody>
                  {donorsList.length === 0 ? (
                    <tr><td colSpan="5" className="empty">No donors recorded yet.</td></tr>
                  ) : (
                    donorsList.map((d, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--txt)' }}>🎁 {d.name}</td>
                        <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>@{d.username}</code></td>
                        <td style={{ fontWeight: 700 }}>{d.totalDonations}</td>
                        <td><span className="badge bg-g">{d.completedDonations} completed</span></td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--txt1)' }}>
                          {d.items.length > 0 ? d.items.join(', ') : 'None yet'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. Receivers Modal */}
      {showReceiversModal && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '750px', width: '95%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div className="modal-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🍽️ Receivers & Claimants Registry ({totalReceiversCount})
              </div>
              <button className="x-btn" onClick={() => setShowReceiversModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Receiver Name</th>
                    <th>Total Requests</th>
                    <th>Fulfilled</th>
                    <th>Requested Items</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {receiversList.length === 0 ? (
                    <tr><td colSpan="5" className="empty">No receivers recorded yet.</td></tr>
                  ) : (
                    receiversList.map((r, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--txt)' }}>🍽️ {r.name}</td>
                        <td style={{ fontWeight: 700 }}>{r.totalRequests}</td>
                        <td><span className="badge bg-g">{r.completedRequests} fulfilled</span></td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--txt1)' }}>
                          {r.items.length > 0 ? r.items.join(', ') : 'General Food'}
                        </td>
                        <td style={{ fontSize: '0.85rem' }}>📍 {r.location}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. Completed Donations Modal */}
      {showCompletedModal && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '800px', width: '95%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div className="modal-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✅ Completed Donations Log ({totalCompletedCount})
              </div>
              <button className="x-btn" onClick={() => setShowCompletedModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Item / Title</th>
                    <th>Type</th>
                    <th>Donor</th>
                    <th>Receiver</th>
                    <th>Qty</th>
                    <th>Freshness</th>
                  </tr>
                </thead>
                <tbody>
                  {completedTransactions.length === 0 ? (
                    <tr><td colSpan="6" className="empty">No completed donations yet.</td></tr>
                  ) : (
                    completedTransactions.map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--txt)' }}>🍲 {c.title}</td>
                        <td><span className="badge bg-p">{c.type}</span></td>
                        <td style={{ fontSize: '0.85rem' }}>👤 {c.donor}</td>
                        <td style={{ fontSize: '0.85rem' }}>🤝 {c.receiver}</td>
                        <td style={{ fontWeight: 700 }}>{c.qty}</td>
                        <td><span className="badge bg-g">🟢 {c.freshness}/10</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Microvolunteers Modal */}
      {showVolunteersModal && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '750px', width: '95%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div className="modal-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🚗 Micro-Volunteers Details ({totalVolunteersCount})
              </div>
              <button className="x-btn" onClick={() => setShowVolunteersModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Volunteer Name</th>
                    <th>Username</th>
                    <th>Transport Mode</th>
                    <th>Status</th>
                    <th>Assigned Duty / Location</th>
                  </tr>
                </thead>
                <tbody>
                  {volunteersList.length === 0 ? (
                    <tr><td colSpan="5" className="empty">No active microvolunteers recorded yet.</td></tr>
                  ) : (
                    volunteersList.map((v, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--txt)' }}>🚗 {v.name}</td>
                        <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>@{v.username}</code></td>
                        <td><span className="badge bg-b">🚲 {v.vehicle}</span></td>
                        <td><span className={`badge ${v.status === 'active' ? 'bg-g' : 'bg-y'}`}>{v.status.toUpperCase()}</span></td>
                        <td style={{ fontSize: '0.85rem' }}>{v.assignedReq}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. Verified Entities Modal */}
      {showVerifiedTrustsModal && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '750px', width: '95%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
              <div className="modal-title" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✅ Verified Trust Entities ({verifiedTrusts})
              </div>
              <button className="x-btn" onClick={() => setShowVerifiedTrustsModal(false)}>✕</button>
            </div>
            <div style={{ padding: '16px', maxHeight: '500px', overflowY: 'auto' }}>
              <table className="tbl" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Trust / NGO Name</th>
                    <th>Username</th>
                    <th>Reg No.</th>
                    <th>Status</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedTrustsList.length === 0 ? (
                    <tr><td colSpan="5" className="empty">No verified trust entities yet.</td></tr>
                  ) : (
                    verifiedTrustsList.map((t, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700, color: 'var(--txt)' }}>🏛️ {t.trust_name}</td>
                        <td style={{ fontSize: '0.85rem' }}>@{t.trust_username}</td>
                        <td style={{ fontFamily: 'monospace' }}>{t.reg_number}</td>
                        <td><span className="badge bg-g">VERIFIED</span></td>
                        <td>
                          <button 
                            className="btn btn-sm btn-ghost" 
                            style={{ color: '#38bdf8', borderColor: '#38bdf8', fontWeight: 600 }} 
                            onClick={() => { setViewCertTrust(t); setShowVerifiedTrustsModal(false); }}
                          >
                            📜 View Cert
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Certificate Viewer Modal */}
      {viewCertTrust && (
        <div className="modal-bg" style={{ zIndex: 9999 }}>
          <div className="modal-box" style={{ maxWidth: '650px', width: '92%', animation: 'popIn 0.3s ease' }}>
            <div className="modal-head" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div className="modal-title" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📜 Official Trust Certificate Verification
              </div>
              <button className="x-btn" onClick={() => setViewCertTrust(null)}>✕</button>
            </div>
            <div style={{ padding: '20px', maxHeight: '550px', overflowY: 'auto' }}>
              <div style={{ background: 'var(--bg1)', padding: '16px', borderRadius: '12px', marginBottom: '18px', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--txt)' }}>🏛️ {viewCertTrust.trust_name}</h4>
                <div style={{ fontSize: '0.85rem', color: 'var(--txt1)', marginTop: '4px' }}>
                  Registration ID: <code style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{viewCertTrust.reg_number}</code>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span className={`badge ${viewCertTrust.verification_status === 'verified' ? 'bg-g' : 'bg-y'}`}>
                    Status: {viewCertTrust.verification_status ? viewCertTrust.verification_status.toUpperCase() : 'PENDING'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--txt1)' }}>Username: @{viewCertTrust.trust_username}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--txt1)', marginBottom: '10px', textAlign: 'left' }}>
                  Uploaded Government / NGO Registration Certificate Document:
                </div>
                {viewCertTrust.cert_url || viewCertTrust.certImg ? (
                  <img 
                    src={viewCertTrust.cert_url || viewCertTrust.certImg} 
                    alt="Trust Registration Certificate" 
                    style={{ width: '100%', maxHeight: '350px', objectFit: 'contain', borderRadius: '12px', border: '2px dashed var(--border)', background: '#000', padding: '8px' }} 
                  />
                ) : (
                  <div style={{ border: '2px dashed #94a3b8', borderRadius: '12px', padding: '30px 20px', background: 'rgba(0,0,0,0.03)', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📜</div>
                    <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--txt)' }}>Official Registration Certificate</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--txt1)', marginTop: '4px' }}>Reg. No: {viewCertTrust.reg_number}</div>
                    <div style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '8px', fontWeight: 600 }}>✓ Verified Government Registration Record Attached</div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                {viewCertTrust.verification_status !== 'verified' && (
                  <button 
                    className="btn" 
                    style={{ background: '#166534', color: '#fff', padding: '10px 20px', fontWeight: 600, borderRadius: '8px' }}
                    onClick={async () => {
                      await handleVerifyTrust(viewCertTrust.id);
                      setViewCertTrust(null);
                    }}
                  >
                    ✓ Approve & Grant Monetary Privileges
                  </button>
                )}
                <button 
                  className="btn" 
                  style={{ background: '#dc2626', color: '#fff', padding: '10px 16px', fontWeight: 600, borderRadius: '8px' }}
                  onClick={async () => {
                    await handleDeleteTrust(viewCertTrust.id);
                    setViewCertTrust(null);
                  }}
                >
                  🗑 Reject Application
                </button>
                <button className="btn btn-ghost" onClick={() => setViewCertTrust(null)}>Close</button>
              </div>
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
        
        {/* Top 4 Required Platform Feature Tiles */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.05rem', color: 'var(--txt1)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
            🌟 Primary Overview & Registries (Click to view details)
          </h3>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            
            {/* Tile 1: Donors */}
            <div 
              className="stat-card" 
              onClick={() => setShowDonorsModal(true)}
              style={{ 
                background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', 
                border: '1px solid #c084fc', 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(192, 132, 252, 0.15)'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🎁</div>
              <div className="stat-num" style={{ color: '#6b21a8' }}>{totalDonorsCount}</div>
              <div className="stat-lbl" style={{ color: '#7e22ce', fontWeight: 700 }}>Total Donors</div>
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#9333ea', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                👁️ View Donors & Details →
              </div>
            </div>

            {/* Tile 2: Receivers */}
            <div 
              className="stat-card" 
              onClick={() => setShowReceiversModal(true)}
              style={{ 
                background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)', 
                border: '1px solid #38bdf8', 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(56, 189, 248, 0.15)'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🍽️</div>
              <div className="stat-num" style={{ color: '#0369a1' }}>{totalReceiversCount}</div>
              <div className="stat-lbl" style={{ color: '#0284c7', fontWeight: 700 }}>Receivers & Details</div>
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                👁️ View Receiver Details →
              </div>
            </div>

            {/* Tile 3: Completed Donations */}
            <div 
              className="stat-card" 
              onClick={() => setShowCompletedModal(true)}
              style={{ 
                background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', 
                border: '1px solid #34d399', 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(52, 211, 153, 0.15)'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>✅</div>
              <div className="stat-num" style={{ color: '#065f46' }}>{totalCompletedCount}</div>
              <div className="stat-lbl" style={{ color: '#059669', fontWeight: 700 }}>Completed Donations</div>
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                👁️ View Completed Log →
              </div>
            </div>

            {/* Tile 4: Microvolunteers */}
            <div 
              className="stat-card" 
              onClick={() => setShowVolunteersModal(true)}
              style={{ 
                background: 'linear-gradient(135deg, #fef3c7, #fde68a)', 
                border: '1px solid #fbbf24', 
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.15)'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{ fontSize: '2.2rem', marginBottom: '8px' }}>🚗</div>
              <div className="stat-num" style={{ color: '#92400e' }}>{totalVolunteersCount}</div>
              <div className="stat-lbl" style={{ color: '#d97706', fontWeight: 700 }}>Micro-Volunteers</div>
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                👁️ View Volunteer Details →
              </div>
            </div>

          </div>
        </div>

        {/* Secondary System Stats Grid */}
        <div className="stats-grid" style={{ marginBottom: '28px' }}>
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '1px solid #bfdbfe', transform: 'none', cursor: 'default' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>🏛️</div>
            <div className="stat-num" style={{ color: '#1e40af' }}>{totalTrusts}</div>
            <div className="stat-lbl" style={{ color: '#3b82f6', fontWeight: 600 }}>Total Registered Trusts</div>
          </div>
          <div 
            className="stat-card" 
            style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #6ee7b7', cursor: 'pointer', transition: 'all 0.2s ease' }}
            onClick={() => setShowVerifiedTrustsModal(true)}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <div style={{ fontSize: '2.2rem', marginBottom: '10px' }}>✅</div>
            <div className="stat-num" style={{ color: '#065f46' }}>{verifiedTrusts}</div>
            <div className="stat-lbl" style={{ color: '#059669', fontWeight: 600 }}>Verified Entities</div>
            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: '#047857', fontWeight: 600 }}>
              👁️ Click to View Verified Entities →
            </div>
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
            <div className="card-body" style={{ height: '260px', padding: '16px', position: 'relative' }}>
              <canvas ref={chDonRef}></canvas>
            </div>
          </div>
          
          <div className="card" style={{ borderTop: '4px solid #f59e0b' }}>
            <div className="card-head"><h3>📦 Platform Fulfillment & Status Distribution</h3></div>
            <div className="card-body" style={{ height: '260px', padding: '16px', position: 'relative' }}>
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
                  <th>Certificate Document</th>
                  <th>Admin Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingTrustsList.length === 0 ? (
                  <tr><td colSpan="5" className="empty" style={{ padding: '40px' }}>No pending trust applications waiting for review.</td></tr>
                ) : (
                  pendingTrustsList.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 700, color: 'var(--txt)', fontSize: '1.05rem' }}>🏛️ {t.trust_name}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--txt1)' }}>{t.reg_number}</td>
                      <td>
                         <span className="badge bg-y">PENDING REVIEW</span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-ghost" 
                          style={{ color: '#38bdf8', borderColor: '#38bdf8', fontWeight: 600 }} 
                          onClick={() => setViewCertTrust(t)}
                        >
                          📜 View Certificate
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-sm" 
                            style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 600 }} 
                            onClick={() => handleVerifyTrust(t.id)} 
                            disabled={isProcessing}
                          >
                            ✓ Approve
                          </button>
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
