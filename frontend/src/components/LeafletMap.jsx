import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet's default icon path issues in React/Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom Premium SVG Marker
const premiumIcon = L.divIcon({
  html: `<div style="transform: translate(-50%, -100%); width: 36px; height: 36px;">
           <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
             <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="url(#grad)" stroke="#ffffff" stroke-width="2"/>
             <circle cx="12" cy="9" r="3" fill="#ffffff"/>
             <defs>
               <linearGradient id="grad" x1="5" y1="2" x2="19" y2="22" gradientUnits="userSpaceOnUse">
                 <stop stop-color="#10b981"/>
                 <stop offset="1" stop-color="#0f766e"/>
               </linearGradient>
             </defs>
           </svg>
           <div style="position:absolute; bottom:-4px; left:50%; transform:translateX(-50%); width:10px; height:4px; background:rgba(0,0,0,0.3); border-radius:50%; filter:blur(2px);"></div>
         </div>`,
  className: '',
  iconSize: [0, 0] // Handled by inline transform
});

// Role-Based Colored Dot Markers
const getDotIcon = (role) => {
  let color1, color2;
  if (role === 'donor') { color1 = '#34d399'; color2 = '#059669'; } // Green
  else if (role === 'volunteer') { color1 = '#fb923c'; color2 = '#c2410c'; } // Orange
  else { color1 = '#60a5fa'; color2 = '#2563eb'; } // Blue (Receiver/Default)

  return L.divIcon({
    html: `<div style="transform: translate(-50%, -50%); width: 24px; height: 24px;">
             <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <circle cx="12" cy="12" r="10" fill="url(#grad_${role})" stroke="#ffffff" stroke-width="3" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3))"/>
               <defs>
                 <linearGradient id="grad_${role}" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                   <stop stop-color="${color1}"/>
                   <stop offset="1" stop-color="${color2}"/>
                 </linearGradient>
               </defs>
             </svg>
             <div style="position:absolute; inset:0; border-radius:50%; animation: pulseGlow 2s infinite; background: ${color1}; opacity: 0.4; z-index:-1; filter:blur(4px);"></div>
           </div>`,
    className: '',
    iconSize: [0, 0]
  });
};

export default function LeafletMap({ 
  center = [9.9252, 78.1198], 
  zoom = 13, 
  height = '200px', 
  markers = [], 
  route = null,
  tileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', // Default
  usePremiumMarker = false, // Toggle premium markers
  useColorDots = false // Use role-based dots instead of pins
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);
  const tileLayerRef = useRef(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom);
    }
    
    // Manage dynamic tile layer
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    
    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: tileUrl.includes('arcgis') ? '© Esri' : '© OpenStreetMap © CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapInstanceRef.current);

    return () => {
      // Cleanup on full unmount (if necessary) is handled by react but we clear it to be safe
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileUrl]); 

  // Handle markers update
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    
    const map = mapInstanceRef.current;
    
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    markers.forEach(m => {
      if (m.lat && m.lng) {
        let markerOpts = {};
        if (useColorDots) markerOpts = { icon: getDotIcon(m.type || 'receiver') };
        else if (usePremiumMarker) markerOpts = { icon: premiumIcon };

        L.marker([m.lat, m.lng], markerOpts)
          .addTo(map)
          .bindPopup(m.popup || 'Location');
      }
    });
  }, [markers, usePremiumMarker, useColorDots]);

  // Handle route update
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (routeLayerRef.current) {
      map.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    if (route && route.from && route.to) {
      const fromLat = route.from[0];
      const fromLng = route.from[1];
      const toLat = route.to[0];
      const toLng = route.to[1];

      routeLayerRef.current = L.polyline(
        [[fromLat, fromLng], [toLat, toLng]], 
        { color: '#10b981', weight: 5, opacity: 0.9, dashArray: '10 8' }
      ).addTo(map);

      map.fitBounds([[fromLat, fromLng], [toLat, toLng]], { padding: [40, 40] });
    }
  }, [route]);

  // Handle cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div 
      ref={mapRef} 
      style={{ height, width: '100%', borderRadius: '12px', zIndex: 1, border: '1px solid var(--border)' }} 
    />
  );
}
