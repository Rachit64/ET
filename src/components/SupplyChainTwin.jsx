import React, { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import {
  Zap, ShieldAlert, Filter, Activity, RotateCcw, Play, ArrowRight,
  AlertTriangle, CheckCircle2, Building2, Factory, Gauge, MapPin, Server
} from "lucide-react";

// India geographical bounds to lock the viewport
const INDIA_BOUNDS = [
  [67.0, 6.0],  // Southwest coordinates (longitude, latitude)
  [98.5, 36.5]   // Northeast coordinates (longitude, latitude)
];

const PRESET_SCENARIOS = [
  {
    title: "Southern Grid Storm",
    text: "Severe monsoon storms damage transmission corridors in Tamil Nadu, causing Kudankulam Nuclear Plant to trip and isolating Chennai's automotive manufacturing belt. Urgent power redirection needed."
  },
  {
    title: "Gujarat Cyclone Hit",
    text: "Extreme cyclone winds force preemptive shutdown of Mundra Coal Plant and reduce Jamnagar Refinery capacity to 45%. Major crude pipeline leaks reported in Rajasthan basin."
  },
  {
    title: "Northern Grid Flare",
    text: "Severe solar flare induces geomagnetic currents, overloading substations and throttling Vindhyachal Coal Plant. Delhi NCR faces 3000 MW deficit; redirect solar from Rajasthan and Tehri hydro."
  }
];

// Vector SVG definitions for high-fidelity custom markers
const NODE_ICONS = {
  coal: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><path d="M22 21H2V3l7 4 7-4 6 4v14zM17 11h2M17 15h2M12 11h2M12 15h2M7 11h2M7 15h2"/></svg>`,
  gas: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  nuclear: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><circle cx="12" cy="12" r="1.5"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" stroke-dasharray="2 2"/><ellipse cx="12" cy="12" rx="4" ry="9" transform="rotate(45 12 12)"/><ellipse cx="12" cy="12" rx="4" ry="9" transform="rotate(-45 12 12)"/></svg>`,
  hydro: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-13-7-13S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>`,
  solar: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`,
  wind: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><path d="M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2M15.73 9.73A2.5 2.5 0 1 1 18 14H2"/></svg>`,
  crude: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><path d="M14 22V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v18h12zM22 22V11a2 2 0 0 0-2-2h-6v13h8zM6 6h2M6 10h2M6 14h2M18 13h2M18 17h2"/></svg>`,
  gas_wellhead: `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.9;"><path d="M12 2L2 22h20L12 2zM12 2v20M2 22l10-10 10 10M7 12h10"/></svg>`,
  city: `<svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2.5" fill="none" style="opacity: 0.95;"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="22" x2="9" y2="16"/><line x1="15" y1="22" x2="15" y2="16"/><line x1="9" y1="16" x2="15" y2="16"/><path d="M8 6h2M14 6h2M8 10h2M14 10h2"/></svg>`
};

const NODE_CLASSES = {
  coal: "bg-gradient-to-br from-slate-600 to-slate-800 border-slate-400 text-slate-350 shadow-slate-950/70",
  gas: "bg-gradient-to-br from-amber-500 to-orange-700 border-amber-400 text-amber-100 shadow-orange-950/40",
  nuclear: "bg-gradient-to-br from-fuchsia-600 to-purple-850 border-purple-400 text-purple-100 shadow-purple-950/40",
  hydro: "bg-gradient-to-br from-blue-500 to-indigo-700 border-blue-400 text-blue-100 shadow-blue-950/40",
  solar: "bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-350 text-amber-950 shadow-amber-950/40",
  wind: "bg-gradient-to-br from-emerald-500 to-teal-700 border-emerald-450 text-emerald-100 shadow-teal-950/40",
  crude: "bg-gradient-to-br from-red-650 to-rose-800 border-rose-500 text-rose-100 shadow-red-950/40",
  gas_wellhead: "bg-gradient-to-br from-sky-500 to-cyan-700 border-sky-400 text-sky-100 shadow-sky-950/40",
  city: "bg-gradient-to-br from-slate-900 to-slate-950 border-cyan-450 text-cyan-300 ring-2 ring-cyan-950/60 shadow-cyan-950/40"
};

// ── Geometry helpers for high-fidelity diversion arcs ───────────────────────
// Build a smooth curved arc (quadratic bezier) between two [lon,lat] points so
// flows read as deliberate routes instead of flat straight lines.
function buildArc(from, to, segments = 64, bend = 0.22) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy) || 1;
  // Perpendicular control point gives the arc its sideways bow.
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = mx + nx * dist * bend;
  const cy = my + ny * dist * bend;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    pts.push([a * x1 + b * cx + c * x2, a * y1 + b * cy + c * y2]);
  }
  return pts;
}

