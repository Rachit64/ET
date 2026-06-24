import React, { useState, useEffect } from "react";
import { HelpCircle, X, Loader2, TrendingDown, IndianRupee, Globe2, ArrowRight, Landmark, Sparkles, ShieldAlert, Database } from "lucide-react";
import GlobeMap from "./GlobeMap";

const SEVERITY_STYLE = {
  critical: { label: "Critical", ring: "border-red-600",      text: "text-red-400",   bg: "bg-red-950/50" },
  severe:   { label: "Severe", ring: "border-red-500/60",   text: "text-red-400",   bg: "bg-red-950/30" },
  elevated: { label: "Elevated", ring: "border-amber-500/60", text: "text-amber-400", bg: "bg-amber-950/20" },
  moderate: { label: "Moderate", ring: "border-cyan-500/50",  text: "text-cyan-400",  bg: "bg-cyan-950/10" },
};

// Backend corridor name -> frontend choke point key (for globe focus)
const NAME_TO_KEY = {
  "Strait of Hormuz": "strait_of_hormuz",
  "Bab-el-Mandeb": "bab_el_mandeb",
  "Suez Canal": "suez_canal",
  "Strait of Malacca": "strait_of_malacca",
};

// ── Minimal markdown renderer (## headings, **bold**, - / 1. lists) ──────────
function MiniMarkdown({ text }) {
  if (!text) return null;
  if (text.startsWith("ERROR:")) {
    return (
      <div className="flex items-start gap-1.5 text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/40 rounded-lg px-2.5 py-2">
        <span className="mt-0.5">⚠</span>
        <span>AI advisory unavailable (Gemini API quota/connectivity). Numeric model + globe solution are still live.</span>
      </div>
    );
  }
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 text-[11px] leading-relaxed text-slate-300">
      {lines.map((raw, i) => {
        const line = raw.trim();
        if (!line) return null;
        if (line.startsWith("## ")) {
          return <h5 key={i} className="text-cyan-400 font-bold uppercase tracking-wider text-[10px] pt-1">{line.slice(3)}</h5>;
        }
        if (line.startsWith("# ")) {
          return <h4 key={i} className="text-slate-100 font-bold text-xs pt-1">{line.slice(2)}</h4>;
        }
        const bolded = line.replace(/\*\*(.+?)\*\*/g, "<b class='text-slate-100'>$1</b>");
        const isList = /^(\d+\.|[-*])\s/.test(line);
        const content = bolded.replace(/^(\d+\.|[-*])\s/, "");
        if (isList) {
          return (
            <div key={i} className="flex gap-1.5 pl-1">
              <span className="text-cyan-500 mt-0.5">▸</span>
              <span dangerouslySetInnerHTML={{ __html: content }} />
            </div>
          );
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: bolded }} />;
      })}
    </div>
  );
}

// ── Hand-rolled SVG sparkline (no chart lib) ─────────────────────────────────
// accessor picks the numeric value from each point (default: currency usd_inr).
// goodWhenRising flips the colour semantics (rising USD/INR is bad → red; rising
// SPR inventory is good → green).
function Sparkline({ series, width = 240, height = 48, accessor = (d) => d.usd_inr, goodWhenRising = false }) {
  if (!series || series.length < 2) return null;
  const values = series.map(accessor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;
  const rising = values[values.length - 1] >= values[0];
  const positive = goodWhenRising ? rising : !rising;
  const stroke = positive ? "#34d399" : "#f87171";
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkfill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.5" fill={stroke} />
    </svg>
  );
}

