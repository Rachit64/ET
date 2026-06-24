import React, { useEffect, useState } from "react";
import { AlertTriangle, ShieldAlert, DollarSign, Activity, FileText } from "lucide-react";

// Mock database of signals by chokepoint
const SIGNALS_DB = {
  strait_of_hormuz: [
    {
      id: "sh-1",
      type: "geopolitical",
      title: "Iran Naval Drill in Strait Entrance",
      desc: "Revolutionary Guard announces sudden 48-hour live-fire drills starting tonight.",
      score: 82,
      time: "2 mins ago",
      icon: ShieldAlert
    },
    {
      id: "sh-2",
      type: "ais",
      title: "AIS Anomaly: VLCC Loitering",
      desc: "Supertanker 'AL-HORMUZ' (MMSI: 235098234) running dark, loitering 4nm off corridor path.",
      score: 74,
      time: "15 mins ago",
      icon: Activity
    },
    {
      id: "sh-3",
      type: "commodity",
      title: "Brent Premium Spike",
      desc: "Middle East logistics risk premium adds +$1.85/bbl in Singapore spot markets.",
      score: 68,
      time: "1 hour ago",
      icon: DollarSign
    },
    {
      id: "sh-4",
      type: "sanctions",
      title: "OFAC Blacklists Tanker Fleet",
      desc: "3 chemical tankers frequently transiting Hormuz added to US SDN sanctions list.",
      score: 89,
      time: "2 hours ago",
      icon: FileText
    }
  ],
  bab_el_mandeb: [
    {
      id: "bm-1",
      type: "geopolitical",
      title: "Drone Attack Warning",
      desc: "UKMTO issues advisory warning of suspected UAV activity 30nm southwest of Mokha.",
      score: 88,
      time: "5 mins ago",
      icon: ShieldAlert
    },
    {
      id: "bm-2",
      type: "ais",
      title: "Mass AIS Spoofing Detected",
      desc: "Multiple vessels reporting identical GPS coordinates near Bab el-Mandeb chokepoint.",
      score: 67,
      time: "32 mins ago",
      icon: Activity
    },
    {
      id: "bm-3",
      type: "commodity",
      title: "Insurance War-Risk Premium Hike",
      desc: "Lloyd's underwriters increase Red Sea transit premium by 0.5% of hull value.",
      score: 80,
      time: "2 hours ago",
      icon: DollarSign
    }
  ],
  suez_canal: [
    {
      id: "sc-1",
      type: "ais",
      title: "Suez Canal Congestion Peak",
      desc: "Southbound convoy delayed by 4 hours due to minor mechanical failure of cargo vessel.",
      score: 45,
      time: "12 mins ago",
      icon: Activity
    },
    {
      id: "sc-2",
      type: "geopolitical",
      title: "Suez Canal Toll Adjustment",
      desc: "SCA announces 8% increase in transit fees for crude tankers starting next month.",
      score: 38,
      time: "3 hours ago",
      icon: FileText
    }
  ],
  strait_of_malacca: [
    {
      id: "sm-1",
      type: "geopolitical",
      title: "Armed Robbery Attempt Reported",
      desc: "Reconnaissance vessel reports attempt on container ship in Eastbound lane near Singapore Strait.",
      score: 54,
      time: "45 mins ago",
      icon: ShieldAlert
    },
    {
      id: "sm-2",
      type: "ais",
      title: "Haze Causes Visibility Restrictions",
      desc: "Sumatran agricultural burns drop visibility below 2nm, triggering speed restrictions.",
      score: 32,
      time: "1 hour ago",
      icon: Activity
    }
  ]
};

export default function RiskSignalFeed({ selectedChokePoint }) {
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    // Load signals for the selected choke point
    const rawSignals = SIGNALS_DB[selectedChokePoint] || [];
    setSignals(rawSignals);
  }, [selectedChokePoint]);

  const getScoreColor = (score) => {
    if (score >= 75) return "text-red-500 border-red-500/30 bg-red-950/20";
    if (score >= 50) return "text-amber-500 border-amber-500/30 bg-amber-950/20";
    return "text-emerald-500 border-emerald-500/30 bg-emerald-950/20";
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          <h2 className="font-bold text-slate-100 tracking-wide text-sm uppercase">Risk Signal Feed</h2>
        </div>
        <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
          LIVE
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 text-center p-4">
            <ShieldAlert className="w-8 h-8 opacity-20" />
            <p className="text-xs">No active disruption signals in this corridor.</p>
          </div>
        ) : (
          signals.map((sig) => {
            const Icon = sig.icon;
            return (
              <div 
                key={sig.id} 
                className="p-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-lg transition-all duration-200 flex flex-col space-y-2 relative overflow-hidden group"
              >
                {/* Accent glow on hover */}
                <div className="absolute top-0 left-0 w-[2px] h-full bg-slate-800 group-hover:bg-cyan-500 transition-all duration-300"></div>
                
                <div className="flex justify-between items-start pl-1">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-md bg-slate-800 text-slate-300">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] uppercase font-mono tracking-wider text-slate-400">
                      {sig.type}
                    </span>
                  </div>
                  <div className={`px-2 py-0.5 border text-[10px] rounded font-mono font-semibold ${getScoreColor(sig.score)}`}>
                    DP: {sig.score}
                  </div>
                </div>

                <div className="pl-1">
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-slate-100 transition-colors">
                    {sig.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {sig.desc}
                  </p>
                </div>

                <div className="flex justify-end pt-1 pl-1 border-t border-slate-900/60">
                  <span className="text-[9px] text-slate-500 font-mono">
                    {sig.time}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
