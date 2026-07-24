import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import { analyzeCertificate } from '../utils/aiEngine';
export default function Trust() {
  const { db, appState, syncDatabase } = useAppContext();
  const navigate = useNavigate();
  const fileInputRef = React.useRef(null);

  const [isVerified, setIsVerified] = useState(false);
  const [trustDoc, setTrustDoc] = useState(null);
  const [reqType, setReqType] = useState('food');
  const [formData, setFormData] = useState({
    treq_item_name: '',
    treq_food_qty: '',
    treq_loc: '',
    treq_fund_amount: '',
    treq_fund_purpose: '',
    treq_fund_upi: ''
  });
  
  const [certImg, setCertImg] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const currentTrust = db.trusts?.find(t => (t.trust_username === appState.user || t.trust_name === appState.name));
    if (currentTrust) {
      setTrustDoc(currentTrust);
      if (currentTrust.verification_status === 'verified') {
        setIsVerified(true);
      }
    }
  }, [db.trusts, appState.user, appState.name]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const doCertUpload = (file) => {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = (ev) => {
      setCertImg(ev.target.result);
      setIsVerified(false);
    };
    rd.readAsDataURL(file);
  };

  const autoFillLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setFormData(prev => ({ ...prev, treq_loc: 'Detecting...' }));

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`, {
          headers: { 'User-Agent': 'ZeroHungerP2P/1.0', 'Accept-Language': 'en' }
        });
        const data = await response.json();
        const address = data.address || {};
        const area = address.suburb || address.neighbourhood || address.residential || address.village || '';
        const city = address.city || address.town || address.county || address.state_district || '';
        const combined = area ? `${area}, ${city}` : city || 'Unknown Location';
        
        setFormData(prev => ({ ...prev, treq_loc: combined }));
      } catch (err) {
        console.error("Reverse geocoding failed", err);
        setFormData(prev => ({ ...prev, treq_loc: '' }));
        alert("Failed to detect location automatically.");
      }
    }, () => {
      setFormData(prev => ({ ...prev, treq_loc: '' }));
      alert("Unable to retrieve your location. Please check browser permissions.");
    });
  };

  const runCertVerification = async () => {
    if (!certImg) return;
    setIsVerifying(true);
    
    try {
      const result = await analyzeCertificate(certImg);
      setIsVerifying(false);
      
      if (result && result.is_valid) {
        setIsVerified(true);
        if (!trustDoc || trustDoc.verification_status !== 'verified') {
          await supabaseClient.from('trusts').insert([{
            trust_username: appState.user || 'trust_user',
            trust_name: result.trust_name || appState.name || 'Verified Trust',
            reg_number: result.registration_id || 'AI-VERIFIED',
            verification_status: 'verified'
          }]);
          syncDatabase();
        }
        alert(`Certificate Verified! Trust Name: ${result.trust_name || 'Verified'}, Reg ID: ${result.registration_id || 'N/A'}`);
      } else {
        if (!trustDoc) {
          await supabaseClient.from('trusts').insert([{
            trust_username: appState.user || 'trust_user',
            trust_name: appState.name || 'Pending Trust',
            reg_number: 'PENDING-MANUAL',
            verification_status: 'pending'
          }]);
          syncDatabase();
        }
        alert('Verification Failed or Inconclusive. Your document has been submitted for Manual Admin Verification. Please wait for an Admin to review.');
      }
    } catch {
      setIsVerifying(false);
      alert('Verification Failed due to network error.');
    }
  };

  const submitTrustRequest = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return alert('Supabase client not initialized');
    
    if (reqType === 'food' || reqType === 'material') {
      const foodName = formData.treq_item_name || 'Bulk Request';

      const payload = {
        req_username: appState.user || 'trust_user',
        req_name: appState.name || 'Trust Entity',
        food_name: foodName,
        quantity: parseInt(formData.treq_food_qty),
        location_label: formData.treq_loc,
        status: 'pending',
        urgency: 'High',
        priority_score: 90 // High priority indicates a Trust Bulk request without schema changes
      };

      const { error } = await supabaseClient.from('requests').insert([payload]);
      if (error) {
        console.error("Request insert error:", error);
        alert('Error submitting request: ' + (error.message || JSON.stringify(error)));
      } else {
        alert(`${reqType === 'food' ? 'Food' : 'Material'} request published!`);
        syncDatabase();
        setFormData({ ...formData, treq_item_name: '', treq_food_qty: '', treq_loc: '' });
      }
    } else {
      if (!isVerified) return alert('You must verify first!');
      const payload = {
        trust_username: appState.user || 'trust_user',
        trust_name: appState.name || 'Trust Entity',
        purpose: formData.treq_fund_purpose,
        amount: parseFloat(formData.treq_fund_amount),
        upi_id: formData.treq_fund_upi,
        status: 'open'
      };
      const { error } = await supabaseClient.from('fund_requests').insert([payload]);
      if (error) {
        console.error("Fund request error:", error);
        alert('Error submitting fund request: ' + (error.message || JSON.stringify(error)));
      } else {
        alert('Fund request published!');
        syncDatabase();
        setFormData({ ...formData, treq_fund_amount: '', treq_fund_purpose: '', treq_fund_upi: '' });
      }
    }
  };

  // Inline premium styles
  const premiumStyles = `
    .premium-dash { max-width: 900px; margin: 20px auto 40px; padding: 0 20px; font-family: 'Outfit', sans-serif; }
    .trust-header { display: flex; align-items: center; gap: 20px; margin-bottom: 30px; padding: 24px; background: #1e293b; border-radius: 20px; border: 1px solid #334155; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
    .trust-icon { width: 70px; height: 70px; background: linear-gradient(135deg, #fbbf24, #d97706); border-radius: 18px; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; box-shadow: 0 4px 15px rgba(217, 119, 6, 0.3); }
    .glass-card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 24px -4px rgba(0,0,0,0.3); }
    .glass-head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #334155; }
    .glass-head h3 { margin: 0; font-size: 1.3rem; font-weight: 600; color: #f8fafc; }
    .glass-input { background: #0f172a !important; border: 1px solid #334155 !important; color: #f8fafc !important; border-radius: 12px !important; padding: 12px 16px !important; width: 100%; box-sizing: border-box; }
    .glass-label { color: #94a3b8 !important; font-weight: 500 !important; margin-bottom: 8px !important; display: block; font-size: 0.9rem; }
    .premium-btn { background: linear-gradient(135deg, #38bdf8, #2563eb); border: none; color: white; padding: 14px 24px; border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer; width: 100%; }
    .upload-zone-premium { border: 2px dashed #334155; border-radius: 16px; padding: 40px 20px; text-align: center; background: #0f172a; cursor: pointer; }
  `;

  return (
    <div className="page active" style={{ background: '#0f172a', minHeight: '100vh', color: '#f8fafc', paddingBottom: '40px' }}>
      <style>{premiumStyles}</style>
      
      <div style={{ padding: '15px 20px', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center' }}>
        <button className="btn btn-sm btn-ghost" onClick={() => navigate(-1)} style={{ color: '#38bdf8', padding: 0 }}>← Back</button>
      </div>

      <div className="premium-dash">
        <div className="trust-header">
          <div className="trust-icon">🏛️</div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>Premium Trust Portal</h2>
            <div style={{ fontSize: '0.95rem', color: '#94a3b8', marginTop: '4px' }}>Verified Requester & NGO Dashboard</div>
          </div>
          <div>
            {isVerified ? (
              <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '8px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.3)' }}>✅ Verified Entity</span>
            ) : trustDoc?.verification_status === 'pending' ? (
              <span style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '8px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(56, 189, 248, 0.3)' }}>⏳ Pending Admin Verification</span>
            ) : (
              <span style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', padding: '8px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid rgba(245, 158, 11, 0.3)' }}>⚠️ Unverified Entity</span>
            )}
          </div>
        </div>

        {/* AI CERTIFICATE VERIFICATION */}
        <div className="glass-card">
          <div className="glass-head">
            <span style={{ fontSize: '1.5rem' }}>🔐</span>
            <h3>AI Document Verification</h3>
          </div>
          <div>
            <p style={{ fontSize: '.9rem', color: '#cbd5e1', marginBottom: '20px', lineHeight: 1.5 }}>
              Secure your organization's identity. Upload your official NGO/Trust registration certificate. Our AI will analyze the document authenticity instantly to unlock monetary fund requests.
            </p>
            
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => doCertUpload(e.target.files[0])} />
            <div className="upload-zone-premium" onClick={() => fileInputRef.current?.click()}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📄</div>
              <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#f8fafc' }}>Tap to upload Certificate</div>
              <div style={{ fontSize: '.8rem', color: '#64748b', marginTop: '8px' }}>Supports High-Res JPG, PNG</div>
            </div>
            
            {certImg && (
              <>
                <img src={certImg} style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '12px', marginTop: '20px', background: 'rgba(0,0,0,0.3)', padding: '10px' }} alt="Certificate" />
                {!isVerified && trustDoc?.verification_status !== 'pending' && (
                  <button className="premium-btn" style={{ marginTop: '20px', background: 'linear-gradient(135deg, #10b981, #059669)' }} onClick={runCertVerification} disabled={isVerifying}>
                    {isVerifying ? 'Scanning...' : '✨ Initialize AI Verification'}
                  </button>
                )}
                {!isVerified && trustDoc?.verification_status === 'pending' && (
                  <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    Your application is currently under manual review by an Admin.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* REQUEST NEEDS */}
        <div className="glass-card">
          <div className="glass-head">
            <span style={{ fontSize: '1.5rem' }}>📢</span>
            <h3>Publish Request (Food / Funds)</h3>
          </div>
          <div>
            <form onSubmit={submitTrustRequest}>
              <div style={{ marginBottom: '15px' }}>
                <label className="glass-label">Request Category *</label>
                <select className="glass-input" value={reqType} onChange={(e) => setReqType(e.target.value)}>
                  <option value="food">🍱 Community Food Request</option>
                  <option value="material">👕 Material / Non-Food Request</option>
                  <option value="funds">💰 Monetary Funding (Verified Only)</option>
                </select>
              </div>
              
              {reqType === 'food' || reqType === 'material' ? (
                <div id="treq-food-fields">
                  <div style={{ marginBottom: '15px' }}>
                    <label className="glass-label">{reqType === 'food' ? 'Food Requirement Details' : 'Material Requirement Details'} *</label>
                    <input type="text" name="treq_item_name" className="glass-input" placeholder={reqType === 'food' ? "e.g. 50kg Rice, Cooked Meals..." : "e.g. Blankets, Clothes, Books..."} value={formData.treq_item_name} onChange={handleInputChange} required />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label className="glass-label">Quantity / Beneficiaries *</label>
                    <input type="number" name="treq_food_qty" className="glass-input" placeholder="Units required" min="1" value={formData.treq_food_qty} onChange={handleInputChange} required />
                  </div>
                  <div style={{ marginBottom: '15px' }}>
                    <label className="glass-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                      Delivery Location *
                      <span style={{ cursor: 'pointer', color: '#38bdf8', fontSize: '0.8rem', fontWeight: 600 }} onClick={autoFillLocation}>📍 Auto Detect</span>
                    </label>
                    <input type="text" name="treq_loc" className="glass-input" placeholder="e.g. Anna Nagar, Madurai" value={formData.treq_loc} onChange={handleInputChange} required />
                  </div>
                </div>
              ) : (
                <div id="treq-fund-fields">
                  {!isVerified && (
                    <div style={{ padding: '14px', background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', fontSize: '.9rem', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>🔒</span>
                        <div>
                          <strong style={{ color: '#f87171' }}>Action Locked</strong><br/>
                          You must complete AI document verification to access monetary requests.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div style={{ opacity: isVerified ? 1 : 0.4, pointerEvents: isVerified ? 'auto' : 'none' }}>
                    <div style={{ marginBottom: '15px' }}>
                      <label className="glass-label">Amount Required (₹) *</label>
                      <input type="number" name="treq_fund_amount" className="glass-input" placeholder="e.g. 25000" value={formData.treq_fund_amount} onChange={handleInputChange} required={reqType === 'funds'} disabled={!isVerified} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label className="glass-label">Purpose of Funds *</label>
                      <input type="text" name="treq_fund_purpose" className="glass-input" placeholder="e.g. Shelter renovation & medical supplies" value={formData.treq_fund_purpose} onChange={handleInputChange} required={reqType === 'funds'} disabled={!isVerified} />
                    </div>
                    <div style={{ marginBottom: '15px' }}>
                      <label className="glass-label">Official Trust UPI ID *</label>
                      <input type="text" name="treq_fund_upi" className="glass-input" placeholder="e.g. trust@paytm" value={formData.treq_fund_upi} onChange={handleInputChange} required={reqType === 'funds'} disabled={!isVerified} />
                    </div>
                  </div>
                </div>
              )}
              
              <button type="submit" className="premium-btn" style={{ marginTop: '10px' }}>🚀 Publish Request to Network</button>
            </form>
          </div>
        </div>

        {/* INCOMING DONATIONS */}
        <div className="glass-card">
          <div className="glass-head">
            <span style={{ fontSize: '1.5rem' }}>📬</span>
            <h3>Donation & Fulfillment Status</h3>
          </div>
          <div>
            {(db.requests || []).filter(r => {
              const un = (appState.user || '').toLowerCase();
              const nameUn = (appState.name || '').toLowerCase();
              const rUser = (r.req_username || '').toLowerCase();
              const rName = (r.req_name || '').toLowerCase();
              return (un && (rUser === un || rName === un)) || (nameUn && (rUser === nameUn || rName === nameUn));
            }).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>
                <div style={{ fontSize: '3rem', marginBottom: '10px' }}>📭</div>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>No bulk food requests published yet.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                    <th style={{ padding: '12px', borderBottom: '1px solid #334155' }}>Food / Item</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #334155' }}>Qty Needed</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid #334155' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(db.requests || []).filter(r => {
                    const un = (appState.user || '').toLowerCase();
                    const nameUn = (appState.name || '').toLowerCase();
                    const rUser = (r.req_username || '').toLowerCase();
                    const rName = (r.req_name || '').toLowerCase();
                    return (un && (rUser === un || rName === un)) || (nameUn && (rUser === nameUn || rName === nameUn));
                  }).map((req, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '12px' }}>{req.food_name}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{req.quantity}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          fontSize: '0.8rem', 
                          fontWeight: 600,
                          background: req.status === 'pending' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                          color: req.status === 'pending' ? '#fbbf24' : '#34d399'
                        }}>
                          {req.status.toUpperCase()}
                        </span>
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
