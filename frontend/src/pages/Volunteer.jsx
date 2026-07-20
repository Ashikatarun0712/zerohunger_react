import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext, supabaseClient } from '../store/AppContext';
import LeafletMap from '../components/LeafletMap';

export default function Volunteer() {
  const { db, appState, syncDatabase } = useAppContext();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    vol_name: appState.name || '',
    vol_age: '',
    vehicle_type: 'Own',
    vol_pickup: '',
    shift_sel: 'Morning',
    time_slot: ''
  });

  const [parkingState, setParkingState] = useState([]);
  const [assignment, setAssignment] = useState(null);
  const [routeData, setRouteData] = useState(null);

  useEffect(() => {
    initParkingState();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getSlots = (shift) => {
    if (shift === 'Morning') return ['6:00 AM - 9:00 AM', '9:00 AM - 12:00 PM'];
    if (shift === 'Afternoon') return ['12:00 PM - 3:00 PM', '3:00 PM - 6:00 PM'];
    return ['6:00 PM - 9:00 PM', '9:00 PM - 12:00 AM'];
  };

  const initParkingState = () => {
    const hour = new Date().getHours();
    const isPeak = (hour >= 9 && hour <= 11) || (hour >= 13 && hour <= 15) || (hour >= 17 && hour <= 19);
    const occupyChance = isPeak ? 0.7 : 0.4;
    
    const state = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      label: `${String.fromCharCode(65 + Math.floor(i / 5))}${(i % 5) + 1}`,
      occupied: Math.random() < occupyChance,
      reserved: false
    }));
    
    setParkingState(state);
  };

  const scanParking = () => {
    initParkingState();
  };

  const toggleParkSlot = (id) => {
    setParkingState(prev => prev.map(s => {
      if (s.id === id && !s.occupied) {
        return { ...s, reserved: !s.reserved };
      }
      return s;
    }));
  };

  const generateSmartRoute = (assignedDonation) => {
    if (!assignedDonation) return;
    const uLat = appState.userLat || 9.9252;
    const uLng = appState.userLng || 78.1198;
    const dLat = assignedDonation.lat || 9.9252;
    const dLng = assignedDonation.lng || 78.1198;
    setRouteData({ from: [uLat, uLng], to: [dLat, dLng] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return alert('Supabase client not initialized');
    
    const payload = {
      name: formData.vol_name,
      vehicle_type: formData.vehicle_type,
      lat: appState.userLat || 9.9252,
      lng: appState.userLng || 78.1198,
      status: 'active'
    };
    
    const { error } = await supabaseClient.from('volunteers').insert([payload]);
    if (error) {
      alert('Error registering volunteer');
    } else {
      alert('Registered successfully!');
      
      // Mock AI assignment
      const availableDonations = db.donations.filter(d => d.status === 'available');
      if (availableDonations.length > 0) {
        setAssignment(availableDonations[0]);
        generateSmartRoute(availableDonations[0]);
      }
      syncDatabase();
    }
  };

  return (
    <div className="page active">
      <div className="dash-wrap">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← Back</button>
          <h2 className="sec-title" style={{ margin: 0 }}>🚗 Micro-Volunteer Module</h2>
        </div>
        
        <div className="g2">
          <div className="card">
            <div className="card-head"><h3>🚗 Volunteer Registration</h3></div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="row2">
                  <div className="fg"><label>Your Name *</label><input name="vol_name" value={formData.vol_name} onChange={handleInputChange} required /></div>
                  <div className="fg"><label>Age *</label><input name="vol_age" type="number" min="18" value={formData.vol_age} onChange={handleInputChange} required /></div>
                </div>
                
                <div className="fg">
                  <label>Vehicle Type</label>
                  <select name="vehicle_type" value={formData.vehicle_type} onChange={handleInputChange}>
                    <option value="Own">🚗 Own Vehicle</option>
                    <option value="Rent">🚐 Rented Vehicle</option>
                    <option value="Bike">🏍️ Bike</option>
                    <option value="Walk">🚶 Walking (Micro-Volunteer)</option>
                  </select>
                </div>
                
                <div className="fg"><label>Pickup Location *</label><input name="vol_pickup" value={formData.vol_pickup} onChange={handleInputChange} required /></div>
                
                <div className="fg">
                  <label>Shift Preference</label>
                  <select name="shift_sel" value={formData.shift_sel} onChange={handleInputChange}>
                    <option value="Morning">🌅 Morning</option>
                    <option value="Afternoon">☀️ Afternoon</option>
                    <option value="Night">🌙 Night</option>
                  </select>
                </div>
                
                <div className="fg">
                  <label>Select 3-Hour Slot</label>
                  <div className="slot-grid">
                    {getSlots(formData.shift_sel).map((slot, i) => (
                      <div key={i} className={`time-slot ${formData.time_slot === slot ? 'selected' : ''}`} onClick={() => setFormData({ ...formData, time_slot: slot })}>
                        {slot}
                      </div>
                    ))}
                  </div>
                </div>
                
                <button type="submit" className="btn btn-primary btn-full" style={{ marginTop: '10px' }}>✅ Register as Micro-Volunteer</button>
              </form>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card">
              <div className="card-head"><h3>🤖 AI Assignment + Smart Route</h3></div>
              <div className="card-body">
                {assignment ? (
                  <div className="route-info">
                    <div className="ai-dot">🗺️ Route Assigned: {assignment.food_name}</div>
                    <div style={{ fontSize: '.8rem', marginTop: '4px' }}>Pickup from: {assignment.donor_name}</div>
                    <button type="button" className="btn btn-primary btn-full" style={{ marginTop: '8px' }} onClick={() => generateSmartRoute(assignment)}>
                      🗺️ Generate Smart Route
                    </button>
                  </div>
                ) : (
                  <div id="agent-res"><div className="empty"><div className="ico">🤖</div><p>Register to see your AI assignment</p></div></div>
                )}
              </div>
            </div>
            
            <div className="card">
              <div className="card-head"><h3>🅿️ Volunteer Parking Radar</h3><span className="badge bg-t">Visual AI</span></div>
              <div className="card-body" style={{ padding: '14px' }}>
                <div className="radar-pulse"></div>
                <div className="parking-radar-wrap">
                  <div className="parking-radar">
                    {parkingState.map((s) => {
                      let cls = 'empty', icon = 'P';
                      if (s.occupied) { cls = 'occupied'; icon = '🚗'; }
                      else if (s.reserved) { cls = 'selected'; icon = '✅'; }
                      return (
                        <div key={s.id} className={`park-slot ${cls}`} onClick={() => toggleParkSlot(s.id)}>
                          <div style={{ fontSize: s.occupied ? '1rem' : '.9rem' }}>{icon}</div>
                          <div className="park-slot-label">{s.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <button type="button" className="btn btn-outline btn-sm btn-full" style={{ marginTop: '10px' }} onClick={scanParking}>🔄 Rescan Parking Slots</button>
              </div>
            </div>
            
            <div className="card">
              <div className="card-head"><h3>📍 Your Live Location + Route</h3></div>
              <div className="card-body" style={{ padding: '10px' }}>
                <LeafletMap 
                  center={[appState.userLat || 9.9252, appState.userLng || 78.1198]} 
                  markers={[
                    {lat: appState.userLat || 9.9252, lng: appState.userLng || 78.1198, popup: 'Your Location'},
                    ...(assignment ? [{lat: assignment.lat || 9.9252, lng: assignment.lng || 78.1198, popup: `Pickup: ${assignment.food_name}`}] : [])
                  ]} 
                  route={routeData}
                  height="220px" 
                  tileUrl="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                  usePremiumMarker={true}
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-head"><h3>🎁 Donor Details</h3></div>
          <div className="card-body table-responsive" style={{ padding: 0 }}>
            <table className="tbl">
              <thead><tr><th>Donor</th><th>Food</th><th>Qty</th><th>Location</th><th>Status</th></tr></thead>
              <tbody>
                {db.donations.length === 0 ? (
                  <tr><td colSpan="5" className="empty">No donations yet.</td></tr>
                ) : (
                  db.donations.map((d, i) => (
                    <tr key={i}>
                      <td>{d.donor_name}</td>
                      <td style={{ fontWeight: 600 }}>{d.food_name}</td>
                      <td>{d.quantity} units</td>
                      <td>{d.location_label}</td>
                      <td><span className={`badge ${d.status === 'available' ? 'bg-g' : 'bg-r'}`}>{d.status}</span></td>
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
