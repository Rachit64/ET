import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';

// Choke Point Positions & Zoom Settings
export const CHOKE_POINTS = {
  "Global": { center: [65.0, 15.0], zoom: 2.2 },
  "Strait of Hormuz": { center: [56.3, 26.6], zoom: 5.5 },
  "Bab-el-Mandeb": { center: [43.3, 12.6], zoom: 5.5 },
  "Suez Canal": { center: [32.5, 30.0], zoom: 5.8 },
  "Strait of Malacca": { center: [101.5, 2.5], zoom: 5.2 },
  "Cape of Good Hope": { center: [18.5, -34.4], zoom: 3.8 },
  "Panama Canal": { center: [-79.7, 9.1], zoom: 5.0 }
};

// Refinery Locations
const REFINERIES = [
  { name: "Jamnagar Refinery", coords: [69.8, 22.5], capacity: "1.24M bpd", owner: "Reliance" },
  { name: "Mumbai Refinery", coords: [72.8, 18.9], capacity: "0.30M bpd", owner: "BPCL/HPCL" },
  { name: "Mangalore Refinery", coords: [74.8, 12.9], capacity: "0.30M bpd", owner: "MRPL" },
  { name: "Kochi Refinery", coords: [76.2, 9.9], capacity: "0.31M bpd", owner: "BPCL" }
];

// Corridor Routes (GeoJSON representation for line layer)
const CORRIDOR_LINES = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Strait of Hormuz", "color": "#f59e0b" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[48.0, 30.0], [50.0, 27.0], [53.5, 25.0], [55.0, 26.0], [56.3, 26.6], [57.5, 25.8], [60.0, 24.5], [65.0, 23.0], [69.8, 22.5]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Bab-el-Mandeb", "color": "#f97316" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[32.5, 29.9], [34.0, 27.5], [38.0, 20.0], [42.0, 14.0], [43.3, 12.6], [45.0, 12.0], [50.0, 11.8], [55.0, 12.5], [65.0, 11.5], [76.2, 9.9]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Strait of Malacca", "color": "#06b6d4" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[104.0, 1.3], [101.5, 2.5], [98.0, 5.5], [95.0, 6.0], [90.0, 8.0], [85.0, 11.0], [80.3, 13.1]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Suez Canal", "color": "#ec4899" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[31.2, 32.2], [32.5, 30.0], [32.5, 29.9], [34.0, 27.5], [38.0, 20.0], [42.0, 14.0], [43.3, 12.6]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Cape of Good Hope", "color": "#10b981" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-10.0, 35.0], [-18.0, 0.0], [-18.0, -25.0], [18.5, -34.4], [30.0, -32.0], [50.0, -15.0], [65.0, 0.0], [74.8, 12.9]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Panama Canal", "color": "#3b82f6" },
      "geometry": {
        "type": "LineString",
        "coordinates": [[-85.0, 5.0], [-79.7, 9.1], [-70.0, 15.0], [-50.0, 15.0], [-20.0, 15.0], [0.0, 15.0], [43.3, 12.6]]
      }
    }
  ]
};

