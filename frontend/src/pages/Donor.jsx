import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import { runExpiryPredictionLogic, loadMobileNet, mapMobileNetToFreshness, runOpenRouterFallback } from '../utils/aiEngine';
import LeafletMap from '../components/LeafletMap';

export default function Donor() {
  const { db, appState, syncDatabase } = useAppContext();
  const navigate = useNavigate();
  const imgRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  
  // Form State
  const [formData, setFormData] = useState({
    donor_name: appState.name || '',
    item_category: 'auto',
    food_name: '',
    quantity: '',
    location_text: '',
    mfg_date: '',
    expiry_date: '',
    payment_type: '',
    phy_notes: '',
    onl_amount: '',
    onl_txn: '',
    onl_mode: 'UPI (PhonePe / GPay)'
  });
  
  const [prediction, setPrediction] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [mobileNetResult, setMobileNetResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (formData.food_name.length >= 2) {
      const delay = setTimeout(() => {
        const res = runExpiryPredictionLogic(formData.food_name, formData.item_category);
        setPrediction(res);
      }, 500);
      return () => clearTimeout(delay);
    } else {
      setPrediction(null);
    }
  }, [formData.food_name, formData.item_category]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const applyAIDates = () => {
    if (prediction && prediction.mfgStr && prediction.expStr) {
      setFormData({
        ...formData,
        mfg_date: prediction.mfgStr,
        expiry_date: prediction.expStr
      });
    }
  };

  const handleImgUpload = (file) => {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = (ev) => {
      setImgPreview(ev.target.result);
      setMobileNetResult(null);
    };
    rd.readAsDataURL(file);
  };

  const runDeepScan = async () => {
    if (!imgPreview) return;
    setIsScanning(true);
    let usedMobileNet = false;
    
    try {
      const model = await loadMobileNet();
      if (model && imgRef.current) {
        const predictions = await model.classify(imgRef.current, 5);
        const result = mapMobileNetToFreshness(predictions, formData.food_name);
        setMobileNetResult({ result, predictions, source: 'MobileNet CNN' });
        usedMobileNet = true;
      }
    } catch (e) {
      console.error('MobileNet failed, trying fallback', e);
    } 
    
    if (!usedMobileNet) {
      try {
        const base64 = imgPreview;
        const fbResult = await runOpenRouterFallback(base64, formData.food_name);
        if (fbResult) {
          setMobileNetResult({ ...fbResult, source: 'OpenRouter AI' });
        } else {
          alert('AI analysis failed. Please try again.');
        }
      } catch (e) {
        console.error('Fallback failed', e);
        alert('AI analysis failed. Please try again.');
      }
    }
    
    setIsScanning(false);
  };

  const generateUPIPayment = (upiId, name, amount) => {
    const uri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amount)}&cu=INR`;
    window.location.href = uri;
    setTimeout(() => {
      alert(`Redirecting to payment app... If on desktop, scan the QR code manually. UPI ID: ${upiId}`);
    }, 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return alert('Supabase client not initialized');
    
    const { donor_name, food_name, quantity, location_text, mfg_date, expiry_date, item_category, payment_type, onl_amount } = formData;
    
    const freshness_score = mobileNetResult ? mobileNetResult.result.freshScore : 10;
    
    const payload = {
      donor_username: appState.user || '',
      donor_name,
      food_name,
      food_type: prediction ? prediction.type : item_category,
      quantity: parseInt(quantity),
      location_label: location_text,
      lat: appState.userLat || 9.9252,
      lng: appState.userLng || 78.1198,
      mfg_date,
      expiry_date,
      freshness_score,
      status: 'available',
      pay_type: payment_type === 'online' && onl_amount ? 'paid' : 'free'
    };
    
    const { error } = await supabaseClient.from('donations').insert([payload]);
    if (error) {
      console.error('Donation insert error:', error);
      alert('Error submitting donation: ' + error.message);
    } else {
      alert('Donation successful!');
      setFormData({ ...formData, food_name: '', quantity: '', mfg_date: '', expiry_date: '' });
      syncDatabase();
    }
  };

  const handleFulfillRequest = async (reqId) => {
    const myAvail = db.donations.filter(d => (d.donor_name || '').toLowerCase() === (appState.name || '').toLowerCase() && d.status === 'available');
    if (myAvail.length === 0) {
      return alert("You don't have any available donations to fulfill this request. Please create a donation first!");
    }
    
    // For MVP, just auto-link the most recent available donation
    const linkedDonation = myAvail[0];
    
    if (window.confirm(`Fulfill this request using your donation: "${linkedDonation.food_name}"?`)) {
      // Update request to processing and link the donation
      await supabaseClient.from('requests').update({ 
        status: 'processing',
        donation_id: linkedDonation.id
      }).eq('id', reqId);
      
      // Update donation status
      await supabaseClient.from('donations').update({
        status: 'processing',
        claimed_by: 'Receiver' // Basic tracking
      }).eq('id', linkedDonation.id);
      
      alert("Handshake initiated! The request is now processing.");
      syncDatabase();
    }
  };

  const myDonationsList = db.donations.filter(d => (d.donor_name || '').toLowerCase() === (appState.name || '').toLowerCase());
  const pendingRequestsList = db.requests.filter(r => r.status === 'pending');

  return (
    <div className="page active">
      <div className="dash-wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="sec-title" style={{ margin: 0 }}>🎁 Donor Module</h2>
        </div>
        
        <div className="g2">
          {/* Form Card */}
          <div className="card">
            <div className="card-head"><h3>📝 Donation Form</h3></div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="fg">
                  <label>Your Name *</label>
                  <input name="donor_name" value={formData.donor_name} onChange={handleInputChange} required />
                </div>
                
                <div className="fg">
                  <label>Item Category *</label>
                  <select name="item_category" value={formData.item_category} onChange={handleInputChange}>
                    <option value="auto">🤖 Auto-Detect (AI)</option>
                    <option value="cooked">🍚 Cooked Food (Expires Fast)</option>
                    <option value="raw">🥕 Raw Food / Veggies</option>
                    <option value="packaged">📦 Packaged / Preserved Food</option>
                    <option value="material">👕 Non-Food / Material (Clothes, Books, etc.)</option>
                  </select>
                </div>
                
                <div className="fg">
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    Item Name *
                    {prediction && !prediction.error && (
                      <span style={{ background: '#ecfdf5', color: '#065f46', border: '1px solid #6ee7b7', padding: '2px 8px', borderRadius: '99px', fontSize: '.7rem', fontWeight: 700 }}>
                        {prediction.typeInfo?.icon} {prediction.typeInfo?.label}
                      </span>
                    )}
                  </label>
                  <input name="food_name" value={formData.food_name} onChange={handleInputChange} placeholder="e.g. Rice, Clothes, Books..." required />
                </div>
                
                {prediction && (
                  <div id="expiry-predict-box" style={{ marginBottom: '14px' }}>
                    {prediction.error ? (
                      <div className="non-food-warn">
                        <div className="non-food-warn-inner">
                          <div className="non-food-warn-icon">🚫</div>
                          <div className="non-food-warn-body">
                            <div className="non-food-warn-title">⚠️ Non-Food Item Detected!</div>
                            <div className="non-food-warn-msg">{prediction.error}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="predict-result" style={{ border: '1.5px solid #93c5fd', borderRadius: '10px', overflow: 'hidden', background: '#eff6ff' }}>
                        <div style={{ padding: '8px 12px', background: 'rgba(30,58,95,0.08)', display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '.74rem', fontWeight: 700 }}>🤖 AI Expiry Prediction</span>
                        </div>
                        <div style={{ padding: '10px 12px' }}>
                          <div className="predict-dates-clean">
                            <div className="predict-date-chip mfg">
                              <div style={{ fontSize: '.65rem', opacity: .65, fontWeight: 600 }}>📅 MFG DATE</div>
                              <div style={{ fontWeight: 800, fontSize: '.85rem' }}>{prediction.mfgStr}</div>
                            </div>
                            <div className="predict-date-chip exp">
                              <div style={{ fontSize: '.65rem', opacity: .65, fontWeight: 600 }}>⏰ EXPIRY DATE</div>
                              <div style={{ fontWeight: 800, fontSize: '.85rem' }}>{prediction.expStr}</div>
                            </div>
                          </div>
                          <button type="button" className="apply-btn-clean" onClick={applyAIDates}>✅ Apply Dates to Form</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="row2">
                  <div className="fg"><label>Quantity (units) *</label><input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} required /></div>
                  <div className="fg"><label>Location *</label><input name="location_text" value={formData.location_text} onChange={handleInputChange} required /></div>
                </div>
                
                <div className="row2">
                  <div className="fg"><label>Manufacturing Date *</label><input type="date" name="mfg_date" value={formData.mfg_date} onChange={handleInputChange} required /></div>
                  <div className="fg"><label>Expiry Date *</label><input type="date" name="expiry_date" value={formData.expiry_date} onChange={handleInputChange} required /></div>
                </div>
                
                <div className="fg">
                  <label>Payment Method *</label>
                  <select name="payment_type" value={formData.payment_type} onChange={handleInputChange}>
                    <option value="">-- Select Payment --</option>
                    <option value="physical">💵 Physical</option>
                    <option value="online">💳 Online / UPI</option>
                  </select>
                </div>
                
                {formData.payment_type === 'physical' && (
                  <div style={{ background: 'var(--g5)', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '8px' }}>💵 Physical Details</div>
                    <input name="phy_notes" placeholder="Notes about cash payment" onChange={handleInputChange} />
                  </div>
                )}
                
                {formData.payment_type === 'online' && (
                  <div style={{ background: '#eff6ff', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                    <div style={{ fontWeight: 700, fontSize: '.85rem', marginBottom: '8px', color: 'var(--b1)' }}>💳 Online Payment</div>
                    <div className="row2">
                      <input type="number" name="onl_amount" placeholder="Amount" onChange={handleInputChange} />
                      <input name="onl_txn" placeholder="UPI ref / Txn ID" onChange={handleInputChange} />
                    </div>
                  </div>
                )}
                
                <button type="submit" className="btn btn-primary btn-full" disabled={!!prediction?.error}>📤 Submit Donation</button>
              </form>
            </div>
          </div>
          
          {/* AI Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <div className="card-head"><h3>🤖 AI Vision Analysis</h3><span className="badge bg-t">MobileNet CNN</span></div>
              <div className="card-body">
                <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={(e) => handleImgUpload(e.target.files[0])} />
                  <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📷</div>
                  <p style={{ fontSize: '.85rem' }}><strong>Click to upload</strong> food image</p>
                </div>
                
                {imgPreview && (
                  <>
                    <img ref={imgRef} src={imgPreview} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px' }} alt="Preview" crossOrigin="anonymous" />
                    <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '10px' }} onClick={runDeepScan} disabled={isScanning}>
                      {isScanning ? '⚡ Scanning...' : '⚡ Analyze Freshness'}
                    </button>
                  </>
                )}
                
                {mobileNetResult && (
                  <div style={{ marginTop: '10px' }}>
                    <div className={`mobilenet-banner ${mobileNetResult.result.cssClass}`}>
                      <span style={{ fontSize: '2rem' }}>{mobileNetResult.result.icon}</span>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 800 }}>{mobileNetResult.source || 'AI'}: {mobileNetResult.result.label}</div>
                        <div style={{ fontSize: '.76rem', opacity: .85 }}>Confidence: {mobileNetResult.result.confidence}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="card">
              <div className="card-head"><h3>📍 Your Live Location</h3><span className="loc-tag"><span className="loc-dot"></span>Tracking</span></div>
              <div className="card-body" style={{ padding: '10px' }}>
                <LeafletMap 
                  center={[appState.userLat || 9.9252, appState.userLng || 78.1198]} 
                  markers={[{lat: appState.userLat || 9.9252, lng: appState.userLng || 78.1198, popup: 'Your Location'}]} 
                  height="180px" 
                  tileUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                  usePremiumMarker={true}
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Two-Column Vertical Split Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }} className="responsive-grid">
          
          {/* Left Column: My Donations */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-head">
              <h3>🎁 My Donations</h3>
              <button className="btn btn-sm btn-outline" onClick={syncDatabase}>🔄</button>
            </div>
            <div className="card-body table-responsive" style={{ padding: 0, flex: 1 }}>
              <table className="tbl">
                <thead><tr><th>Food</th><th>Qty</th><th>Status</th></tr></thead>
                <tbody>
                  {myDonationsList.length === 0 ? (
                    <tr><td colSpan="3" className="empty">You haven't made any donations yet.</td></tr>
                  ) : (
                    myDonationsList.map((d, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{d.food_name}</td>
                        <td>{d.quantity}</td>
                        <td>
                          <span className={`badge ${d.status === 'available' ? 'bg-g' : (d.status === 'processing' ? 'bg-y' : 'bg-b')}`}>
                            {d.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Live Requests */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="card-head">
              <h3>🚨 Live Requests</h3>
              <span className="badge bg-r" style={{ animation: 'pulseGlow 2s infinite' }}>Live</span>
            </div>
            <div className="card-body table-responsive" style={{ padding: 0, flex: 1 }}>
              <table className="tbl">
                <thead><tr><th>Receiver</th><th>Needs</th><th>Location</th><th>Action</th></tr></thead>
                <tbody>
                  {pendingRequestsList.length === 0 ? (
                    <tr><td colSpan="4" className="empty">No pending requests right now.</td></tr>
                  ) : (
                    pendingRequestsList.map((r, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{r.req_name || 'Anonymous'}</td>
                        <td>{r.food_name} <span style={{ color: 'var(--txt1)', fontSize: '0.8rem' }}>(x{r.quantity})</span></td>
                        <td style={{ fontSize: '0.85rem' }}>{r.location_label}</td>
                        <td>
                          <button 
                            className="btn btn-sm btn-primary" 
                            style={{ background: 'var(--g1)', whiteSpace: 'nowrap' }}
                            onClick={() => handleFulfillRequest(r.id)}
                          >
                            🤝 Fulfill
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

        {/* Trust Funds Table (Moved below the split columns) */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-head">
            <h3>🏛️ Trust Funding Requests</h3>
          </div>
          <div className="card-body table-responsive" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>Trust Name</th><th>Purpose</th><th>Amount</th><th>UPI ID</th><th>Action</th></tr></thead>
              <tbody>
                {db.fund_requests.filter(f => f.status === 'active').length === 0 ? (
                  <tr><td colSpan="5" className="empty">No active fund requests from Trusts.</td></tr>
                ) : (
                  db.fund_requests.filter(f => f.status === 'active').map((f, i) => {
                    const trust = db.trusts.find(t => t.trust_name === f.trust_name) || {};
                    // Check if they are verified. If missing, assume verified for demo, but normally check trust.verification_status
                    const isVerified = trust.verification_status === 'verified' || true; // Using true as fallback if trust row is missing locally
                    
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}><span style={{ fontSize: '1.1rem' }}>🏛️</span> {f.trust_name}</td>
                        <td>{f.purpose}</td>
                        <td style={{ fontWeight: 700, color: 'var(--g2)' }}>₹{f.amount}</td>
                        <td style={{ fontSize: '.8rem', color: 'var(--b1)' }}>{isVerified ? f.upi_id : '🔒 Hidden'}</td>
                        <td>
                          {isVerified ? (
                            <button className="btn btn-sm btn-primary" style={{ background: '#0ea5e9' }} onClick={() => generateUPIPayment(f.upi_id, f.trust_name, f.amount)}>💳 Pay via UPI</button>
                          ) : (
                            <button className="btn btn-sm btn-ghost" disabled>⏳ Pending Verification</button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