// ── National-reserve (SPR) chart: 30-day inventory + unmet shortfall, with axes ──
function ReserveChart({ spr }) {
  const inv = spr?.daily_inventory || [];
  const short = spr?.daily_shortfall_remaining || [];
  if (inv.length < 2) return null;

  const W = 340, H = 150, padL = 30, padR = 8, padT = 10, padB = 18;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = inv.length;
  const niceMax = Math.max(Math.ceil(Math.max(...inv, ...short, 1) / 5) * 5, 5);
  const x = (i) => padL + (i / (n - 1)) * plotW;
  const y = (v) => padT + plotH - (Math.max(0, v) / niceMax) * plotH;
  const lineFor = (arr) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const invPath = lineFor(inv);
  const invArea = `${invPath} L${x(n - 1).toFixed(1)},${(padT + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padT + plotH).toFixed(1)} Z`;
  const yticks = [0, niceMax / 2, niceMax];
  const xticks = [0, Math.floor((n - 1) / 2), n - 1];
  const hasShort = short.some((v) => v > 0.01);

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="invfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yticks.map((t, i) => (
          <g key={`y${i}`}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#1e293b" strokeWidth="1" />
            <text x={padL - 4} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#64748b" fontFamily="monospace">{t.toFixed(0)}</text>
          </g>
        ))}
        {xticks.map((i, k) => (
          <text key={`x${k}`} x={x(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">D{i + 1}</text>
        ))}
        <path d={invArea} fill="url(#invfill)" />
        <path d={invPath} fill="none" stroke="#22d3ee" strokeWidth="1.6" />
        {hasShort && <path d={lineFor(short)} fill="none" stroke="#f87171" strokeWidth="1.4" strokeDasharray="3 2" />}
      </svg>
      <div className="flex items-center gap-3 text-[9px] font-mono text-slate-500 mt-1 pl-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-[2px] bg-cyan-400 inline-block" /> SPR inventory (Mb)</span>
        {hasShort && <span className="flex items-center gap-1"><span className="w-2.5 h-[2px] bg-red-400 inline-block" /> Unmet shortfall (Mb)</span>}
      </div>
    </div>
  );
}

