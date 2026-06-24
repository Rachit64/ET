import React, { useEffect, useState, useRef } from "react";
import { Terminal, Play, Cpu, AlertTriangle } from "lucide-react";

// Mock streaming logs generated dynamically based on selected choke point
const LOGS_DB = {
  strait_of_hormuz: [
    { agent: "SYSTEM", text: "Initializing analysis pipeline for Strait of Hormuz..." },
    { agent: "GEOPOLITICAL", text: "Ingesting 14 news events from GDELT DOC API..." },
    { agent: "GEOPOLITICAL", text: "Extracted signal: 'Iran Naval Drill'. Sentiment score: -0.82 (High tension)." },
    { agent: "GEOPOLITICAL", text: "Sanctions registry cross-check: Found 3 blacklisted tankers in proximity." },
    { agent: "GEOPOLITICAL", text: "Recalculating corridor disruption score... Current score: 78/100 (CRITICAL)." },
    { agent: "SCENARIO", text: "Triggering Cascade Modeller: Strait of Hormuz partial closure." },
    { agent: "SCENARIO", text: "Simulating 20% flow restriction (approx. 4.2M bpd diverted/delayed)." },
    { agent: "SCENARIO", text: "Impact estimates: Refinery run rates -8.4%, Domestic Diesel +₹4.20/L, Power reserves -3 days." },
    { agent: "ORCHESTRATOR", text: "Procurement Agent activated: Querying alternative sour crude grades." },
    { agent: "ORCHESTRATOR", text: "Evaluating compatibility: Mangalore refinery (needs Arabian Light equivalent)." },
    { agent: "ORCHESTRATOR", text: "Ranked Alternatives: 1. Nigeria (Bonny Light), 2. Brazil (Lula)." },
    { agent: "ORCHESTRATOR", text: "Route optimization completed: Rerouting around Cape of Good Hope (+9.8 days transit)." },
    { agent: "SYSTEM", text: "Procurement plan generated. Executive briefing ready for export." }
  ],
  bab_el_mandeb: [
    { agent: "SYSTEM", text: "Initializing analysis pipeline for Bab el-Mandeb (Red Sea)..." },
    { agent: "GEOPOLITICAL", text: "Scanning regional AIS data for spoofing/dark vessel signatures..." },
    { agent: "GEOPOLITICAL", text: "Found 12 cargo vessels disabling AIS within 15nm of Houthi coastal battery." },
    { agent: "GEOPOLITICAL", text: "Disruption probability score updated: 65/100 (HIGH RISK)." },
    { agent: "SCENARIO", text: "Running Red Sea shipping suspension model." },
    { agent: "SCENARIO", text: "Assumed: 100% Suez-bound tankers forced to reroute via Cape of Good Hope." },
    { agent: "SCENARIO", text: "Economic output: Spot freight rates +35%, Indian imports delay: 10-12 days." },
    { agent: "ORCHESTRATOR", text: "Orchestrating adaptive procurement: Sourcing from US Gulf Coast (WTI) and West Africa." },
    { agent: "ORCHESTRATOR", text: "Refinery configuration match: Kochi Refinery compat: 94%." },
    { agent: "ORCHESTRATOR", text: "Tanker matching: 2 VLCC fixtures available at spot rate $64k/day." },
    { agent: "SYSTEM", text: "Adaptive routing plan finalized. Outputted to dashboard drawer." }
  ],
  suez_canal: [
    { agent: "SYSTEM", text: "Initializing analysis pipeline for Suez Canal..." },
    { agent: "GEOPOLITICAL", text: "Monitoring Suez Canal Authority traffic updates..." },
    { agent: "GEOPOLITICAL", text: "Corridor queue time: 4.5 hours (within normal deviation limits)." },
    { agent: "GEOPOLITICAL", text: "Disruption probability score: 42/100 (MEDIUM RISK)." },
    { agent: "SCENARIO", text: "Simulating temporary blockage scenario (e.g. vessel grounded)." },
    { agent: "SCENARIO", text: "GDP impact projection: Negligible if < 7 days; CPI inflation +0.08% if > 14 days." },
    { agent: "ORCHESTRATOR", text: "Optimizing supply buffers. Recommended Action: Maintain current bookings, tap SPR if delay > 5 days." },
    { agent: "SYSTEM", text: "Analysis completed. Normal ops resume." }
  ],
  strait_of_malacca: [
    { agent: "SYSTEM", text: "Initializing analysis pipeline for Strait of Malacca..." },
    { agent: "GEOPOLITICAL", text: "Reviewing regional security alerts and weather advisories..." },
    { agent: "GEOPOLITICAL", text: "Haze index high. Shipping advisory: Caution in speed, but lanes open." },
    { agent: "GEOPOLITICAL", text: "Disruption probability score: 28/100 (LOW RISK)." },
    { agent: "SCENARIO", text: "Simulating piracy threat level spike." },
    { agent: "SCENARIO", text: "Security cost impact: Armed escorts addition +$25k/transit. Fuel consumption +2%." },
    { agent: "ORCHESTRATOR", text: "No rerouting required. Recommend procuring standard security escorts." },
    { agent: "SYSTEM", text: "Analysis completed. Status green." }
  ]
};

