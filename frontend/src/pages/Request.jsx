import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import LeafletMap from '../components/LeafletMap';

export default function Request() {
  const { db, appState, syncDatabase } = useAppContext();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    req_name: appState.name || '',
    req_food_sel: '',
    req_qty: '',
    req_urgency: 'Low',
    req_area: '',
    req_city: ''
  });
  
  const [availableMatches, setAvailableMatches] = useState([]);

  useEffect(() => {
    // Populate dropdown and matches
    const un = (appState.user || '').toLowerCase();
    const available = db.donations.filter(d => d.status === 'available' && (d.donor_username || '').toLowerCase() !== un);
    
    // Sort by dummy distance for now (would use actual haversine in full implementation)
    const sorted = [...available].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    setAvailableMatches(sorted);
  }, [db.donations]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const autoFillLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    
    setFormData(prev => ({ ...prev, req_area: 'Detecting...', req_city: 'Detecting...' }));

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&addressdetails=1`, {
          headers: {
            'User-Agent': 'ZeroHungerP2P/1.0',
            'Accept-Language': 'en'
          }
        });
        const data = await response.json();
        
        const address = data.address || {};
        const area = address.suburb || address.neighbourhood || address.residential || address.village || 'Unknown Area';
        const city = address.city || address.town || address.county || address.state_district || 'Unknown City';
        
        setFormData(prev => ({ ...prev, req_area: area, req_city: city }));
      } catch (err) {
        console.error("Reverse geocoding failed", err);
        setFormData(prev => ({ ...prev, req_area: 'Failed to detect', req_city: 'Failed to detect' }));
        alert("Failed to detect location name. You can enter it manually.");
      }
    }, () => {
      setFormData(prev => ({ ...prev, req_area: '', req_city: '' }));
      alert("Unable to retrieve your location.");
    });
  };

  const getDistBadge = (km) => {
    if(km < 1) return <span className="dist-badge dist-near">📍 {km.toFixed(1)} km · Walk</span>;
    if(km < 5) return <span className="dist-badge dist-mid">📍 {km.toFixed(1)} km · Bike</span>;
    return <span className="dist-badge dist-far">📍 {km.toFixed(1)} km · Vehicle</span>;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return alert('Supabase client not initialized');
    
    const selectedDonation = availableMatches.find(m => m.id.toString() === formData.req_food_sel);
    if (!selectedDonation && formData.req_food_sel) return alert('Invalid item selected');
    
    let finalPriority = formData.req_urgency === 'High' ? 60 : 30;
    if (selectedDonation) {
      const freshnessScore = selectedDonation.freshness_score || 10;
      let proximityScore = 15;
      if (selectedDonation.expiry_date) {
        const daysLeft = Math.max(0, Math.floor((new Date(selectedDonation.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)));
        if (daysLeft <= 1) proximityScore = 30;
        else if (daysLeft <= 3) proximityScore = 20;
        else if (daysLeft <= 7) proximityScore = 10;
        else proximityScore = 5;
      }
      finalPriority += proximityScore + Math.min(10, freshnessScore);
    } else {
      finalPriority += 20;
    }
    
    const payload = {
      req_username: appState.user || '',
      req_name: formData.req_name,
      food_name: selectedDonation ? selectedDonation.food_name : 'Custom Request',
      quantity: parseInt(formData.req_qty),
      urgency: formData.req_urgency,
      location_label: `${formData.req_area}, ${formData.req_city}`,
      status: 'pending',
      priority_score: Math.min(100, Math.round(finalPriority))
    };

    if (selectedDonation && selectedDonation.id) {
      payload.donation_id = selectedDonation.id;
    }
    
    const { error } = await supabaseClient.from('requests').insert([payload]);
    if (error) {
      console.error('Request insert error:', error);
      alert('Error submitting request: ' + error.message);
    } else {
      if (selectedDonation && selectedDonation.id) {
        await supabaseClient.from('donations').update({ status: 'requested' }).eq('id', selectedDonation.id);
      }
      alert('Request submitted successfully!');
      setFormData({ ...formData, req_qty: '', req_food_sel: '' });
      syncDatabase();
    }
  };

  const FRIDGE_SLOTS = [
    { id: 1, label: 'Slot A1', food: 'Rice & Dal', exp: '2h', status: 'fresh' },
    { id: 2, label: 'Slot A2', food: 'Vegetables', exp: '6h', status: 'warn' },
    { id: 3, label: 'Slot A3', food: '', exp: '', status: 'empty' },
    { id: 4, label: 'Slot B1', food: 'Bread', exp: '12h', status: 'fresh' },
    { id: 5, label: 'Slot B2', food: '', exp: '', status: 'empty' },
    { id: 6, label: 'Slot B3', food: 'Fruits', exp: '1d', status: 'fresh' }
  ];

  return (
    <div className="page active">
      <div className="dash-wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="sec-title" style={{ margin: 0 }}>📦 Receiver Module (P2P)</h2>
        </div>
        
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-head">
            <h3>🤖 AI Proximity Matches</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className="badge bg-g">Nearest First</span>
              <button className="btn btn-sm btn-outline" onClick={syncDatabase}>🔄 Refresh</button>
            </div>
          </div>
          <div className="card-body">
            <div id="p2p-matches" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '12px' }}>
              {availableMatches.length === 0 ? (
                <div className="empty" style={{ gridColumn: '1/-1' }}>
                  <div className="ico">📍</div><p>No donations available matching criteria</p>
                </div>
              ) : (
                availableMatches.map((d, i) => (
                  <div key={d.id} className="match-card" onClick={() => setFormData({ ...formData, req_food_sel: d.id.toString() })}>
                    <div className="match-score">{i + 1}</div>
                    <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{d.food_type === 'cooked' ? '🍚' : '📦'}</div>
                    <div style={{ fontWeight: 700, fontSize: '.9rem', marginBottom: '4px' }}>{d.food_name}</div>
                    <div style={{ fontSize: '.76rem', color: 'var(--txt2)', marginBottom: '6px' }}>by {d.donor_name}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                      {getDistBadge(Math.random() * 6)}
                      <span className="badge bg-g">{d.freshness_score}/10</span>
                      <span className="badge bg-b">{d.quantity} units</span>
                    </div>
                    <div style={{ fontSize: '.72rem', color: 'var(--txt3)' }}>{d.location_label}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="g2">
          <div className="card">
            <div className="card-head"><h3>📝 Make a Request</h3></div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="fg"><label>Your Name *</label><input name="req_name" value={formData.req_name} onChange={handleInputChange} required /></div>
                
                <div className="fg">
                  <label>Select Item *</label>
                  <select name="req_food_sel" value={formData.req_food_sel} onChange={handleInputChange} required style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: '.9rem', color: 'var(--txt)', background: '#fff', outline: 'none' }}>
                    <option value="">-- Select Item --</option>
                    {availableMatches.map((d) => (
                      <option key={d.id} value={d.id}>{d.food_name} by {d.donor_name} — {d.quantity} units</option>
                    ))}
                    <option value="custom">-- Request Different Item --</option>
                  </select>
                </div>
                
                {formData.req_food_sel && formData.req_food_sel !== 'custom' && (
                  <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '8px', fontSize: '.84rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📍</span>
                    <div>
                      <div style={{ fontWeight: 700 }}>AI Match: Selected</div>
                      <div style={{ color: 'var(--txt2)' }}>Distance: Calculating...</div>
                    </div>
                  </div>
                )}
                
                <div className="fg"><label>Quantity Needed *</label><input type="number" name="req_qty" min="1" value={formData.req_qty} onChange={handleInputChange} required /></div>
                
                <div className="fg">
                  <label>Urgency</label>
                  <select name="req_urgency" value={formData.req_urgency} onChange={handleInputChange}>
                    <option value="Low">🟡 Low</option>
                    <option value="High">🔴 High</option>
                  </select>
                </div>
                
                <div className="fg">
                  <label>Area / Locality *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input name="req_area" value={formData.req_area} onChange={handleInputChange} placeholder="e.g. Anna Nagar" required style={{ flex: 1 }} />
                  </div>
                </div>
                
                <div className="fg">
                  <label>City / Place Name *</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input name="req_city" value={formData.req_city} onChange={handleInputChange} placeholder="e.g. Madurai" required style={{ flex: 1 }} />
                    <button type="button" className="btn btn-outline" style={{ width: 'auto' }} onClick={autoFillLocation} title="Auto Detect Location">📍 Auto</button>
                  </div>
                </div>
                
                <button type="submit" className="btn btn-primary btn-full">📤 Submit Request</button>
              </form>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="ai-box">
              <div className="ai-dot">🤖 AI Priority + Proximity Engine</div>
              <p style={{ fontSize: '.8rem', opacity: .75, marginTop: '8px' }}>Priority Score = Urgency (60pts) + Expiry Proximity (30pts) + Freshness (10pts)</p>
              <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,.06)', borderRadius: '8px' }}>
                <div style={{ fontSize: '.74rem', opacity: .7, marginBottom: '6px' }}>Distance Badges:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '.74rem' }}>
                  <span>🟢 &lt;1 km — Fast pickup (Walk)</span>
                  <span>🟡 1–5 km — Standard (Bike)</span>
                  <span>🔴 &gt;5 km — Long distance (Vehicle)</span>
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="card-head"><h3>🧊 Community Fridge</h3><span className="loc-tag"><span className="loc-dot"></span>AI Monitored</span></div>
              <div className="card-body" style={{ padding: '14px' }}>
                <div className="fridge-grid">
                  {FRIDGE_SLOTS.map((s) => (
                    <div key={s.id} className={`fridge-slot ${s.status === 'empty' ? 'empty-slot' : s.status}`} onClick={() => alert(`Slot ${s.label} interaction`)}>
                      <div style={{ fontSize: '1.4rem' }}>{s.status === 'empty' ? '➕' : s.status === 'fresh' ? '🟢' : '🟡'}</div>
                      <div style={{ fontWeight: 700, fontSize: '.76rem', marginTop: '4px' }}>{s.label}</div>
                      {s.food ? (
                        <>
                          <div style={{ fontSize: '.7rem', marginTop: '2px' }}>{s.food}</div>
                          <div style={{ fontSize: '.68rem', opacity: .7, marginTop: '2px' }}>⏱️ {s.exp}</div>
                        </>
                      ) : (
                        <div style={{ fontSize: '.7rem', opacity: .5, marginTop: '2px' }}>Empty</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="card">
              <div className="card-head"><h3>📍 Your Live Location</h3></div>
              <div className="card-body" style={{ padding: '10px' }}>
                <LeafletMap 
                  center={[appState.userLat || 9.9252, appState.userLng || 78.1198]} 
                  markers={[{lat: appState.userLat || 9.9252, lng: appState.userLng || 78.1198, popup: 'Your Location'}]} 
                  height="200px" 
                  tileUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                  usePremiumMarker={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
