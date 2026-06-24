import React from "react";
import { Play, RotateCcw, Zap, Loader2, Radio, Sparkles } from "lucide-react";

const CHOKE_POINTS_LIST = ["Strait of Hormuz", "Bab-el-Mandeb", "Suez Canal", "Strait of Malacca"];

const PRESETS = [
  { name: "Hormuz Partial Closure", label: "Hormuz Partial Closure (50%)" },
  { name: "OPEC+ Emergency Cut", label: "OPEC+ Emergency Cut (30%)" },
  { name: "Red Sea shipping suspension", label: "Red Sea Suspension (100%)" },
];

const NL_EXAMPLES = [
  "Drone strikes shut the Strait of Hormuz, halting half of tanker traffic",
  "Houthi attacks force all shipping out of the Red Sea",
  "OPEC+ announces a surprise 3M bpd production cut",
];

export default function ScenarioControls({ scenario, shipCount = 0 }) {
  const {
    chokePoint, blockagePct, activePreset, isRunning,
    nlText, nlParsing, setNlText, runFromNaturalLanguage,
    setChokePoint, setBlockagePct, setActivePreset, loadPreset, runScenario, reset,
  } = scenario;

  const opecLocked = activePreset === "OPEC+ Emergency Cut";
  const nlBusy = nlParsing || isRunning;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 space-y-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="font-extrabold text-slate-100 text-xs uppercase tracking-wider">Scenario Lab</h3>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1 text-[10px] uppercase font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </div>

      {/* Live AIS count */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-900/50">
        <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono text-slate-400">{shipCount} vessels tracked live</span>
      </div>

      {/* Natural-language scenario */}
      <div className="space-y-2 p-2.5 rounded-lg border border-cyan-900/50 bg-cyan-950/10">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-cyan-400">Describe a Scenario</label>
        </div>
        <textarea
          value={nlText}
          onChange={(e) => setNlText(e.target.value)}
          placeholder="e.g. Drone strikes shut the Strait of Hormuz, halting half of tanker traffic…"
          rows={3}
          disabled={nlBusy}
          className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-2.5 py-2 rounded-lg text-[11px] leading-relaxed outline-none focus:border-cyan-500/80 resize-none disabled:opacity-50 placeholder:text-slate-600"
        />
        <div className="flex flex-wrap gap-1">
          {NL_EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setNlText(ex)}
              disabled={nlBusy}
              className="text-[9px] px-1.5 py-0.5 rounded border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-cyan-300 hover:border-cyan-800 cursor-pointer disabled:opacity-50 truncate max-w-full"
              title={ex}
            >
              {ex.length > 34 ? ex.slice(0, 34) + "…" : ex}
            </button>
          ))}
        </div>
        <button
          onClick={() => runFromNaturalLanguage(nlText)}
          disabled={nlBusy || !nlText.trim()}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-[11px] uppercase tracking-wider transition-all cursor-pointer"
        >
          {nlParsing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Interpreting…</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Scenario</>}
        </button>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">Preset Incidents</label>
        <div className="space-y-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => loadPreset(p.name)}
              className={`w-full p-2.5 rounded-lg border text-xs font-semibold text-left cursor-pointer transition-all ${
                activePreset === p.name
                  ? "bg-red-950/40 border-red-500 text-red-400 shadow-md shadow-red-900/10"
                  : "bg-slate-900/40 border-slate-800/60 hover:bg-slate-900/80 text-slate-300"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom inputs */}
      <div className="space-y-3 pt-2 border-t border-slate-800">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider font-mono text-slate-500">Target Corridor</label>
          <select
            value={chokePoint}
            onChange={(e) => { setActivePreset(""); setChokePoint(e.target.value); }}
            disabled={opecLocked}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold outline-none focus:border-cyan-500/80 disabled:opacity-50"
          >
            {CHOKE_POINTS_LIST.map((cp) => <option key={cp} value={cp}>{cp}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider font-mono">
            <span className="text-slate-500">Flow Blockage</span>
            <span className="text-cyan-400">{blockagePct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={blockagePct}
            onChange={(e) => { setActivePreset(""); setBlockagePct(Number(e.target.value)); }}
            disabled={opecLocked}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Run button */}
      <button
        onClick={runScenario}
        disabled={isRunning}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-cyan-900/30"
      >
        {isRunning ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><Play className="w-4 h-4" /> Run Scenario</>}
      </button>

      <p className="text-[10px] text-slate-500 leading-relaxed pt-1">
        Running projects the cascading impact, draws alternative procurement routes onto the globe,
        and generates Gemini policy advisories. Click an arc on the globe for source-specific detail.
      </p>
    </div>
  );
}