export default function AgentReasoningPanel({ selectedChokePoint }) {
  const [logs, setLogs] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Clear logs and start "streaming" them
    setLogs([]);
    setIsProcessing(true);
    
    const targetLogs = LOGS_DB[selectedChokePoint] || [];
    let currentIndex = 0;

    const streamInterval = setInterval(() => {
      if (currentIndex < targetLogs.length) {
        const nextLog = targetLogs[currentIndex];
        if (nextLog) {
          setLogs((prev) => [...prev, nextLog]);
        }
        currentIndex++;
      } else {
        clearInterval(streamInterval);
        setIsProcessing(false);
      }
    }, 450); // Speed of streaming logs (450ms per line)

    return () => {
      clearInterval(streamInterval);
    };
  }, [selectedChokePoint]);

  // Scroll to bottom whenever new logs are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getAgentStyles = (agent) => {
    switch (agent) {
      case "SYSTEM":
        return { label: "SYS", color: "text-slate-400", bg: "bg-slate-900 border-slate-800" };
      case "GEOPOLITICAL":
        return { label: "GEO_INTEL", color: "text-cyan-400", bg: "bg-cyan-950/30 border-cyan-800/50" };
      case "SCENARIO":
        return { label: "SCENARIO_MOD", color: "text-amber-400", bg: "bg-amber-950/30 border-amber-800/50" };
      case "ORCHESTRATOR":
        return { label: "ORCHESTRATOR", color: "text-purple-400", bg: "bg-purple-950/30 border-purple-800/50" };
      default:
        return { label: "AGENT", color: "text-slate-400", bg: "bg-slate-800" };
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl font-mono">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <h2 className="font-bold text-slate-100 tracking-wide text-xs uppercase">Agent Reasoning Panel</h2>
        </div>
        {isProcessing && (
          <div className="flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping"></span>
            <span className="text-[9px] text-cyan-400 uppercase tracking-widest animate-pulse">Running</span>
          </div>
        )}
      </div>

      {/* Terminal Output */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/90 text-xs leading-relaxed select-text"
      >
        {logs.map((log, idx) => {
          const styles = getAgentStyles(log.agent);
          return (
            <div key={idx} className="flex flex-col space-y-1 items-start">
              <div className="flex items-center space-x-2">
                <span className="text-[9px] text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${styles.bg} ${styles.color}`}>
                  {styles.label}
                </span>
              </div>
              <p className="text-slate-300 pl-1 whitespace-pre-wrap">{log.text}</p>
            </div>
          );
        })}
        {isProcessing && (
          <div className="flex items-center space-x-1 text-slate-600 text-xs animate-pulse pl-1">
            <span>&gt;_ Thinking...</span>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t border-slate-800/80 bg-slate-950 flex items-center justify-between text-[9px] text-slate-500">
        <span>Model: Gemini 3.5 Flash</span>
        <span>Temp: 0.2</span>
      </div>
    </div>
  );
}