// Interpolate a position along a precomputed arc at fraction t (0..1).
function pointAlong(arc, t) {
  const n = arc.length - 1;
  const f = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.floor(f);
  const frac = f - i;
  const p0 = arc[i];
  const p1 = arc[Math.min(i + 1, n)];
  return [p0[0] + (p1[0] - p0[0]) * frac, p0[1] + (p1[1] - p0[1]) * frac];
}

export default function SupplyChainTwin() {
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [scenarioInput, setScenarioInput] = useState("");
  const [simulationResult, setSimulationResult] = useState(null);
  
  // Filters
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "power_plant" | "refinery" | "wellhead" | "hub"
  const [fuelFilter, setFuelFilter] = useState("all"); // "all" | "coal" | "gas" | "nuclear" | "hydro" | "solar" | "wind"

  // Sidebar Tab
  const [sidebarTab, setSidebarTab] = useState("strategy"); // "strategy" | "load_shedding"

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const diversionMarkersRef = useRef([]); // DOM markers for diversion source/target endpoints
  const arcsRef = useRef([]);             // current diversion arcs (for flow animation)
  const animRef = useRef(null);           // requestAnimationFrame handle for flowing packets

  // Fetch initial infrastructure
  useEffect(() => {
    fetch("http://localhost:8000/api/supply-chain/infrastructure")
      .then((r) => r.json())
      .then((data) => {
        setNodes(data.nodes || []);
        setLinks(data.links || []);
      })
      .catch((err) => console.error("Error loading infrastructure database", err));
  }, []);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json", // High-fidelity vector style
      center: [78.9629, 21.5937], // Centered on India
      zoom: 4.6,
      minZoom: 4.2,
      maxZoom: 9.0,
      maxBounds: INDIA_BOUNDS, // Lock viewport into India only
      attributionControl: false
    });

    mapRef.current = map;

    map.on("load", () => {
      // Add grid source & layer overlays (will be populated dynamically)
      addGridOverlay(map);
    });

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Re-render markers and links when active data or filters change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // When a scenario is live, collapse the map down to ONLY the assets that
    // matter for this disruption: the impacted nodes plus the source/target
    // endpoints of every diversion route. Everything else (untouched plants,
    // wellheads, hubs and their pipelines/transmission lines) is hidden so the
    // operator sees a clean, decision-grade picture instead of the full atlas.
    const simActive = !!simulationResult;
    const relevantIds = new Set();
    if (simActive) {
      (simulationResult.affected_nodes || []).forEach((an) => {
        if (an?.id) relevantIds.add(an.id);
      });
      (simulationResult.diversion_lines || []).forEach((dl) => {
        if (dl.from_node && dl.from_node !== "custom") relevantIds.add(dl.from_node);
        if (dl.to_node && dl.to_node !== "custom") relevantIds.add(dl.to_node);
      });
    }

    // Filter nodes: in scenario mode keep only relevant assets; otherwise apply
    // the standard facility/fuel filters (hubs & wellheads kept as context).
    const filteredNodes = nodes.filter((node) => {
      if (simActive) {
        return relevantIds.has(node.id);
      }
      if (node.type === "hub") {
        return activeFilter === "all" || activeFilter === "power_plant" || activeFilter === "refinery" || activeFilter === "hub";
      }
      if (node.type === "wellhead") {
        return activeFilter === "all" || activeFilter === "refinery" || activeFilter === "wellhead";
      }

      // Primary category filters
      if (activeFilter !== "all" && node.type !== activeFilter) return false;
      if (node.type === "power_plant" && fuelFilter !== "all" && node.fuel !== fuelFilter) return false;
      return true;
    });

    // Draw markers
    filteredNodes.forEach((node) => {
      const isDisrupted = simulationResult?.affected_nodes?.find(
        (an) => an.id === node.id
      );

      // Create outer wrapper element for MapLibre to position
      const el = document.createElement("div");
      const size = node.type === "hub" ? "24px" : "22px";
      el.style.width = size;
      el.style.height = size;

      // Create inner interactive element that handles custom styles and hover scale.
      // This separates MapLibre's inline transform positioning from our hover transform/scaling.
      const inner = document.createElement("div");
      inner.className = `w-full h-full flex items-center justify-center rounded-full border cursor-pointer relative shadow-xl transition-all duration-350 hover:scale-125 hover:z-50 ${
        isDisrupted 
          ? "border-red-500 bg-gradient-to-br from-red-650 to-red-950 text-red-200 ring-2 ring-red-500/50" 
          : NODE_CLASSES[node.fuel] || "bg-slate-500 border-slate-350 text-slate-100"
      }`;

      // Add SVG inside inner marker
      const iconKey = node.type === "hub" ? "city" : (node.type === "refinery" ? "crude" : node.fuel);
      inner.innerHTML = NODE_ICONS[iconKey] || "";

      // Add radar pulse wave for disrupted nodes
      if (isDisrupted) {
        const ring = document.createElement("div");
        ring.className = "disrupted-pulse-ring";
        inner.appendChild(ring);
      }

      el.appendChild(inner);

      // Native popup to prevent React state changes from causing glitches
      const popupHTML = `
        <div style="padding: 10px 12px; min-width: 200px; color: #f8fafc; font-family: sans-serif;">
          <div style="font-weight: bold; font-size: 13px; color: #22d3ee; margin-bottom: 4px; line-height: 1.2;">${node.name}</div>
          <div style="color: #94a3b8; text-transform: uppercase; font-size: 8px; font-weight: bold; margin-bottom: 8px; letter-spacing: 0.05em;">
            ${node.type.replace('_', ' ')} · ${node.fuel || ''}
          </div>
          <div style="display: grid; grid-template-cols: 1fr; gap: 4px; font-size: 11px; border-top: 1px solid #1e293b; padding-top: 6px;">
            <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Capacity:</span> <strong style="color: #e2e8f0; font-family: monospace;">${node.capacity}</strong></div>
            <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Operator:</span> <span style="color: #cbd5e1;">${node.operator}</span></div>
          </div>
          ${isDisrupted ? `
            <div style="
              margin-top: 8px; 
              padding: 6px; 
              background: rgba(239, 68, 68, 0.15); 
              border: 1px solid rgba(239, 68, 68, 0.4); 
              color: #fca5a5; 
              border-radius: 4px;
              font-size: 10px;
            ">
              <strong style="font-weight: bold;">⚠ COMPROMISED (${isDisrupted.impact_pct}%)</strong><br/>
              <span style="font-size: 9px; color: #fecaca; line-height: 1.2;">${isDisrupted.reason}</span>
            </div>
          ` : ''}
        </div>
      `;

      // Set autoPan to false and focusAfterOpen to false to prevent MapLibre from moving the viewport and causing focus-based scroll jumps when clicked
      const popup = new maplibregl.Popup({ 
        offset: 12, 
        closeButton: true,
        closeOnClick: true,
        autoPan: false,
        focusAfterOpen: false
      }).setHTML(popupHTML);

      // NOTE: maplibre-gl v5 removed the legacy `Marker(element)` signature, so
      // the custom element MUST be passed as `{ element }` — otherwise every
      // node silently falls back to the default teardrop pin.
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(node.coords)
        .setPopup(popup)
        .addTo(map);

      // Toggle this node's popup ourselves and stop the click here. maplibre v5
      // opens marker popups via the *map* click event, so calling
      // stopPropagation alone (the previous approach) suppressed the popup
      // entirely. Toggling explicitly restores the info card while still
      // preventing the underlying pipeline/transmission line popups from also
      // firing at the same point.
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        marker.togglePopup();
      });

      markersRef.current.push(marker);
    });

    // Dynamic filtering of grid overlay connections (only draw lines between visible facilities)
    const filteredLinks = links.filter((link) => {
      const fromNodeVisible = filteredNodes.some((n) => n.id === link.from_node);
      const toNodeVisible = filteredNodes.some((n) => n.id === link.to_node);
      return fromNodeVisible && toNodeVisible;
    });

    // Populate or update dynamic grid GeoJSON source
    const gridSource = map.getSource("grid-overlay");
    if (gridSource) {
      const features = filteredLinks.map((link) => {
        const fromNode = nodes.find((n) => n.id === link.from_node);
        const toNode = nodes.find((n) => n.id === link.to_node);
        if (!fromNode || !toNode) return null;

        return {
          type: "Feature",
          properties: {
            id: link.id,
            type: link.type,
            capacity: link.capacity,
            operator: link.operator,
            from_name: fromNode.name,
            to_name: toNode.name
          },
          geometry: {
            type: "LineString",
            coordinates: [fromNode.coords, toNode.coords]
          }
        };
      }).filter(Boolean);

      gridSource.setData({
        type: "FeatureCollection",
        features: features
      });
    }

    // Render diversion lines if they exist
    if (simulationResult?.diversion_lines) {
      drawDiversionLines(map, simulationResult.diversion_lines);
    } else {
      removeDiversionLines(map);
    }
  }, [nodes, links, activeFilter, fuelFilter, simulationResult]);

  const addGridOverlay = (map) => {
    if (map.getSource("grid-overlay")) return;

    map.addSource("grid-overlay", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    });

    // RENDER METICULOUS NEON PIPELINES (Emerald/Green Glow)
    map.addLayer({
      id: "grid-pipelines-glow",
      type: "line",
      source: "grid-overlay",
      filter: ["==", "type", "pipeline"],
      paint: {
        "line-color": "#10b981", // emerald-500
        "line-width": 3,
        "line-opacity": 0.25
      }
    });

    map.addLayer({
      id: "grid-pipelines",
      type: "line",
      source: "grid-overlay",
      filter: ["==", "type", "pipeline"],
      paint: {
        "line-color": "#34d399", // emerald-400
        "line-width": 1.2,
        "line-dasharray": [4, 4],
        "line-opacity": 0.8
      }
    });

    // RENDER METICULOUS NEON TRANSMISSION LINES (Indigo Glow)
    map.addLayer({
      id: "grid-transmission-glow",
      type: "line",
      source: "grid-overlay",
      filter: ["==", "type", "transmission"],
      paint: {
        "line-color": "#6366f1", // indigo-500
        "line-width": 3,
        "line-opacity": 0.2
      }
    });

    map.addLayer({
      id: "grid-transmission",
      type: "line",
      source: "grid-overlay",
      filter: ["==", "type", "transmission"],
      paint: {
        "line-color": "#818cf8", // indigo-400
        "line-width": 1,
        "line-dasharray": [3, 3],
        "line-opacity": 0.75
      }
    });

    // INTERACTIVE LINE CLICKS
    map.on("click", "grid-pipelines", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["grid-pipelines"] });
      if (!features.length) return;
      const f = features[0];

      new maplibregl.Popup({ offset: 5, autoPan: false, focusAfterOpen: false })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 10px 12px; min-width: 210px; color: #f8fafc; font-family: sans-serif;">
            <div style="font-weight: bold; font-size: 11px; color: #10b981; text-transform: uppercase; margin-bottom: 2px;">Fuel Pipeline</div>
            <div style="font-weight: bold; font-size: 12px; color: #e2e8f0; margin-bottom: 8px;">${f.properties.from_name} ➔ ${f.properties.to_name}</div>
            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 11px; border-top: 1px solid #1e293b; padding-top: 6px;">
              <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Capacity:</span> <strong style="color: #e2e8f0; font-family: monospace;">${f.properties.capacity}</strong></div>
              <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Operator:</span> <span style="color: #cbd5e1;">${f.properties.operator}</span></div>
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on("click", "grid-transmission", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["grid-transmission"] });
      if (!features.length) return;
      const f = features[0];

      new maplibregl.Popup({ offset: 5, autoPan: false, focusAfterOpen: false })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 10px 12px; min-width: 210px; color: #f8fafc; font-family: sans-serif;">
            <div style="font-weight: bold; font-size: 11px; color: #6366f1; text-transform: uppercase; margin-bottom: 2px;">Grid Transmission Corridor</div>
            <div style="font-weight: bold; font-size: 12px; color: #e2e8f0; margin-bottom: 8px;">${f.properties.from_name} ➔ ${f.properties.to_name}</div>
            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 11px; border-top: 1px solid #1e293b; padding-top: 6px;">
              <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Voltage/Capacity:</span> <strong style="color: #e2e8f0; font-family: monospace;">${f.properties.capacity}</strong></div>
              <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Grid Operator:</span> <span style="color: #cbd5e1;">${f.properties.operator}</span></div>
            </div>
          </div>
        `)
        .addTo(map);
    });

    // Hover mouse styles for layers
    map.on("mouseenter", "grid-pipelines", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "grid-pipelines", () => { map.getCanvas().style.cursor = ""; });
    map.on("mouseenter", "grid-transmission", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "grid-transmission", () => { map.getCanvas().style.cursor = ""; });
  };

  const drawDiversionLines = (map, diversionLines) => {
    removeDiversionLines(map);

    // Build a smooth curved arc for every route and remember them for the
    // flowing-packet animation.
    const arcs = diversionLines.map((line) => buildArc(line.from_coords, line.to_coords));
    arcsRef.current = arcs;

    const features = diversionLines.map((line, idx) => ({
      type: "Feature",
      properties: {
        id: `div-line-${idx}`,
        label: line.label,
        amount: line.amount,
        from_name: line.from_name,
        to_name: line.to_name
      },
      geometry: {
        type: "LineString",
        coordinates: arcs[idx]
      }
    }));

    map.addSource("diversions", {
      type: "geojson",
      lineMetrics: true,
      data: { type: "FeatureCollection", features }
    });

    // Wide soft halo so the route glows against the dark basemap.
    map.addLayer({
      id: "diversion-glow",
      type: "line",
      source: "diversions",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": "#06b6d4",
        "line-width": 9,
        "line-blur": 4,
        "line-opacity": 0.30
      }
    });

    // Crisp core line with a head→tail gradient (source emerald → target cyan)
    // so direction is legible even when the animation is paused.
    map.addLayer({
      id: "diversion-lines",
      type: "line",
      source: "diversions",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-width": 2.6,
        "line-opacity": 0.95,
        "line-gradient": [
          "interpolate", ["linear"], ["line-progress"],
          0, "#34d399",
          0.5, "#22d3ee",
          1, "#a5f3fc"
        ]
      }
    });

    // Animated "energy packets" travelling source → target along each arc.
    map.addSource("diversion-flow", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] }
    });
    map.addLayer({
      id: "diversion-flow",
      type: "circle",
      source: "diversion-flow",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["get", "phase"], 0, 2.2, 1, 5],
        "circle-color": "#e0fbff",
        "circle-blur": 0.55,
        "circle-opacity": ["interpolate", ["linear"], ["get", "phase"], 0, 0.25, 1, 1],
        "circle-stroke-color": "#22d3ee",
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": 0.6
      }
    });

    startFlowAnimation(map);

    // Endpoint markers: an explicit SOURCE pin where each route starts and a
    // TARGET pin where it lands. Deduped so shared hubs render only once.
    drawDiversionEndpoints(map, diversionLines);

    // Click handler for active diversion lines
    map.on("click", "diversion-lines", (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["diversion-lines"] });
      if (!features.length) return;
      const f = features[0];

      new maplibregl.Popup({ offset: 5, autoPan: false, focusAfterOpen: false })
        .setLngLat(e.lngLat)
        .setHTML(`
          <div style="padding: 10px 12px; min-width: 210px; color: #f8fafc; font-family: sans-serif;">
            <div style="font-weight: bold; font-size: 11px; color: #22d3ee; text-transform: uppercase; margin-bottom: 2px;">⚡ Active Rerouting Flow</div>
            <div style="font-weight: bold; font-size: 12px; color: #e2e8f0; margin-bottom: 8px;">${f.properties.from_name} ➔ ${f.properties.to_name}</div>
            <div style="display: grid; grid-template-columns: 1fr; gap: 4px; font-size: 11px; border-top: 1px solid #1e293b; padding-top: 6px;">
              <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Diverted Volume:</span> <strong style="color: #22d3ee; font-family: monospace;">${f.properties.amount}</strong></div>
              <div><span style="color: #64748b; font-size: 9px; text-transform: uppercase;">Protocol:</span> <span style="color: #cbd5e1;">${f.properties.label}</span></div>
            </div>
          </div>
        `)
        .addTo(map);
    });

    map.on("mouseenter", "diversion-lines", () => { map.getCanvas().style.cursor = "pointer"; });
    map.on("mouseleave", "diversion-lines", () => { map.getCanvas().style.cursor = ""; });

    // Center viewport on the routes
    if (arcs.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      arcs.forEach((arc) => arc.forEach((coord) => bounds.extend(coord)));
      map.fitBounds(bounds, { padding: 110, maxZoom: 6.2, duration: 1800 });
    }
  };

  // Render labeled SOURCE / TARGET endpoint markers for the diversion routes.
  const drawDiversionEndpoints = (map, diversionLines) => {
    const seen = new Set();
    diversionLines.forEach((line) => {
      const ends = [
        { role: "source", name: line.from_name, coords: line.from_coords, detail: line.label },
        { role: "target", name: line.to_name, coords: line.to_coords, detail: line.amount }
      ];
      ends.forEach(({ role, name, coords, detail }) => {
        if (!coords || coords.length < 2) return;
        const key = `${role}:${coords[0].toFixed(3)},${coords[1].toFixed(3)}`;
        if (seen.has(key)) return;
        seen.add(key);

        const isSource = role === "source";
        const accent = isSource ? "#34d399" : "#22d3ee";
        const ringClass = isSource ? "diversion-endpoint-source" : "diversion-endpoint-target";

        const el = document.createElement("div");
        el.className = "diversion-endpoint";
        el.innerHTML = `
          <div class="diversion-endpoint-dot ${ringClass}"></div>
          <div class="diversion-endpoint-label" style="border-color:${accent}66;">
            <span style="color:${accent};font-weight:700;">${isSource ? "◢ SOURCE" : "◤ TARGET"}</span>
            <span style="color:#e2e8f0;"> · ${name}</span>
            ${detail ? `<span style="display:block;color:#94a3b8;font-size:8px;letter-spacing:0.03em;">${detail}</span>` : ""}
          </div>
        `;

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(coords)
          .addTo(map);
        diversionMarkersRef.current.push(marker);
      });
    });
  };

  // Drive the flowing energy-packet animation along the current arcs.
  const startFlowAnimation = (map) => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const period = 2600; // ms for one packet to travel source → target

    const tick = () => {
      if (!mapRef.current || !map.getSource("diversion-flow")) return;
      const now = performance.now();
      const feats = [];
      arcsRef.current.forEach((arc, ai) => {
        // Two packets per route, offset so flow looks continuous.
        [0, 0.5].forEach((off) => {
          const t = (now / period + off + ai * 0.13) % 1;
          // Bright at mid-route, dim near the endpoints for a pulse feel.
          const phase = 1 - Math.abs(0.5 - t) * 1.6;
          feats.push({
            type: "Feature",
            properties: { phase: Math.max(0.1, phase) },
            geometry: { type: "Point", coordinates: pointAlong(arc, t) }
          });
        });
      });
      map.getSource("diversion-flow").setData({ type: "FeatureCollection", features: feats });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  };

  const removeDiversionLines = (map) => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    arcsRef.current = [];
    // Remove endpoint DOM markers
    diversionMarkersRef.current.forEach((m) => m.remove());
    diversionMarkersRef.current = [];

    if (map.getLayer("diversion-flow")) map.removeLayer("diversion-flow");
    if (map.getSource("diversion-flow")) map.removeSource("diversion-flow");
    if (map.getLayer("diversion-lines")) map.removeLayer("diversion-lines");
    if (map.getLayer("diversion-glow")) map.removeLayer("diversion-glow");
    if (map.getSource("diversions")) map.removeSource("diversions");
  };

  const handleSimulate = () => {
    if (!scenarioInput.trim()) return;

    setLoading(true);
    setSimulationResult(null);

    const steps = [
      "Initializing Energy Supply Chain Digital Twin...",
      "Correlating geospatial infrastructure nodes...",
      "Analyzing meteorological & grid conditions...",
      "Invoking Gemini analytical simulation pipeline...",
      "Calculating optimal power/fuel diversion strategies...",
      "Solving transmission load balancing equations..."
    ];

    let stepIdx = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIdx++;
      if (stepIdx < steps.length) {
        setLoadingStep(steps[stepIdx]);
      }
    }, 1200);

    fetch("http://localhost:8000/api/supply-chain/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: scenarioInput })
    })
      .then((r) => {
        if (!r.ok) throw new Error("Simulation pipeline error");
        return r.json();
      })
      .then((result) => {
        clearInterval(stepInterval);
        setSimulationResult(result);
        setSidebarTab("strategy");
      })
      .catch((err) => {
        console.error("Simulation failed", err);
        clearInterval(stepInterval);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleReset = () => {
    setSimulationResult(null);
    setScenarioInput("");
    if (mapRef.current) {
      removeDiversionLines(mapRef.current);
      mapRef.current.flyTo({
        center: [78.9629, 21.5937],
        zoom: 4.6,
        duration: 1500
      });
    }
  };

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case "critical":
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase bg-red-950 border border-red-500 text-red-400 animate-pulse">Critical</span>;
      case "severe":
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase bg-amber-950 border border-amber-500 text-amber-400">Severe</span>;
      case "elevated":
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase bg-yellow-950 border border-yellow-500 text-yellow-400">Elevated</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-widest uppercase bg-emerald-950 border border-emerald-500 text-emerald-400">Moderate</span>;
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden text-slate-100 font-sans">
      
      {/* Dynamic Popups Dark Style Override Inject */}
      <style dangerouslySetInnerHTML={{__html: `
        .maplibregl-popup-content {
          background: #020617 !important;
          color: #f8fafc !important;
          border: 1px solid #1e293b !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.9) !important;
          padding: 0 !important;
        }
        .maplibregl-popup-tip {
          border-bottom-color: #020617 !important;
          border-top-color: #020617 !important;
          border-left-color: #020617 !important;
          border-right-color: #020617 !important;
        }
        .maplibregl-popup-close-button {
          color: #94a3b8 !important;
          font-size: 16px !important;
          padding: 6px 10px !important;
          border-radius: 0 12px 0 0 !important;
        }
        .maplibregl-popup-close-button:hover {
          background: rgba(255,255,255,0.05) !important;
          color: #f8fafc !important;
        }
        @keyframes pulse-ring-glow {
          0% { transform: scale(0.85); opacity: 0.85; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .disrupted-pulse-ring {
          position: absolute;
          top: -2px;
          left: -2px;
          right: -2px;
          bottom: -2px;
          border-radius: 50%;
          border: 2px solid #ef4444;
          animation: pulse-ring-glow 1.8s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
          pointer-events: none;
          box-sizing: content-box;
        }
        /* Diversion route endpoint markers (SOURCE / TARGET) */
        .diversion-endpoint {
          display: flex;
          align-items: center;
          gap: 6px;
          pointer-events: none;
          white-space: nowrap;
        }
        .diversion-endpoint-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
          position: relative;
        }
        .diversion-endpoint-dot::after {
          content: "";
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          animation: pulse-ring-glow 2.1s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
        }
        .diversion-endpoint-source {
          background: radial-gradient(circle at 35% 30%, #6ee7b7, #059669);
          box-shadow: 0 0 10px 2px rgba(52, 211, 153, 0.7);
        }
        .diversion-endpoint-source::after { border: 2px solid #34d399; }
        .diversion-endpoint-target {
          background: radial-gradient(circle at 35% 30%, #a5f3fc, #0891b2);
          box-shadow: 0 0 12px 3px rgba(34, 211, 238, 0.8);
          transform: rotate(45deg);
          border-radius: 2px;
        }
        .diversion-endpoint-target::after { border: 2px solid #22d3ee; border-radius: 2px; }
        .diversion-endpoint-label {
          background: rgba(2, 6, 23, 0.9);
          border: 1px solid;
          border-radius: 6px;
          padding: 2px 7px;
          font-family: sans-serif;
          font-size: 9px;
          letter-spacing: 0.04em;
          line-height: 1.25;
          backdrop-filter: blur(4px);
          box-shadow: 0 4px 12px -4px rgba(0,0,0,0.8);
        }
      `}} />

      {/* ── LEFT COMMAND SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-96 shrink-0 h-full border-r border-slate-800 bg-slate-950/80 backdrop-blur-md flex flex-col overflow-hidden z-20">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <div className="p-1 bg-cyan-950/40 border border-cyan-800 rounded text-cyan-400">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Resilience Sandbox
            </h2>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            Write or load a crisis scenario to calculate grid load-shedding and fuel diversion strategies.
          </p>
        </div>

        {/* Inner Scroll Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* Natural Language Input Panel */}
          {!simulationResult && !loading && (
            <div className="space-y-3 bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Describe Scenario In Natural Language
              </label>
              <textarea
                value={scenarioInput}
                onChange={(e) => setScenarioInput(e.target.value)}
                placeholder="Describe a grid outage, regional natural disaster, pipeline rupture, or refinery shutdown..."
                className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all font-sans resize-none"
              />

              {/* Preset Scenarios */}
              <div className="space-y-1.5 pt-2">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">
                  Quick Load Presets
                </span>
                <div className="flex flex-col space-y-1">
                  {PRESET_SCENARIOS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => setScenarioInput(preset.text)}
                      className="w-full text-left p-1.5 rounded bg-slate-950 border border-slate-800/60 hover:bg-slate-900 hover:border-slate-700 text-[10px] text-slate-400 hover:text-slate-200 transition-all cursor-pointer font-medium truncate"
                    >
                      💡 {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleSimulate}
                disabled={!scenarioInput.trim()}
                className={`w-full py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 transition-all duration-300 ${
                  scenarioInput.trim()
                    ? "bg-cyan-650 border-cyan-500 text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-600 cursor-pointer"
                    : "bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed"
                }`}
              >
                <Play className="w-3.5 h-3.5" />
                <span>Trigger Simulation</span>
              </button>
            </div>
          )}

          {/* Loading Animation */}
          {loading && (
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-xl flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-b-cyan-400 animate-spin"></div>
                <div className="absolute inset-2 rounded-full border-2 border-transparent border-l-cyan-600 border-r-cyan-600 animate-spin duration-700 reverse"></div>
                <Zap className="w-6 h-6 text-cyan-400 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-widest animate-pulse">
                  Twin Core Modeling
                </h4>
                <p className="text-[10px] text-slate-500 max-w-[250px] font-mono leading-relaxed">
                  {loadingStep}
                </p>
              </div>
            </div>
          )}

          {/* Simulation Output Panel */}
          {simulationResult && !loading && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Header Details */}
              <div className="bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-2 shadow-md">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wide leading-tight">
                    {simulationResult.title}
                  </h3>
                  {getSeverityBadge(simulationResult.severity)}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {simulationResult.summary}
                </p>

                {/* Reset Button */}
                <button
                  onClick={handleReset}
                  className="w-full mt-2 py-1.5 border border-slate-850 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-900 rounded text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear Sandbox</span>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-900/30 rounded-t-lg overflow-hidden shrink-0">
                <button
                  onClick={() => setSidebarTab("strategy")}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    sidebarTab === "strategy"
                      ? "border-cyan-500 text-cyan-400 bg-cyan-950/10"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Grid Strategy
                </button>
                <button
                  onClick={() => setSidebarTab("load_shedding")}
                  className={`flex-1 py-2 text-center text-[10px] font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                    sidebarTab === "load_shedding"
                      ? "border-cyan-500 text-cyan-400 bg-cyan-950/10"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Industrial Impact
                </button>
              </div>

              {/* Strategy View */}
              {sidebarTab === "strategy" && (
                <div className="bg-slate-900/20 border border-slate-850 p-3.5 rounded-b-xl space-y-3">
                  <div className="text-[11px] text-slate-300 leading-relaxed font-sans space-y-2 select-text">
                    {simulationResult.diversion_strategy && (
                      <div 
                        className="prose prose-invert prose-xs"
                        dangerouslySetInnerHTML={{ 
                          __html: simulationResult.diversion_strategy
                            .replace(/### (.*)/g, '<h4 class="text-xs font-bold text-slate-200 uppercase tracking-wide mt-3 mb-1 border-b border-slate-800 pb-1">$1</h4>')
                            .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-cyan-400">$1</strong>')
                            .replace(/- (.*)/g, '<li class="ml-4 list-disc text-slate-400 my-0.5">$1</li>')
                            .replace(/\n/g, '<br/>')
                        }}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Load Shedding & Affected Industries View */}
              {sidebarTab === "load_shedding" && (
                <div className="space-y-3.5">
                  
                  {/* Divert From list */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-1.5">
                      <Factory className="w-3.5 h-3.5 text-orange-400" />
                      <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        Load Shedding (Divert From)
                      </h4>
                    </div>
                    {simulationResult.divert_from_industries && simulationResult.divert_from_industries.length > 0 ? (
                      <div className="space-y-2">
                        {simulationResult.divert_from_industries.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs p-2 bg-slate-950/70 border border-slate-850 rounded-lg">
                            <div>
                              <p className="font-bold text-slate-300">{item.industry}</p>
                              <p className="text-[9px] text-slate-500 uppercase">{item.region}</p>
                            </div>
                            <span className="text-[10px] font-mono font-bold bg-orange-950/30 border border-orange-900/60 text-orange-400 px-2 py-0.5 rounded">
                              -{item.power_mw}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">No industrial load-shedding recommended.</p>
                    )}
                  </div>

                  {/* Downstream Affected list */}
                  <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center space-x-1.5 border-b border-slate-800 pb-1.5">
                      <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                      <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        Downstream Sectors Affected
                      </h4>
                    </div>
                    {simulationResult.affected_industries && simulationResult.affected_industries.length > 0 ? (
                      <div className="space-y-2">
                        {simulationResult.affected_industries.map((item, idx) => (
                          <div key={idx} className="text-xs p-2 bg-slate-950/70 border border-slate-850 rounded-lg space-y-1">
                            <p className="font-bold text-slate-300">{item.industry}</p>
                            <p className="text-[10px] text-slate-400 leading-relaxed font-mono">{item.impact}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">No downstream commercial outages expected.</p>
                    )}
                  </div>
                  
                </div>
              )}

            </div>
          )}

        </div>
      </aside>

      {/* ── RIGHT MAP AREA ──────────────────────────────────────────────── */}
      <section className="flex-1 h-full relative bg-[#040508]">
        
        {/* Scenario Focus indicator — shown while a simulation is active to
            signal that the map is intentionally scoped to impacted assets. */}
        {simulationResult && (
          <div className="absolute top-4 left-4 z-10 animate-fade-in">
            <div className="flex items-center space-x-2.5 bg-slate-950/90 border border-cyan-800/70 px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              <div className="leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Scenario Focus Active</p>
                <p className="text-[9px] text-slate-400">
                  {(simulationResult.affected_nodes?.length || 0)} impacted ·{" "}
                  {(simulationResult.diversion_lines?.length || 0)} reroutes · untouched assets hidden
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Layer Filters overlay (hidden during a scenario to keep focus) */}
        <div className={`absolute top-4 left-4 z-10 flex flex-col space-y-2 ${simulationResult ? "hidden" : ""}`}>

          {/* Facility Type Filter */}
          <div className="flex bg-slate-950/90 border border-slate-800/80 p-1 rounded-xl shadow-2xl backdrop-blur-md">
            {[
              { id: "all", label: "All Assets" },
              { id: "power_plant", label: "Power Plants" },
              { id: "refinery", label: "Refineries" },
              { id: "wellhead", label: "Wellheads" },
              { id: "hub", label: "Hubs" }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setActiveFilter(t.id);
                  if (t.id !== "power_plant") setFuelFilter("all");
                }}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeFilter === t.id
                    ? "bg-cyan-650 text-white font-extrabold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Fuel Filter (Only shown when Power Plants filter is active) */}
          {activeFilter === "power_plant" && (
            <div className="flex bg-slate-950/80 border border-slate-800/60 p-1 rounded-xl shadow-xl backdrop-blur-md animate-fade-in self-start">
              {[
                { id: "all", label: "All Fuel Types" },
                { id: "coal", label: "Coal" },
                { id: "gas", label: "Gas" },
                { id: "nuclear", label: "Nuclear" },
                { id: "hydro", label: "Hydro" },
                { id: "solar", label: "Solar/Wind" }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFuelFilter(f.id)}
                  className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    fuelFilter === f.id
                      ? "bg-cyan-900 border border-cyan-600/50 text-cyan-200"
                      : "text-slate-500 hover:text-slate-350"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Map Container Target */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Legend Overlay */}
        <div className="absolute bottom-6 left-6 z-10 bg-slate-950/90 border border-slate-800/80 backdrop-blur-md p-4 rounded-xl shadow-2xl text-xs space-y-3 pointer-events-none">
          <h4 className="font-semibold text-slate-200 uppercase tracking-wider text-[10px] border-b border-slate-900 pb-1.5">
            Geospatial Network Legend
          </h4>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Coal Plant</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Gas Plant</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Nuclear Plant</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Hydro Plant</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Solar / Wind</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Oil Refinery</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-600 inline-block"></span>
              <span className="text-slate-350 text-[10px]">Wellhead</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-400 border border-slate-950 inline-block"></span>
              <span className="text-slate-350 text-[10px]">City / Grid Hub</span>
            </div>
            <div className="col-span-2 pt-1.5 border-t border-slate-900 flex flex-col space-y-1">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-0.5 border-t border-emerald-500 border-dashed inline-block opacity-65"></span>
                <span className="text-slate-400 text-[9px]">Oil/Gas Pipeline</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-0.5 border-t border-indigo-500 border-dashed inline-block opacity-60"></span>
                <span className="text-slate-400 text-[9px]">Grid Transmission</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-5 h-1 border-t border-cyan-400 inline-block"></span>
                <span className="text-slate-300 text-[9px] font-bold">Active Rerouting Flow</span>
              </div>
            </div>
          </div>
        </div>

      </section>

    </div>
  );
}
