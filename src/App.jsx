import React, { useState, useRef, useEffect, useCallback } from "react";
import { CHOKE_POINTS } from "./config/chokePoints";
import { useAISStream } from "./hooks/useAISStream";
import MapContainer from "./components/MapContainer";
import RiskSignalFeed from "./components/RiskSignalFeed";
import AgentReasoningPanel from "./components/AgentReasoningPanel";
import RecommendationCard from "./components/RecommendationCard";
import ScenarioLab from "./components/ScenarioLab";
import ScenarioControls from "./components/ScenarioControls";
import KnowledgeGraphView from "./components/KnowledgeGraphView";
import ChatCopilot from "./components/ChatCopilot";
import { useScenario } from "./hooks/useScenario";
import {
  Shield, Radio, ShieldAlert, TrendingUp, Calendar, AlertTriangle, Zap,
  Compass, Network, MessageSquare, Info, X, ChevronLeft, ChevronRight,
  Terminal, LayoutList
} from "lucide-react";

const CORRIDOR_MAPPINGS = {
  strait_of_hormuz: "Strait of Hormuz",
  bab_el_mandeb: "Bab-el-Mandeb",
  suez_canal: "Suez Canal",
  strait_of_malacca: "Strait of Malacca",
};

const MIN_SIDEBAR = 220;
const MAX_SIDEBAR = 560;

