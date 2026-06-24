import React, { useState, useEffect, useRef, useCallback } from "react";
import { Network, ZoomIn, ZoomOut, RotateCcw, Info, Maximize2 } from "lucide-react";

const VW = 1600;
const VH = 900;

// Compute static positions grouped by node type, scaled by `spread`
function computePositions(nodeList, spread) {
  const cx = VW / 2;
  const cy = VH / 2;

  const groups = { Corridor: [], Supplier: [], Refinery: [], RiskEvent: [], Other: [] };
  nodeList.forEach(n => { (groups[n.type] ?? groups.Other).push(n); });

  const positions = {};

  // Corridors — tight inner ring
  groups.Corridor.forEach((n, i, arr) => {
    const angle = (i / Math.max(arr.length, 1)) * 2 * Math.PI - Math.PI / 2;
    positions[n.id] = {
      x: cx + spread * 0.38 * Math.cos(angle),
      y: cy + spread * 0.38 * Math.sin(angle),
    };
  });

  // Suppliers — upper arc
  groups.Supplier.forEach((n, i, arr) => {
    const angle = Math.PI + (i / Math.max(arr.length - 1, 1)) * Math.PI;
    positions[n.id] = {
      x: cx + spread * Math.cos(angle),
      y: cy + spread * 0.75 * Math.sin(angle),
    };
  });

  // Refineries — lower arc
  groups.Refinery.forEach((n, i, arr) => {
    const angle = (i / Math.max(arr.length - 1, 1)) * Math.PI;
    positions[n.id] = {
      x: cx + spread * 0.9 * Math.cos(angle),
      y: cy + spread * 0.7 * Math.sin(angle),
    };
  });

  // RiskEvents — outer scattered ring
  groups.RiskEvent.forEach((n, i, arr) => {
    const angle = (i / Math.max(arr.length, 1)) * 2 * Math.PI + Math.PI / 6;
    positions[n.id] = {
      x: cx + spread * 1.15 * Math.cos(angle),
      y: cy + spread * 0.95 * Math.sin(angle),
    };
  });

  // Other — simple circle
  groups.Other.forEach((n, i, arr) => {
    const angle = (i / Math.max(arr.length, 1)) * 2 * Math.PI;
    positions[n.id] = {
      x: cx + spread * 0.6 * Math.cos(angle),
      y: cy + spread * 0.6 * Math.sin(angle),
    };
  });

  return positions;
}

function buildDemoData() {
  const nodes = [
    { id: "Saudi Arabia",       type: "Supplier" },
    { id: "Iraq",               type: "Supplier" },
    { id: "UAE",                type: "Supplier" },
    { id: "Nigeria",            type: "Supplier" },
    { id: "Russia",             type: "Supplier" },
    { id: "USA (WTI)",          type: "Supplier" },
    { id: "Strait of Hormuz",   type: "Corridor" },
    { id: "Bab-el-Mandeb",      type: "Corridor" },
    { id: "Suez Canal",         type: "Corridor" },
    { id: "Strait of Malacca",  type: "Corridor" },
    { id: "Jamnagar Refinery",  type: "Refinery" },
    { id: "Kochi Refinery",     type: "Refinery" },
    { id: "Mangalore Refinery", type: "Refinery" },
    { id: "Iranian Drill 2025", type: "RiskEvent" },
    { id: "Houthi Strikes",     type: "RiskEvent" },
    { id: "Ever Given II",      type: "RiskEvent" },
  ];
  const links = [
    { source: "Saudi Arabia",      target: "Strait of Hormuz",   relationship: "TRANSITS" },
    { source: "Iraq",              target: "Strait of Hormuz",   relationship: "TRANSITS" },
    { source: "UAE",               target: "Strait of Hormuz",   relationship: "TRANSITS" },
    { source: "Saudi Arabia",      target: "Bab-el-Mandeb",      relationship: "TRANSITS" },
    { source: "Russia",            target: "Suez Canal",         relationship: "TRANSITS" },
    { source: "Nigeria",           target: "Bab-el-Mandeb",      relationship: "TRANSITS" },
    { source: "USA (WTI)",         target: "Suez Canal",         relationship: "TRANSITS" },
    { source: "Strait of Hormuz",  target: "Jamnagar Refinery",  relationship: "SUPPLIES" },
    { source: "Strait of Hormuz",  target: "Kochi Refinery",     relationship: "SUPPLIES" },
    { source: "Bab-el-Mandeb",     target: "Kochi Refinery",     relationship: "SUPPLIES" },
    { source: "Suez Canal",        target: "Mangalore Refinery", relationship: "SUPPLIES" },
    { source: "Strait of Malacca", target: "Jamnagar Refinery",  relationship: "SUPPLIES" },
    { source: "Iranian Drill 2025",target: "Strait of Hormuz",   relationship: "THREATENS" },
    { source: "Houthi Strikes",    target: "Bab-el-Mandeb",      relationship: "THREATENS" },
    { source: "Ever Given II",     target: "Suez Canal",         relationship: "THREATENS" },
    { source: "Iranian Drill 2025",target: "Jamnagar Refinery",  relationship: "IMPACTS_DOWNSTREAM" },
    { source: "Houthi Strikes",    target: "Kochi Refinery",     relationship: "IMPACTS_DOWNSTREAM" },
  ];
  return { nodes, links };
}

