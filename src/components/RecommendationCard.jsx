import React, { useState } from "react";
import { ArrowRight, Compass, ShieldAlert, Sparkles, X, ChevronRight } from "lucide-react";

const RECOMMENDATIONS = {
  strait_of_hormuz: [
    {
      rank: 1,
      source: "Nigeria (Bonny Light)",
      route: "West Africa → Cape of Good Hope → India West Coast",
      costDelta: "+$2.10 / bbl",
      delay: "+9.8 Days",
      compatibility: "97% (Sulphur & API Match)",
      tankersAvailable: "4 VLCCs queued",
      details: "Direct substitution for Basrah Light. Tankers should route south around South Africa to avoid Middle East chokepoints entirely."
    },
    {
      rank: 2,
      source: "Brazil (Lula)",
      route: "Angra dos Reis → Cape of Good Hope → Kochi Port",
      costDelta: "+$2.65 / bbl",
      delay: "+12.5 Days",
      compatibility: "92% (Medium Sour Equivalent)",
      tankersAvailable: "2 VLCCs in spot pool",
      details: "Excellent compatibility for Jamnagar Refinery. Requires hedging due to higher spot freight premiums on Atlantic voyages."
    }
  ],
  bab_el_mandeb: [
    {
      rank: 1,
      source: "US Gulf Coast (WTI Midland)",
      route: "Houston → Cape of Good Hope → Mangalore Refinery",
      costDelta: "+$1.45 / bbl",
      delay: "+8.2 Days",
      compatibility: "98% (Sweet Crude Equivalent)",
      tankersAvailable: "3 VLCCs fixture confirmed",
      details: "Replaces European and Mediterranean imports impacted by Suez-Red Sea route suspension. Spot arbitrage window is currently open."
    },
    {
      rank: 2,
      source: "West Africa (Girassol)",
      route: "Angola → Cape of Good Hope → Mumbai Terminals",
      costDelta: "+$1.90 / bbl",
      delay: "+7.0 Days",
      compatibility: "94% (Sweet / Medium Acid Match)",
      tankersAvailable: "1 Suezmax available",
      details: "Rapid transit relative to US Gulf. Recommend booking immediate spot tankers before West African premiums rise due to diversion demands."
    }
  ],
  suez_canal: [
    {
      rank: 1,
      source: "Saudi Crude (Yanbu Port)",
      route: "Red Sea (Yanbu) → Strait of Hormuz → Vadinar Port",
      costDelta: "+$0.75 / bbl",
      delay: "+3.5 Days",
      compatibility: "100% (Arab Light Direct Replacement)",
      tankersAvailable: "Immediate charter available",
      details: "Yanbu terminal bypasses Suez blockage. Direct pipeline link from Eastern Province fields enables uninterrupted supply."
    }
  ],
  strait_of_malacca: [
    {
      rank: 1,
      source: "Middle East (Murban)",
      route: "Fujairah → Arabian Sea → Kochi Port",
      costDelta: "+$0.40 / bbl",
      delay: "+2.0 Days",
      compatibility: "96% (Direct replacement)",
      tankersAvailable: "Vessels currently in Arabian Sea",
      details: "Redirect imports meant for East Coast terminals to West Coast ports (Kochi/Mangalore) to bypass Malacca blockages."
    }
  ]
};

export default function RecommendationCard({ selectedChokePoint }) {
  const [briefOpen, setBriefOpen] = useState(false);
  const recs = RECOMMENDATIONS[selectedChokePoint] || [];

  // Generate automated executive brief text
  const generateBrief = () => {
    switch (selectedChokePoint) {
      case "strait_of_hormuz":
        return `EXECUTIVE BRIEF: Strait of Hormuz Disruption Level 4
Current Brent spot price reflects a geopolitical risk premium of ~$1.85/bbl due to naval exercises. In response, the Antigravity Orchestrator has generated a procurement reroute. 

Key Action Items:
1. Immediately execute purchase of 2M bbl of Nigerian Bonny Light to replace Basrah Light deficits.
2. Order active tankers carrying Persian Gulf imports to execute Cape of Good Hope transit rules. This will delay arrivals by 9.8 days but completely secures the energy corridor.
3. Coordinate with Jamnagar and Kochi refineries regarding the slightly higher API of Lula crude to adjust blend profiles.`;
      case "bab_el_mandeb":
        return `EXECUTIVE BRIEF: Red Sea Shipping Suspension Analysis
With military actions in the Red Sea corridor rising, standard Suez canal routes are highly compromised. Disruption probability is 65%.

Key Action Items:
1. Re-route all Indian-bound crude from Europe/Med around South Africa.
2. Confirm fixture of 3 VLCCs carrying US WTI Midland out of Houston. This sweet crude matches refinery requirements closely, buffering the loss of Brent-indexed Med crudes.
3. Open discussion with the Ministry regarding SPR drawdown of sweet crude if arrival delays exceed 10 days.`;
      default:
        return `EXECUTIVE BRIEF: Corridor Status Normal/Elevated
Logistics risk indices are within manageable tolerances. No immediate emergency crude substitution is required. Continue to monitor AIS vessel density and spot pricing.`;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col h-full justify-between">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <Compass className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Orchestration & Rerouting</h3>
            <p className="text-[10px] text-slate-400">Ranked alternate sourcing plans for current corridor</p>
          </div>
        </div>
        
        <button
          onClick={() => setBriefOpen(true)}
          className="flex items-center space-x-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-[10px] rounded-lg transition-colors cursor-pointer uppercase shadow-lg shadow-cyan-600/10"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Executive Brief</span>
        </button>
      </div>

      {/* Alternatives List */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {recs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs py-4">
            No alternatives required for low risk score.
          </div>
        ) : (
          recs.map((rec) => (
            <div 
              key={rec.rank} 
              className="p-3 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/60 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-start space-x-3 max-w-xl">
                <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-cyan-400 font-bold font-mono shrink-0">
                  {rec.rank}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">{rec.source}</span>
                    <span className="text-[9px] text-slate-400 px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded">
                      {rec.compatibility}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-mono">
                    <span className="text-[10px] text-slate-500 font-sans">Route:</span>
                    {rec.route}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">{rec.details}</p>
                </div>
              </div>

              {/* Stats Column */}
              <div className="grid grid-cols-2 md:flex md:flex-col gap-2 shrink-0 text-[11px] md:text-right border-t md:border-t-0 border-slate-900 pt-2 md:pt-0">
                <div>
                  <div className="text-slate-500 text-[9px] uppercase">Est. Cost Delta</div>
                  <span className="font-bold text-amber-400 font-mono">{rec.costDelta}</span>
                </div>
                <div>
                  <div className="text-slate-500 text-[9px] uppercase">Logistics Delay</div>
                  <span className="font-bold text-cyan-400 font-mono">{rec.delay}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI Brief Modal Overlay */}
      {briefOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center space-x-2 text-cyan-400">
                <Sparkles className="w-5 h-5" />
                <h4 className="font-bold text-slate-200 text-sm font-sans">Gemini AI Executive Briefing</h4>
              </div>
              <button 
                onClick={() => setBriefOpen(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
              {generateBrief()}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end space-x-2">
              <button
                onClick={() => setBriefOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold font-sans cursor-pointer transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