export default function App() {
  const [selectedChokePoint, setSelectedChokePoint] = useState("strait_of_hormuz");
  const [activeTab, setActiveTab] = useState("map");

  // Left sidebar state
  const [leftTab, setLeftTab] = useState("corridors"); // "corridors" | "reasoning" | "orchestration"
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(340);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  // Info popup
  const [infoOpen, setInfoOpen] = useState(false);

  const { ships, isConnected } = useAISStream("ws://localhost:8000/ws");

  // Shared scenario state (drives both the left control bar and the center globe)
  const scenario = useScenario();

  const activeShipsInChokePoint = ships.filter(s => s.corridor === CORRIDOR_MAPPINGS[selectedChokePoint]);
  const totalShipsStreamed = ships.length;

  const getRiskColor = (level) => {
    switch (level) {
      case "CRITICAL": return "text-red-500 bg-red-950/30 border-red-800/60 animate-pulse";
      case "HIGH":     return "text-amber-500 bg-amber-950/30 border-amber-800/60";
      case "MEDIUM":   return "text-yellow-500 bg-yellow-950/20 border-yellow-800/40";
      default:         return "text-emerald-500 bg-emerald-950/20 border-emerald-800/40";
    }
  };

  // ── Resize handlers ────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e) => {
    if (sidebarCollapsed) return;
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth, sidebarCollapsed]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const next = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth.current + delta));
      setSidebarWidth(next);
    };
    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ── Left sidebar tab icons/labels ──────────────────────────────────────────
  const leftTabs = [
    { id: "corridors",     icon: <LayoutList className="w-4 h-4" />,  label: "Corridors"     },
    { id: "reasoning",     icon: <Terminal className="w-4 h-4" />,    label: "Agent Reasoning" },
    { id: "orchestration", icon: <Compass className="w-4 h-4" />,     label: "Orchestration" },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060913] text-slate-100 overflow-hidden font-sans select-none">

      {/* ── Slim Top Bar ──────────────────────────────────────────────────── */}
      <header className="h-10 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 flex items-center justify-between shrink-0 relative z-30">
        {/* Brand */}
        <div className="flex items-center space-x-2.5">
          <div className="p-1 bg-cyan-950/30 border border-cyan-800/40 rounded text-cyan-400">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div className="leading-tight">
            <span className="text-[11px] font-extrabold tracking-wider text-slate-100 uppercase">
              Energy Supply Chain Resilience
            </span>
            <span className="hidden md:inline text-[9px] text-slate-500 uppercase tracking-widest font-mono ml-2">
              Digital Twin & Intel Command Center
            </span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center space-x-2">
          {/* AIS status */}
          <div className="flex items-center space-x-1.5 px-2 py-1 rounded border border-slate-800 bg-slate-900/60">
            <Radio className={`w-3 h-3 ${isConnected ? "text-emerald-400 animate-pulse" : "text-red-500"}`} />
            <span className="text-[9px] font-bold font-mono tracking-wider">
              {isConnected ? `AIS ONLINE (${totalShipsStreamed} VSLS)` : "AIS OFFLINE"}
            </span>
          </div>

          {/* Info toggle */}
          <button
            onClick={() => setInfoOpen(v => !v)}
            className={`p-1.5 rounded border transition-all cursor-pointer ${
              infoOpen
                ? "border-cyan-500/80 bg-cyan-950/30 text-cyan-400"
                : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200"
            }`}
            title="Dashboard Info"
          >
            {infoOpen ? <X className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Info popup dropdown */}
        {infoOpen && (
          <div className="absolute top-full right-4 mt-1.5 w-[420px] bg-slate-950/98 border border-slate-800 rounded-xl shadow-2xl p-4 backdrop-blur-md z-50">
            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-mono mb-3">Live KPI Snapshot</p>
            <div className="grid grid-cols-2 gap-3">
              <KpiItem icon={<TrendingUp className="w-4 h-4 text-cyan-400" />} label="Brent Crude" value="$82.40" sub="+1.25%" subColor="text-emerald-400" />
              <KpiItem icon={<Calendar className="w-4 h-4 text-cyan-400" />}   label="India SPR Cover" value="64 Days" />
              <KpiItem icon={<AlertTriangle className="w-4 h-4 text-red-400" />} label="Imports At Risk" value="18.5%" valueColor="text-red-400" />
              <KpiItem icon={<Zap className="w-4 h-4 text-emerald-400" />}    label="Signal Latency" value="1.2s" sub="avg" subColor="text-slate-500" />
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-3">
              <KpiItem label="Active Ships (Corridor)" value={`${activeShipsInChokePoint.length} tracked`} valueColor="text-slate-200" />
              <KpiItem label="Selected Corridor" value={CHOKE_POINTS[selectedChokePoint]?.name} valueColor="text-cyan-300" />
            </div>
          </div>
        )}
      </header>

      {/* ── Main Workspace ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex overflow-hidden w-full">

        {/* ── LEFT SIDEBAR ────────────────────────────────────────────────── */}
        <aside
          className="relative flex shrink-0 h-full border-r border-slate-800/80 bg-slate-950/40 transition-[width] duration-200"
          style={{ width: sidebarCollapsed ? 44 : sidebarWidth }}
        >
          {/* Collapse toggle strip */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-20 w-6 h-10 flex items-center justify-center bg-slate-900 border border-slate-700 rounded-full text-slate-400 hover:text-cyan-400 hover:border-cyan-700 transition-all cursor-pointer shadow-lg"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          {sidebarCollapsed ? (
            /* Collapsed: icon-only vertical tab strip */
            <div className="flex flex-col items-center pt-3 space-y-1 w-full">
              {leftTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSidebarCollapsed(false); setLeftTab(t.id); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                    leftTab === t.id
                      ? "border-cyan-600/70 bg-cyan-950/40 text-cyan-400"
                      : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                  title={t.label}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          ) : activeTab === "scenario" ? (
            /* Scenario Lab takes over the left rail with its own controls */
            <ScenarioControls scenario={scenario} shipCount={totalShipsStreamed} />
          ) : (
            /* Expanded sidebar */
            <div className="flex flex-col w-full h-full overflow-hidden">
              {/* Tab bar */}
              <div className="flex shrink-0 border-b border-slate-800/80 bg-slate-950/60">
                {leftTabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setLeftTab(t.id)}
                    className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer border-b-2 ${
                      leftTab === t.id
                        ? "border-cyan-500 text-cyan-400 bg-cyan-950/10"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t.icon}
                    <span className="hidden lg:block">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab contents */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3">
                {leftTab === "corridors" && (
                  <>
                    {/* Chokepoint selector */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 shadow-md">
                      <h3 className="text-[10px] font-bold text-slate-300 uppercase tracking-widest border-b border-slate-800 pb-2">
                        Select Corridor Focus
                      </h3>
                      <div className="space-y-1.5">
                        {Object.entries(CHOKE_POINTS).map(([key, item]) => {
                          const isActive = key === selectedChokePoint;
                          const count = ships.filter(s => s.corridor === CORRIDOR_MAPPINGS[key]).length;
                          return (
                            <button
                              key={key}
                              onClick={() => setSelectedChokePoint(key)}
                              className={`w-full p-2.5 rounded-lg border text-left transition-all duration-200 cursor-pointer flex items-center justify-between ${
                                isActive
                                  ? "bg-slate-900 border-cyan-500/80 shadow-md shadow-cyan-900/10"
                                  : "bg-slate-900/30 border-slate-800/80 hover:bg-slate-900/60"
                              }`}
                            >
                              <div className="space-y-0.5 min-w-0">
                                <div className="text-xs font-bold text-slate-200 truncate">{item.name}</div>
                                <div className="text-[10px] text-slate-500 line-clamp-1">{item.description}</div>
                              </div>
                              <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                                <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded-full">
                                  {count}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getRiskColor(item.riskLevel)}`}>
                                  {item.riskScore}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Risk Signal Feed */}
                    <div className="flex-1 min-h-[280px]">
                      <RiskSignalFeed selectedChokePoint={selectedChokePoint} />
                    </div>
                  </>
                )}

                {leftTab === "reasoning" && (
                  <div className="h-full min-h-[500px]">
                    <AgentReasoningPanel selectedChokePoint={selectedChokePoint} />
                  </div>
                )}

                {leftTab === "orchestration" && (
                  <div className="min-h-[400px]">
                    <RecommendationCard selectedChokePoint={selectedChokePoint} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resize drag handle (right edge) */}
          {!sidebarCollapsed && (
            <div
              onMouseDown={onResizeMouseDown}
              className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-cyan-500/30 active:bg-cyan-500/50 transition-colors z-10"
              title="Drag to resize"
            />
          )}
        </aside>

        {/* ── CENTER COLUMN ───────────────────────────────────────────────── */}
        <section className="flex-1 flex flex-col h-full min-w-0 bg-[#060913]">

          {/* Center tab nav */}
          <div className="h-11 border-b border-slate-800 bg-slate-950 flex items-center px-3 space-x-0.5 shrink-0">
            {[
              { id: "map",      icon: <Compass className="w-3.5 h-3.5" />,       label: "Live Operations Map" },
              { id: "scenario", icon: <Zap className="w-3.5 h-3.5" />,           label: "Scenario Lab"       },
              { id: "graph",    icon: <Network className="w-3.5 h-3.5" />,       label: "Knowledge Graph"    },
              { id: "chat",     icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Chat Copilot"       },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center space-x-1.5 px-3 h-full border-b-2 text-[11px] font-bold transition-all cursor-pointer ${
                  activeTab === t.id
                    ? "border-cyan-500 text-cyan-400 bg-cyan-950/10"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab view */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {activeTab === "map" && (
              <div className="h-full relative">
                <MapContainer
                  ships={ships}
                  selectedChokePoint={selectedChokePoint}
                  chokePoints={CHOKE_POINTS}
                />
                {/* Overlay callout */}
                <div className="absolute top-4 right-4 z-10 bg-slate-950/95 border border-slate-800/80 backdrop-blur-md p-4 rounded-xl shadow-2xl max-w-xs">
                  <div className="flex justify-between items-start space-x-4">
                    <div>
                      <span className="text-[9px] uppercase font-mono tracking-widest text-cyan-400">Selected Corridor</span>
                      <h2 className="font-extrabold text-slate-100 text-sm mt-0.5">
                        {CHOKE_POINTS[selectedChokePoint]?.name}
                      </h2>
                    </div>
                    <div className={`px-2 py-0.5 border text-[10px] rounded font-mono font-bold uppercase ${getRiskColor(CHOKE_POINTS[selectedChokePoint]?.riskLevel)}`}>
                      {CHOKE_POINTS[selectedChokePoint]?.riskLevel} Risk
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                    {CHOKE_POINTS[selectedChokePoint]?.description}
                  </p>
                  <div className="mt-3 pt-3 border-t border-slate-900 grid grid-cols-2 gap-2 text-[10px] font-mono">
                    <div>
                      <span className="text-slate-500">Live Ships:</span>{" "}
                      <span className="text-slate-200 font-bold">{activeShipsInChokePoint.length} tracked</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Risk Score:</span>{" "}
                      <span className="text-slate-200 font-bold">{CHOKE_POINTS[selectedChokePoint]?.riskScore}/100</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeTab === "scenario" && (
              <ScenarioLab scenario={scenario} ships={ships} chokePoints={CHOKE_POINTS} />
            )}
            {activeTab === "graph"    && <KnowledgeGraphView />}
            {activeTab === "chat"     && <ChatCopilot />}
          </div>
        </section>
      </main>
    </div>
  );
}

/* Small KPI tile for the info popup */
function KpiItem({ icon, label, value, sub, subColor = "text-slate-400", valueColor = "text-slate-200" }) {
  return (
    <div className="flex items-center space-x-2 p-2.5 bg-slate-900/60 rounded-lg border border-slate-800/60">
      {icon && <span className="shrink-0">{icon}</span>}
      <div>
        <div className="text-[9px] uppercase tracking-wider text-slate-500 font-mono">{label}</div>
        <div className={`text-xs font-bold font-mono ${valueColor}`}>
          {value}{" "}
          {sub && <span className={`text-[10px] font-normal ${subColor}`}>{sub}</span>}
        </div>
      </div>
    </div>
  );
}