export default function Map({ selectedChoke, activeRiskZones, vessels, onSelectVessel, onSelectChokePoint }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const vesselMarkersRef = useRef({});
  const riskMarkersRef = useRef({});
  const refineryMarkersRef = useRef([]);

  // 1. Initialize Map
  useEffect(() => {
    const basemapStyle = {
      "version": 8,
      "sources": {
        "carto-dark": {
          "type": "raster",
          "tiles": [
            "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
          ],
          "tileSize": 256,
          "attribution": "&copy; OpenStreetMap &copy; CARTO"
        }
      },
      "layers": [
        {
          "id": "carto-dark-layer",
          "type": "raster",
          "source": "carto-dark",
          "minzoom": 0,
          "maxzoom": 20
        }
      ]
    };

    if (mapRef.current) return; // Prevent double init

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapStyle,
      center: CHOKE_POINTS["Global"].center,
      zoom: CHOKE_POINTS["Global"].zoom,
      attributionControl: false
    });

    mapRef.current = map;

    // Enable 3D Globe Projection
    map.on('style.load', () => {
      try {
        map.setProjection({ type: 'globe' });
        map.setPaintProperty('background', 'background-color', '#040508');
      } catch (e) {
        console.warn("Globe projection not supported in this build, falling back to flat Map.");
      }

      // Add Corridors GeoJSON lines
      map.addSource('corridors', {
        type: 'geojson',
        data: CORRIDOR_LINES
      });

      map.addLayer({
        id: 'corridor-lines',
        type: 'line',
        source: 'corridors',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-dasharray': [3, 2],
          'line-opacity': 0.75
        }
      });
    });

    // Render Refinery Markers
    REFINERIES.forEach(ref => {
      const el = document.createElement('div');
      el.className = 'refinery-marker';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#10b981';
      el.style.border = '2px solid #fff';
      el.style.boxShadow = '0 0 10px #10b981';
      el.style.cursor = 'pointer';

      const popup = new maplibregl.Popup({ offset: 15 })
        .setHTML(`
          <div style="color:#000; font-family:sans-serif; font-size:12px; padding:2px;">
            <strong style="color:#111827;">${ref.name}</strong><br/>
            <span style="color:#6b7280;">Capacity: ${ref.capacity}</span><br/>
            <span style="color:#6b7280;">Owner: ${ref.owner}</span>
          </div>
        `);

      const marker = new maplibregl.Marker(el)
        .setLngLat(ref.coords)
        .setPopup(popup)
        .addTo(map);

      refineryMarkersRef.current.push(marker);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 2. Fly camera to active choke point
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const loc = CHOKE_POINTS[selectedChoke] || CHOKE_POINTS["Global"];
    map.flyTo({
      center: loc.center,
      zoom: loc.zoom,
      essential: true,
      duration: 2500,
      pitch: selectedChoke === "Global" ? 0 : 35
    });
  }, [selectedChoke]);

  // 3. Render and Update Pulsing Risk Zone Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    Object.keys(riskMarkersRef.current).forEach(key => {
      riskMarkersRef.current[key].remove();
    });
    riskMarkersRef.current = {};

    Object.entries(activeRiskZones).forEach(([chokeName, score]) => {
      if (score <= 0 || chokeName === "Global" || !CHOKE_POINTS[chokeName]) return;

      const coords = CHOKE_POINTS[chokeName].center;
      const el = document.createElement('div');
      el.className = 'risk-zone-pulse';
      el.style.width = '60px';
      el.style.height = '60px';
      el.style.borderRadius = '50%';
      el.style.position = 'relative';

      const scoreColor = score > 75 ? 'rgba(239,68,68,0.45)' : 'rgba(249,115,22,0.4)';
      const animationSpeed = score > 75 ? '1.5s' : '2.5s';

      el.innerHTML = `
        <style>
          .pulse-${chokeName} {
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: ${scoreColor};
            opacity: 0;
            animation: pulse-ring ${animationSpeed} cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
          }
          @keyframes pulse-ring {
            0% { transform: scale(0.3); opacity: 0; }
            50% { opacity: 0.6; }
            100% { transform: scale(1.3); opacity: 0; }
          }
        </style>
        <div class="pulse-${chokeName}"></div>
        <div style="
          position: absolute; 
          left: 20px; top: 20px; 
          width: 20px; height: 20px; 
          border-radius: 50%; 
          background: ${score > 75 ? '#ef4444' : '#f97316'};
          border: 2px solid #fff;
          box-shadow: 0 0 10px currentColor;
        "></div>
      `;

      const marker = new maplibregl.Marker(el)
        .setLngLat(coords)
        .addTo(map);

      riskMarkersRef.current[chokeName] = marker;
    });
  }, [activeRiskZones]);

  // 4. Render and Update Vessels (Tankers) smoothly
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeMmsis = new Set();

    vessels.forEach(v => {
      activeMmsis.add(v.mmsi);
      const cargoColors = {
        "Crude Oil": "#ef4444",
        "LNG": "#0ea5e9",
        "LPG": "#06b6d4",
        "Refined Products": "#eab308"
      };
      const color = cargoColors[v.cargo_type] || "#ffffff";
      const isAnomaly = v.is_anomaly;

      if (vesselMarkersRef.current[v.mmsi]) {
        const marker = vesselMarkersRef.current[v.mmsi];
        marker.setLngLat([v.lon, v.lat]);

        const el = marker.getElement();
        const arrow = el.querySelector('.ship-arrow');
        if (arrow) arrow.style.transform = `rotate(${v.heading}deg)`;
        
        const pointer = el.querySelector('.ship-pointer');
        if (pointer) {
          pointer.style.boxShadow = isAnomaly ? '0 0 8px #f97316' : 'none';
          pointer.style.borderColor = isAnomaly ? '#f97316' : '#fff';
        }
      } else {
        const el = document.createElement('div');
        el.className = 'vessel-marker';
        el.style.cursor = 'pointer';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';

        el.innerHTML = `
          <div class="ship-arrow" style="
            transform: rotate(${v.heading}deg); 
            transition: transform 0.3s ease;
            display: flex; align-items: center; justify-content: center;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L17 7V19C17 20.1 16.1 21 15 21H9C7.9 21 7 20.1 7 19V7L12 2Z" 
                fill="${color}" 
                class="ship-pointer"
                stroke="${isAnomaly ? '#f97316' : '#fff'}" 
                stroke-width="1.5"
                style="box-shadow: ${isAnomaly ? '0 0 8px #f97316' : 'none'};"
              />
              <polygon points="12,5 10,9 14,9" fill="#000" />
            </svg>
          </div>
        `;

        el.addEventListener('click', () => {
          onSelectVessel(v);
        });

        const popup = new maplibregl.Popup({ offset: 12 })
          .setHTML(`
            <div style="color:#000; font-family:sans-serif; font-size:11px; padding:2px;">
              <strong style="color:#111827;">${v.name}</strong><br/>
              <span style="color:#4b5563;">Cargo: ${v.cargo_type}</span><br/>
              <span style="color:#4b5563;">Destination: ${v.destination}</span><br/>
              <span style="color:#4b5563;">Speed: ${v.speed} kts | Status: ${v.status}</span>
              ${isAnomaly ? `<br/><span style="color:#d97706; font-weight:bold;">Anomaly: ${v.anomaly_type}</span>` : ''}
            </div>
          `);

        const marker = new maplibregl.Marker(el)
          .setLngLat([v.lon, v.lat])
          .setPopup(popup)
          .addTo(map);

        vesselMarkersRef.current[v.mmsi] = marker;
      }
    });

    Object.keys(vesselMarkersRef.current).forEach(mmsi => {
      if (!activeMmsis.has(mmsi)) {
        vesselMarkersRef.current[mmsi].remove();
        delete vesselMarkersRef.current[mmsi];
      }
    });
  }, [vessels]);

  return (
    <div className="center-map-container">
      {/* Choke Point Quick Selector Bar */}
      <div className="choke-selector-overlay">
        {Object.keys(CHOKE_POINTS).map(cp => (
          <button
            key={cp}
            className={`choke-btn ${selectedChoke === cp ? 'active' : ''}`}
            onClick={() => onSelectChokePoint && onSelectChokePoint(cp)}
          >
            {cp}
          </button>
        ))}
      </div>


      {/* Map Target Element */}
      <div ref={mapContainerRef} className="maplibre-map" />

      {/* Legend overlay */}
      <div className="map-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444' }}></div>
          <span>Crude Oil Tanker</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#0ea5e9' }}></div>
          <span>LNG Carrier</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#06b6d4' }}></div>
          <span>LPG Carrier</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#eab308' }}></div>
          <span>Refined Product Carrier</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#10b981', border: '1px solid #fff' }}></div>
          <span>Indian Refinery</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#ef4444', opacity: 0.7, boxShadow: '0 0 5px #ef4444' }}></div>
          <span>Risk Heat-Zone</span>
        </div>
      </div>
    </div>
  );
}