const TYPE_STYLE = {
  Supplier:  { fill: "#3b82f6", glow: "#93c5fd40" },
  Corridor:  { fill: "#ef4444", glow: "#fca5a540" },
  Refinery:  { fill: "#10b981", glow: "#6ee7b740" },
  RiskEvent: { fill: "#f59e0b", glow: "#fcd34d40" },
};
const typeStyle = (t) => TYPE_STYLE[t] ?? { fill: "#64748b", glow: "#94a3b840" };

export default function KnowledgeGraphView() {
  const svgRef      = useRef(null);
  const dragRef     = useRef(null);   // { id, offsetX, offsetY }
  const panRef      = useRef(null);   // { startMouseX, startMouseY, startPanX, startPanY }

  const [rawNodes,     setRawNodes]     = useState([]);
  const [links,        setLinks]        = useState([]);
  const [nodePos,      setNodePos]      = useState({});   // { [id]: {x, y} }
  const [selectedNode, setSelectedNode] = useState(null);
  const [isLoading,    setIsLoading]    = useState(false);
  const [zoom,         setZoom]         = useState(0.52);
  const [pan,          setPan]          = useState({ x: 90, y: 40 });
  const [spread,       setSpread]       = useState(320);
  const [hoveredLink,  setHoveredLink]  = useState(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadGraph = useCallback(async () => {
    setIsLoading(true);
    setSelectedNode(null);
    try {
      const res = await fetch("http://localhost:8000/api/graph");
      if (!res.ok) throw new Error();
      const data = await res.json();

      const degree = {};
      data.nodes.forEach(n => { degree[n.id] = 0; });
      data.links.forEach(l => {
        degree[l.source] = (degree[l.source] || 0) + 1;
        degree[l.target] = (degree[l.target] || 0) + 1;
      });
      const enriched = data.nodes.map(n => ({
        ...n,
        r:   Math.min(22, 11 + (degree[n.id] || 0) * 2.5),
        deg: degree[n.id] || 0,
      }));
      setRawNodes(enriched);
      setLinks(data.links);
      setNodePos(computePositions(enriched, spread));
    } catch {
      const { nodes, links: dLinks } = buildDemoData();
      const degree = {};
      nodes.forEach(n => { degree[n.id] = 0; });
      dLinks.forEach(l => {
        degree[l.source] = (degree[l.source] || 0) + 1;
        degree[l.target] = (degree[l.target] || 0) + 1;
      });
      const enriched = nodes.map(n => ({
        ...n,
        r:   Math.min(22, 11 + (degree[n.id] || 0) * 2.5),
        deg: degree[n.id] || 0,
      }));
      setRawNodes(enriched);
      setLinks(dLinks);
      setNodePos(computePositions(enriched, spread));
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // ── Spread slider — recompute positions when spread changes ────────────────
  const onSpreadChange = (e) => {
    const val = Number(e.target.value);
    setSpread(val);
    setNodePos(computePositions(rawNodes, val));
  };

  // ── SVG coordinate helper ──────────────────────────────────────────────────
  const svgPoint = useCallback((clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / zoom - pan.x,
      y: (clientY - rect.top)  / zoom - pan.y,
    };
  }, [zoom, pan]);

  // ── Drag node ──────────────────────────────────────────────────────────────
  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = svgPoint(e.clientX, e.clientY);
    dragRef.current = {
      id:      node.id,
      offsetX: pt.x - nodePos[node.id].x,
      offsetY: pt.y - nodePos[node.id].y,
    };
    setSelectedNode(node);
  };

  const onNodePointerMove = (e) => {
    if (!dragRef.current) return;
    const pt = svgPoint(e.clientX, e.clientY);
    const { id, offsetX, offsetY } = dragRef.current;
    setNodePos(prev => ({
      ...prev,
      [id]: {
        x: Math.max(5, Math.min(VW - 5, pt.x - offsetX)),
        y: Math.max(5, Math.min(VH - 5, pt.y - offsetY)),
      },
    }));
  };

  const onNodePointerUp = () => { dragRef.current = null; };

  // ── Pan canvas ─────────────────────────────────────────────────────────────
  const onSvgPointerDown = (e) => {
    if (e.target !== svgRef.current && e.target.tagName !== "svg") return;
    svgRef.current.setPointerCapture(e.pointerId);
    panRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPanX:   pan.x,
      startPanY:   pan.y,
    };
  };

  const onSvgPointerMove = (e) => {
    if (!panRef.current) return;
    const { startMouseX, startMouseY, startPanX, startPanY } = panRef.current;
    setPan({
      x: startPanX + (e.clientX - startMouseX) / zoom,
      y: startPanY + (e.clientY - startMouseY) / zoom,
    });
  };

  const onSvgPointerUp = () => { panRef.current = null; };

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const onWheel = (e) => {
    e.preventDefault();
    setZoom(z => Math.max(0.15, Math.min(3, z * (e.deltaY < 0 ? 1.12 : 0.89))));
  };

  const zoomBy = (f) => setZoom(z => Math.max(0.15, Math.min(3, z * f)));

  const fitView = () => {
    const positions = Object.values(nodePos);
    if (!positions.length) return;
    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.min((rect.width - 40) / (maxX - minX + 80), (rect.height - 40) / (maxY - minY + 80), 2);
    setZoom(s);
    setPan({ x: -minX + 20 / s, y: -minY + 20 / s });
  };

  const reset = () => {
    setZoom(0.52);
    setPan({ x: 90, y: 40 });
    setSpread(320);
    loadGraph();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full bg-[#07090f] overflow-hidden select-none">

      {/* ── Canvas ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative min-h-[300px] overflow-hidden" onWheel={onWheel}>

        {/* Controls HUD */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-lg shadow-xl">
          <HudBtn onClick={() => zoomBy(1.2)}  title="Zoom in"><ZoomIn  className="w-3.5 h-3.5"/></HudBtn>
          <HudBtn onClick={() => zoomBy(0.83)} title="Zoom out"><ZoomOut className="w-3.5 h-3.5"/></HudBtn>
          <HudBtn onClick={fitView}             title="Fit view"><Maximize2 className="w-3.5 h-3.5"/></HudBtn>
          <HudBtn onClick={reset}               title="Reset"><RotateCcw className="w-3.5 h-3.5"/></HudBtn>
        </div>

        {/* Spread slider */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg shadow-xl">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider whitespace-nowrap">Spread</span>
          <input
            type="range" min={150} max={600} step={10} value={spread}
            onChange={onSpreadChange}
            className="w-28 accent-cyan-500 cursor-pointer"
          />
          <span className="text-[9px] font-mono text-cyan-400 w-6 text-right">{spread}</span>
        </div>

        {/* Zoom % */}
        <div className="absolute top-3 right-3 z-10 px-2 py-1 bg-slate-900/80 border border-slate-800 rounded text-[9px] font-mono text-slate-500 pointer-events-none">
          {Math.round(zoom * 100)}%
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg shadow-lg pointer-events-none">
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Entity Type</p>
          {Object.entries(TYPE_STYLE).map(([type, s]) => (
            <div key={type} className="flex items-center gap-2 mb-1 last:mb-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.fill }} />
              <span className="text-[10px] text-slate-300">{type}</span>
            </div>
          ))}
          <p className="text-[8px] text-slate-600 mt-1.5 border-t border-slate-800 pt-1.5">Node size = connections</p>
        </div>

        <div className="absolute bottom-3 right-3 z-10 text-[8px] text-slate-600 font-mono pointer-events-none">
          Scroll to zoom · Drag canvas to pan · Drag nodes to reposition
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 z-20">
            <div className="text-cyan-400 text-xs font-mono animate-pulse">Loading graph…</div>
          </div>
        )}

        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          viewBox={`0 0 ${VW} ${VH}`}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
        >
          <defs>
            <marker id="arr-normal" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,1 L6,3.5 L0,6 Z" fill="#334155" />
            </marker>
            <marker id="arr-threat" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,1 L6,3.5 L0,6 Z" fill="#f59e0b" />
            </marker>
            <marker id="arr-impact" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,1 L6,3.5 L0,6 Z" fill="#ef4444" />
            </marker>
            <filter id="glow-sel" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <g transform={`scale(${zoom}) translate(${pan.x},${pan.y})`}>

            {/* ── Edges ─────────────────────────────────────────────────────── */}
            {links.map((link, idx) => {
              const sp = nodePos[link.source];
              const tp = nodePos[link.target];
              const sn = rawNodes.find(n => n.id === link.source);
              const tn = rawNodes.find(n => n.id === link.target);
              if (!sp || !tp || !sn || !tn) return null;

              const isThreat = link.relationship === "THREATENS";
              const isImpact = link.relationship === "IMPACTS_DOWNSTREAM";
              const isHov    = hoveredLink === idx;

              // Shorten so arrowhead clears the node circle
              const dx  = tp.x - sp.x, dy = tp.y - sp.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const pad = tn.r + 5;
              const ex  = tp.x - (dx / len) * pad;
              const ey  = tp.y - (dy / len) * pad;
              const mx  = (sp.x + ex) / 2;
              const my  = (sp.y + ey) / 2;

              const stroke     = isThreat ? "#f59e0b" : isImpact ? "#ef444480" : isHov ? "#475569" : "#1e293b";
              const strokeW    = isThreat ? 2 : isImpact ? 1.5 : isHov ? 1.5 : 1;
              const dash       = isThreat ? "7 4" : isImpact ? "4 3" : "0";
              const markerEnd  = isThreat ? "url(#arr-threat)" : isImpact ? "url(#arr-impact)" : "url(#arr-normal)";

              // Flowing dot speed: threat = fast, supply = medium, other = slow
              const dotDur = isThreat ? "1.8s" : isImpact ? "2.4s" : "3.5s";
              const dotColor = isThreat ? "#fbbf24" : isImpact ? "#f87171" : "#38bdf8";
              const dotR = isThreat ? 3.5 : 2;

              return (
                <g key={`e${idx}`}
                  onMouseEnter={() => setHoveredLink(idx)}
                  onMouseLeave={() => setHoveredLink(null)}
                >
                  <line
                    x1={sp.x} y1={sp.y} x2={ex} y2={ey}
                    stroke={stroke} strokeWidth={strokeW}
                    strokeDasharray={dash}
                    strokeOpacity={isHov || isThreat || isImpact ? 1 : 0.55}
                    markerEnd={markerEnd}
                  />

                  {/* Flowing dot on every edge */}
                  <circle r={dotR} fill={dotColor} opacity={isThreat || isImpact ? 0.95 : 0.5}>
                    <animateMotion
                      path={`M ${sp.x} ${sp.y} L ${ex} ${ey}`}
                      dur={dotDur}
                      repeatCount="indefinite"
                    />
                  </circle>

                  {/* Relationship label on hover */}
                  {(isHov || isThreat || isImpact) && link.relationship && (
                    <text x={mx} y={my - 6} textAnchor="middle"
                      fill={isThreat ? "#fbbf24" : isImpact ? "#f87171" : "#64748b"}
                      fontSize="8px" fontFamily="monospace"
                      className="pointer-events-none"
                      stroke="#07090f" strokeWidth="2.5" paintOrder="stroke"
                    >
                      {link.relationship}
                    </text>
                  )}
                </g>
              );
            })}

            {/* ── Nodes ─────────────────────────────────────────────────────── */}
            {rawNodes.map(node => {
              const pos = nodePos[node.id];
              if (!pos) return null;
              const sel = selectedNode?.id === node.id;
              const s   = typeStyle(node.type);
              const label = node.id.length > 18 ? node.id.slice(0, 16) + "…" : node.id;

              return (
                <g key={node.id}
                  transform={`translate(${pos.x},${pos.y})`}
                  onPointerDown={e => onNodePointerDown(e, node)}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={onNodePointerUp}
                  className="cursor-pointer"
                  style={{ filter: sel ? "url(#glow-sel)" : "none" }}
                >
                  {sel && (
                    <circle r={node.r + 7} fill="none"
                      stroke="#22d3ee" strokeWidth={2} opacity={0.85} className="animate-pulse" />
                  )}
                  {node.type === "RiskEvent" && (
                    <circle r={node.r + 6} fill="none"
                      stroke="#f59e0b" strokeWidth={1.5} opacity={0.3} className="animate-ping" />
                  )}

                  {/* Body */}
                  <circle r={node.r}
                    fill={s.fill}
                    stroke={sel ? "#22d3ee" : "#07090f"}
                    strokeWidth={sel ? 2.5 : 1.5}
                  />
                  {/* Subtle inner highlight */}
                  <circle r={node.r * 0.42} cx={-node.r * 0.22} cy={-node.r * 0.25}
                    fill="white" opacity={0.1} className="pointer-events-none" />

                  {/* Label — two-pass for dark outline readability */}
                  {[true, false].map(isOutline => (
                    <text key={isOutline ? "o" : "f"}
                      y={node.r + 15}
                      textAnchor="middle"
                      fill={isOutline ? "#07090f" : "#cbd5e1"}
                      fontSize={node.deg > 3 ? "10px" : "9px"}
                      fontWeight={node.deg > 3 ? "bold" : "normal"}
                      fontFamily="ui-sans-serif, system-ui, sans-serif"
                      stroke={isOutline ? "#07090f" : "none"}
                      strokeWidth={isOutline ? "3" : "0"}
                      className="pointer-events-none"
                    >
                      {label}
                    </text>
                  ))}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* ── Inspector sidebar ────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[270px] border-t lg:border-t-0 lg:border-l border-slate-800/80 bg-slate-950 flex flex-col shrink-0 overflow-hidden">
        <div className="p-3 border-b border-slate-800/60 flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h4 className="font-extrabold text-slate-200 text-[11px] uppercase tracking-wider">Entity Inspector</h4>
          <span className="ml-auto text-[9px] text-slate-600 font-mono">{links.length} edges</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {selectedNode ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                <div className="text-[8px] uppercase tracking-widest text-slate-500 font-mono mb-1">Entity</div>
                <div className="font-black text-slate-100 text-sm leading-tight">{selectedNode.id}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono"
                    style={{
                      background: typeStyle(selectedNode.type).fill + "25",
                      color: typeStyle(selectedNode.type).fill,
                      border: `1px solid ${typeStyle(selectedNode.type).fill}50`,
                    }}
                  >
                    {selectedNode.type}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {selectedNode.deg} connection{selectedNode.deg !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              {/* Raw properties */}
              <div className="space-y-1 font-mono text-[10px]">
                {Object.entries(selectedNode).map(([k, v]) => {
                  if (["id", "type", "r", "deg"].includes(k)) return null;
                  return (
                    <div key={k} className="flex justify-between gap-2 py-1 border-b border-slate-900">
                      <span className="text-slate-500 capitalize shrink-0">{k.replace(/_/g, " ")}</span>
                      <span className="text-slate-300 text-right font-bold break-all">{String(v)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Connected edges */}
              <div>
                <p className="text-[8px] uppercase tracking-widest text-slate-500 font-mono mb-1.5">Connected Edges</p>
                <div className="space-y-1">
                  {links
                    .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                    .map((l, i) => (
                      <div key={i} className="text-[10px] px-2 py-1 bg-slate-900/60 border border-slate-800/60 rounded flex items-center gap-1.5 font-mono">
                        <span className="text-slate-400 truncate">
                          {l.source === selectedNode.id ? l.target : l.source}
                        </span>
                        {l.relationship && (
                          <span className="text-[8px] text-slate-600 shrink-0 ml-auto">
                            {l.relationship}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center space-y-3 py-12">
              <Info className="w-10 h-10 opacity-20" />
              <p className="text-[11px] leading-relaxed px-4">
                Click any node to inspect its properties and connections.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HudBtn({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
