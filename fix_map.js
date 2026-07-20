const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const brokenRegex = /function updateAllLiveMarkers\(\)\{\s*const lat=APP\.userLat,lng=APP\.userLng;if\(\!lat\|\|\!lng\)return;\s*setTimeout\(\(\) => \{ try \{ m\.invalidateSize\(\); \} catch\(e\)\{\} \}, 100\);\s*setTimeout\(\(\) => \{ try \{ m\.invalidateSize\(\); m\.setView\(\[lat, lng\], 17\); \} catch\(e\)\{\} \}, 600\);\s*\} catch\(e\) \{ console\.error\('Map init error:', elId, e\); \}\s*\}/;

const fixedContent = `function updateAllLiveMarkers(){
  const lat=APP.userLat,lng=APP.userLng;if(!lat||!lng)return;
  ['donor','req','vol'].forEach(prefix=>{
    const mapKey=prefix+'LiveMap',m=APP.maps[mapKey];if(!m)return;
    if(APP.maps[mapKey+'_marker'])APP.maps[mapKey+'_marker'].setLatLng([lat,lng]);
    m.setView([lat,lng],17);
    if(APP.maps[mapKey+'_circle']){APP.maps[mapKey+'_circle'].setLatLng([lat,lng]);if(APP.userAccuracy)APP.maps[mapKey+'_circle'].setRadius(APP.userAccuracy);}
    const txtEl=byId(prefix+'-loc-txt');if(txtEl)txtEl.textContent=\`📍 Lat: \${lat.toFixed(6)}, Lng: \${lng.toFixed(6)}\${APP.userAccuracy?\` (±\${Math.round(APP.userAccuracy)}m)\`:''}\`;
  });
}
function initLiveMap(elId, prefix) {
  const mapKey = prefix + 'LiveMap';
  if (APP.maps[mapKey]) { try { APP.maps[mapKey].remove(); } catch(e){} delete APP.maps[mapKey]; delete APP.maps[mapKey+'_marker']; delete APP.maps[mapKey+'_circle']; }
  const lat = APP.userLat || DEFAULT_LAT, lng = APP.userLng || DEFAULT_LNG;
  const el = byId(elId);
  if (!el) return;
  try {
    if (el._leaflet_id) el._leaflet_id = null;
    const m = L.map(elId, { attributionControl: false, zoomControl: true }).setView([lat, lng], 17);
    APP.maps[mapKey] = m;
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 20 }).addTo(m);
    APP.maps[mapKey+'_circle'] = L.circle([lat, lng], { radius: APP.userAccuracy||20, color:'#4285F4', fillColor:'#4285F4', fillOpacity:.15, weight:1.5 }).addTo(m);
    APP.maps[mapKey+'_marker'] = L.marker([lat, lng], { icon: L.divIcon({ html:\`<div style="position:relative;width:22px;height:22px"><div style="position:absolute;inset:0;background:#4285F4;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(66,133,244,.6)"></div></div>\`, className:'', iconSize:[22,22], iconAnchor:[11,11] }) }).addTo(m);
    const txtEl = byId(prefix+'-loc-txt');
    if (txtEl) txtEl.textContent = \`📍 Lat: \${lat.toFixed(6)}, Lng: \${lng.toFixed(6)}\`;
    if (APP.userLat && APP.userLng) updateAllLiveMarkers();
    setTimeout(() => { try { m.invalidateSize(); } catch(e){} }, 100);
    setTimeout(() => { try { m.invalidateSize(); m.setView([lat, lng], 17); } catch(e){} }, 600);
  } catch(e) { console.error('Map init error:', elId, e); }
}`;

code = code.replace(brokenRegex, fixedContent);
fs.writeFileSync('js/app.js', code, 'utf8');
console.log('Fixed app.js');