export default function ScenarioLab({ scenario, ships = [], chokePoints = {} }) {
  const {
    chokePoint, simData, solution, currency,
    advisory, currencyPolicy, aiLoading, hasRun, isRunning, fetchSourceAdvisory,
    parsed, governance, sprData, shortage,
  } = scenario;

  // On-globe arc click -> procurement detail popover
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceAdvisory, setSourceAdvisory] = useState(null);
  const [sourceLoading, setSourceLoading] = useState(false);

  const onArcClick = async (rec) => {
    setSelectedSource(rec);
    setSourceAdvisory(null);
    setSourceLoading(true);
    try {
      const text = await fetchSourceAdvisory(rec);
      setSourceAdvisory(text);
    } finally {
      setSourceLoading(false);
    }
  };

  // Clear popover when a fresh run replaces the solution
  useEffect(() => { setSelectedSource(null); }, [solution]);

  // Dynamic (NL) scenarios aren't tied to a fixed corridor — don't highlight one.
  // Spin the globe to the centroid of the generated source ports instead.
  const isDynamic = parsed?.dynamic;
  const globeKey = isDynamic ? null : (NAME_TO_KEY[chokePoint] || "strait_of_hormuz");
  const focusCoords = isDynamic && solution.length > 0
    ? [
        solution.reduce((s, r) => s + r.source_coords[0], 0) / solution.length,
        solution.reduce((s, r) => s + r.source_coords[1], 0) / solution.length,
      ]
    : null;

  return (
    <div className="flex flex-col h-full bg-[#060913] overflow-hidden">

      {/* ── Interactive globe ────────────────────────────────────────────── */}
      <div className="relative h-[52%] min-h-[280px] border-b border-slate-800/80">
        <GlobeMap
          ships={ships}
          chokePoints={chokePoints}
          selectedChokePoint={globeKey}
          focusCoords={focusCoords}
          solutionArcs={solution}
          mode="scenario"
          onArcClick={onArcClick}
        />

        {/* Run/empty hint */}
        {!hasRun && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-950/85 border border-slate-800 rounded-xl px-5 py-4 text-center backdrop-blur-md max-w-sm">
              <Globe2 className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-100">Configure a scenario in the left panel</p>
              <p className="text-[11px] text-slate-400 mt-1">Pick a preset or corridor + blockage, then press <span className="text-cyan-400 font-semibold">Run Scenario</span> to project the solution onto the globe.</p>
            </div>
          </div>
        )}

        {/* Solution legend */}
        {solution.length > 0 && (
          <div className="absolute bottom-4 left-4 z-10 bg-slate-950/85 border border-slate-800 rounded-lg px-3 py-2 text-[10px] text-slate-300 backdrop-blur-md pointer-events-none">
            <p className="font-bold text-cyan-400 uppercase tracking-wider mb-1">Alternative Procurement Routes</p>
            <p>Arc width/colour ∝ recommendation score · click an arc for details</p>
          </div>
        )}

        {isRunning && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-950/85 border border-cyan-800/50 rounded-lg px-3 py-1.5 text-[11px] text-cyan-300 backdrop-blur-md">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running model…
          </div>
        )}

        {/* Procurement detail popover (arc click) */}
        {selectedSource && (
          <div className="absolute top-4 right-4 z-20 w-80 max-h-[90%] overflow-y-auto bg-slate-950/95 border border-cyan-800/50 rounded-xl shadow-2xl p-4 backdrop-blur-md text-xs space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[9px] uppercase font-mono tracking-widest text-cyan-400">Procurement Option</span>
                <h4 className="font-extrabold text-slate-100 text-sm">{selectedSource.source_grade}</h4>
                <p className="text-[10px] text-slate-500">{selectedSource.region}</p>
              </div>
              <button onClick={() => setSelectedSource(null)} className="text-slate-400 hover:text-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] text-slate-400 flex items-center gap-1.5 bg-slate-900/60 rounded-lg px-2 py-1.5">
              <span className="font-semibold text-slate-300">{selectedSource.route}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat label="Delivered Cost" value={`$${selectedSource.delivered_cost_bbl}/bbl`} accent />
              <Stat label="Lead Time" value={`${selectedSource.lead_time_days} d`} />
              <Stat label="Compatibility" value={`${selectedSource.compatibility_pct}%`} />
              <Stat label="Tanker Avail." value={selectedSource.vessel_availability} />
              <Stat label="Sanctions Risk" value={selectedSource.sanctions_risk} />
              <Stat label="Score" value={`${selectedSource.score}/100`} accent />
            </div>

            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Landmark className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">AI Rationale & Policy</span>
              </div>
              {sourceLoading ? (
                <div className="flex items-center gap-2 text-cyan-300 text-[11px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consulting Gemini…</div>
              ) : (
                <MiniMarkdown text={sourceAdvisory} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Results strip ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {!simData && (
          <p className="text-[11px] text-slate-500 font-mono text-center py-8">No scenario results yet — describe or configure a scenario to populate cascading impacts, currency outlook, reserves, and crisis-response advisory.</p>
        )}

        {/* AI-analysed scenario banner + honest shortage verdict */}
        {parsed && (() => {
          const sv = SEVERITY_STYLE[parsed.severity] || SEVERITY_STYLE.moderate;
          const crisis = shortage?.unavoidable;
          return (
            <div className={`rounded-xl border ${sv.ring} ${sv.bg} px-4 py-3 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-extrabold text-slate-100 text-sm">{parsed.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{parsed.summary}</p>
                  </div>
                </div>
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${sv.ring} ${sv.text}`}>
                  {sv.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
                <span className="text-slate-500 uppercase tracking-wider">AI assessment</span>
                {parsed.dynamic
                  ? <><span className="text-cyan-300 font-bold">{parsed.volume_at_risk_pct}% of imports at risk</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-cyan-300 font-bold">{solution.length} routes generated</span></>
                  : <><span className="text-cyan-300 font-bold">{parsed.choke_point}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-cyan-300 font-bold">{parsed.blockage_pct}% blockage</span></>}
              </div>

              {/* Honest reality verdict */}
              {shortage?.reality && (
                <div className={`rounded-lg px-3 py-2.5 border flex items-start gap-2 ${
                  crisis ? "bg-red-950/40 border-red-700/60" : "bg-slate-900/50 border-slate-700/50"
                }`}>
                  <ShieldAlert className={`w-4 h-4 mt-0.5 shrink-0 ${crisis ? "text-red-400" : "text-emerald-400"}`} />
                  <div>
                    <span className={`block text-[9px] font-bold uppercase tracking-widest mb-0.5 ${crisis ? "text-red-400" : "text-emerald-400"}`}>
                      {crisis ? "⚠ Reality: Severe Shortage Likely" : "Reality Check"}
                    </span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{shortage.reality}</p>
                    {crisis && (
                      <p className="text-[10px] text-red-300/90 mt-1 font-semibold">
                        Reroutes + reserves cannot fully cover the gap — drastic government measures required (see Crisis Response below).
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Cascading impact pipeline */}
        {simData && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold font-mono tracking-widest text-slate-500 uppercase">Downstream Cascading Impact Pipeline</h4>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <PipelineCard accent="red" tag="1. Supply Shock" title="Imports At Risk"
                main={`${simData.volume_at_risk_pct}%`} sub="of India's maritime crude imports restricted" />
              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-amber-500 to-transparent" />
                <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">2. Refining</span>
                <h5 className="font-extrabold text-slate-200 text-xs mt-1 mb-1.5">Run Rates</h5>
                <div className="space-y-1">
                  {simData.refineries.map((r) => (
                    <div key={r.name} className="flex justify-between items-center text-[10px] font-mono">
                      <span className="text-slate-400">{r.name.split(" ")[0]}</span>
                      <span className={`font-bold ${r.drop_pct > 0 ? "text-amber-500" : "text-slate-400"}`}>{r.current_run_rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <PipelineCard accent="amber" tag="3. Spot Premium" title="Price Escalation"
                main={`+$${simData.price_increase_bbl}`} sub={`/bbl · retail +${simData.fuel_price_rise_pct}%`} />
              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 to-transparent" />
                <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">4. Infrastructure</span>
                <h5 className="font-extrabold text-slate-200 text-xs mt-1">Power Grid Stress</h5>
                <div className="text-xl font-black text-cyan-400 font-mono mt-1">{simData.power_stress_pct}%</div>
                <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2">
                  <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(simData.power_stress_pct, 100)}%` }} />
                </div>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-cyan-500 to-transparent" />
                <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">5. Macro</span>
                <h5 className="font-extrabold text-slate-200 text-xs mt-1 mb-1">GDP / CPI</h5>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[9px] block uppercase">GDP</span>
                    <span className={`font-black ${simData.gdp_delta_pct < 0 ? "text-red-400" : "text-emerald-400"}`}>{simData.gdp_delta_pct}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[9px] block uppercase">CPI</span>
                    <span className="font-black text-red-400">+{simData.cpi_delta_pct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Currency + Advisory */}
        {(currency || advisory || aiLoading) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Currency panel */}
            {currency && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                  <h4 className="font-extrabold text-slate-100 text-sm uppercase tracking-wider">INR Currency Watch</h4>
                </div>

                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-mono text-slate-500">Live USD/INR</span>
                    <div className="text-2xl font-black text-slate-100 font-mono">₹{currency.live.usd_inr}</div>
                    <span className="text-[9px] text-slate-500 font-mono">src: {currency.live.source} · {currency.live.as_of}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-mono text-slate-500">Projected</span>
                    <div className="text-lg font-black text-red-400 font-mono">₹{currency.impact.projected_inr}</div>
                    <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-red-400">
                      <TrendingDown className="w-3 h-3" /> {currency.impact.depreciation_pct}% depreciation
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 rounded-lg p-2">
                  <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1">
                    <span>30-day USD/INR</span>
                    <span>+₹ = weaker rupee</span>
                  </div>
                  <Sparkline series={currency.trend} />
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed">{currency.impact.rationale}</p>

                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">RBI / Fiscal Stabilisation</span>
                  {aiLoading && !currencyPolicy ? (
                    <div className="flex items-center gap-2 text-cyan-300 text-[11px] mt-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consulting Gemini…</div>
                  ) : (
                    <div className="mt-1.5"><MiniMarkdown text={currencyPolicy} /></div>
                  )}
                </div>
              </div>
            )}

            {/* Scenario advisory */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-cyan-400" />
                <h4 className="font-extrabold text-slate-100 text-sm uppercase tracking-wider">Procurement & Policy Advisory</h4>
              </div>
              {aiLoading && !advisory ? (
                <div className="flex items-center gap-2 text-cyan-300 text-[11px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Gemini advisory…</div>
              ) : (
                <MiniMarkdown text={advisory} />
              )}
            </div>
          </div>
        )}

        {/* ── Crisis Response: national reserves + governance ─────────────── */}
        {(sprData || governance || (aiLoading && hasRun)) && (
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold font-mono tracking-widest text-slate-500 uppercase">Crisis Response & Continuity</h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* National reserves (SPR) */}
              {sprData && sprData.metrics && (
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <h4 className="font-extrabold text-slate-100 text-sm uppercase tracking-wider">National Reserves (SPR)</h4>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Days of Cover Left" value={`${sprData.metrics.days_of_cover_remaining} d`} accent />
                    <Stat label="Shortfall Covered" value={`${sprData.metrics.shortfall_covered_pct}%`} accent />
                    <Stat label="Ending Stock" value={`${sprData.metrics.ending_stock_mb} Mb`} />
                    <Stat label="Reserve Fill" value={`${sprData.metrics.inventory_fill_ratio_pct}%`} />
                  </div>

                  <div className={`rounded-lg px-2.5 py-2 text-[10px] font-mono border ${
                    sprData.metrics.exhaustion_risk_days >= 0
                      ? "bg-red-950/30 border-red-900/50 text-red-400"
                      : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                  }`}>
                    {sprData.metrics.exhaustion_risk_days >= 0
                      ? `⚠ Reserves exhaust in ~${sprData.metrics.exhaustion_risk_days} days at the projected gap rate`
                      : "✓ No reserve-exhaustion risk under the projected 30-day gap"}
                  </div>

                  <div className="bg-slate-900/50 rounded-lg p-2.5">
                    <div className="flex justify-between text-[9px] font-mono text-slate-500 mb-1.5">
                      <span className="uppercase tracking-wider">30-Day Reserve Drawdown</span>
                      <span>start {sprData.metrics.initial_stock_mb} Mb → end {sprData.metrics.ending_stock_mb} Mb</span>
                    </div>
                    <ReserveChart spr={sprData} />
                  </div>
                </div>
              )}

              {/* Crisis governance */}
              <div className={`bg-slate-950/60 border rounded-xl p-4 space-y-2 ${
                governance && ["severe", "critical"].includes(parsed?.severity) ? "border-red-900/50" : "border-slate-800"
              }`}>
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`w-4 h-4 ${["severe", "critical"].includes(parsed?.severity) ? "text-red-400" : "text-cyan-400"}`} />
                  <h4 className="font-extrabold text-slate-100 text-sm uppercase tracking-wider">Government & Citizen Response</h4>
                </div>
                {aiLoading && !governance ? (
                  <div className="flex items-center gap-2 text-cyan-300 text-[11px]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating crisis-response measures…</div>
                ) : (
                  <MiniMarkdown text={governance} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Assumptions */}
        {simData && simData.assumptions && (
          <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl space-y-2">
            <h4 className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>Mathematical Model Assumptions</span>
            </h4>
            <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1 text-[11px] leading-relaxed">
              {simData.assumptions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-slate-900/50 rounded-lg px-2 py-1.5">
      <span className="text-[8px] uppercase tracking-wider text-slate-500 font-mono block">{label}</span>
      <span className={`text-[11px] font-bold font-mono ${accent ? "text-cyan-400" : "text-slate-200"}`}>{value}</span>
    </div>
  );
}

function PipelineCard({ accent, tag, title, main, sub }) {
  const grad = { red: "from-red-500", amber: "from-amber-500", cyan: "from-cyan-500" }[accent];
  const text = { red: "text-red-500", amber: "text-amber-400", cyan: "text-cyan-400" }[accent];
  return (
    <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg relative overflow-hidden flex flex-col justify-between">
      <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r ${grad} to-transparent`} />
      <div>
        <span className="text-[9px] uppercase font-mono tracking-wider text-slate-500">{tag}</span>
        <h5 className="font-extrabold text-slate-200 text-xs mt-1">{title}</h5>
      </div>
      <div className="mt-1">
        <span className={`text-xl font-black font-mono ${text}`}>{main}</span>
        <p className="text-[10px] text-slate-400 leading-normal mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
