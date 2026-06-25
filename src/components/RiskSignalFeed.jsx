import React, { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, ShieldAlert, DollarSign, Activity, FileText,
  CloudRain, RefreshCw, Loader2
} from "lucide-react";

const API_BASE = "http://localhost:8000";
const POLL_MS = 45000;

// Maps the App's choke-point key onto the corridor name the backend tags
// signals with (see CHOKE_POINT_QUERIES in backend/app/services/risk.py).
const CORRIDOR_NAMES = {
  strait_of_hormuz: "Strait of Hormuz",
  bab_el_mandeb: "Bab-el-Mandeb",
  suez_canal: "Suez Canal",
  strait_of_malacca: "Strait of Malacca",
};

// Risk category -> icon. Backend emits Geopolitical / Security / Logistics /
// Sanctions / Weather; we keep a couple of legacy aliases too.
const TYPE_ICONS = {
  Geopolitical: ShieldAlert,
  Security: ShieldAlert,
  Sanctions: FileText,
  Logistics: Activity,
  Weather: CloudRain,
  Commodity: DollarSign,
};

function iconForType(type) {
  return TYPE_ICONS[type] || Activity;
}

function timeAgo(ts) {
  if (!ts) return "";
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins > 1 ? "s" : ""} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export default function RiskSignalFeed({ selectedChokePoint }) {
  const [allSignals, setAllSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const corridorName = CORRIDOR_NAMES[selectedChokePoint];

  const fetchSignals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/signals`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAllSignals(Array.isArray(data.signals) ? data.signals : []);
      setLastUpdate(data.last_update || new Date().toISOString());
      setError(false);
    } catch (e) {
      console.error("Failed to load risk signals:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll the live agent feed.
  useEffect(() => {
    fetchSignals();
    const id = setInterval(fetchSignals, POLL_MS);
    return () => clearInterval(id);
  }, [fetchSignals]);

  // Filter to the corridor in focus, keep only news from the last 5 days,
  // newest first.
  const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
  const signals = allSignals
    .filter((s) => s.corridor === corridorName)
    .filter((s) => {
      const t = new Date(s.timestamp).getTime();
      return Number.isNaN(t) || Date.now() - t <= FIVE_DAYS_MS;
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

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
        <div className="flex items-center space-x-2">
          {lastUpdate && !error && (
            <span className="text-[9px] text-slate-500 font-mono">
              {timeAgo(lastUpdate)}
            </span>
          )}
          <button
            onClick={fetchSignals}
            title="Refresh signals"
            className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono flex items-center space-x-1 ${
            error
              ? "text-red-400 bg-red-950/40"
              : "text-emerald-400 bg-emerald-950/40"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${error ? "bg-red-500" : "bg-emerald-500 animate-pulse"}`} />
            <span>{error ? "OFFLINE" : "LIVE"}</span>
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 text-center p-4">
            <Loader2 className="w-8 h-8 opacity-30 animate-spin" />
            <p className="text-xs">Loading live intelligence feed…</p>
          </div>
        ) : signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-2 text-center p-4">
            <ShieldAlert className="w-8 h-8 opacity-20" />
            <p className="text-xs">
              {error
                ? "Signal feed unreachable. Retrying…"
                : "No active disruption signals in this corridor."}
            </p>
          </div>
        ) : (
          signals.map((sig) => {
            const Icon = iconForType(sig.type);
            const score = Number(sig.probability) || 0;
            return (
              <a
                key={sig.id}
                href={sig.url || "#"}
                target={sig.url ? "_blank" : undefined}
                rel="noreferrer"
                className="p-3 bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800/80 hover:border-slate-700/80 rounded-lg transition-all duration-200 flex flex-col space-y-2 relative overflow-hidden group cursor-pointer block"
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
                  <div className={`px-2 py-0.5 border text-[10px] rounded font-mono font-semibold ${getScoreColor(score)}`}>
                    DP: {score}
                  </div>
                </div>

                <div className="pl-1">
                  <h4 className="text-xs font-semibold text-slate-200 group-hover:text-slate-100 transition-colors">
                    {sig.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    {sig.summary}
                  </p>
                </div>

                <div className="flex justify-between items-center pt-1 pl-1 border-t border-slate-900/60">
                  <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider truncate max-w-[55%]">
                    {sig.source}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {timeAgo(sig.timestamp)}
                  </span>
                </div>
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}
