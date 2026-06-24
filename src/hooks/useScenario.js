import { useState, useCallback } from "react";

const API = "http://localhost:8000";

// Maps a preset to the {chokePoint, blockagePct} used for solution/currency lookups
const PRESET_PARAMS = {
  "Hormuz Partial Closure": { choke_point: "Strait of Hormuz", blockage_pct: 50 },
  "OPEC+ Emergency Cut": { choke_point: "Strait of Hormuz", blockage_pct: 30 },
  "Red Sea shipping suspension": { choke_point: "Bab-el-Mandeb", blockage_pct: 100 },
};

export function useScenario() {
  const [chokePoint, setChokePoint] = useState("Strait of Hormuz");
  const [blockagePct, setBlockagePct] = useState(50);
  const [activePreset, setActivePreset] = useState("");

  const [nlText, setNlText] = useState("");

  const [simData, setSimData] = useState(null);
  const [solution, setSolution] = useState([]); // procurement recs with coords
  const [currency, setCurrency] = useState(null);
  const [advisory, setAdvisory] = useState(null); // scenario-wide Gemini advisory
  const [currencyPolicy, setCurrencyPolicy] = useState(null);
  const [parsed, setParsed] = useState(null); // scenario banner {title, summary, severity, dynamic, volume_at_risk_pct}
  const [governance, setGovernance] = useState(null); // crisis-governance Gemini markdown
  const [sprData, setSprData] = useState(null); // national reserve (SPR) optimisation result
  const [shortage, setShortage] = useState(null); // {unavoidable, uncovered_gap_pct, reality}
  const [dynCtx, setDynCtx] = useState(null); // dynamic-scenario grounding for advisory/arc-click reuse

  const [isRunning, setIsRunning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [nlParsing, setNlParsing] = useState(false);

  const reset = useCallback(() => {
    setActivePreset("");
    setChokePoint("Strait of Hormuz");
    setBlockagePct(50);
    setNlText("");
    setSimData(null);
    setSolution([]);
    setCurrency(null);
    setAdvisory(null);
    setCurrencyPolicy(null);
    setParsed(null);
    setGovernance(null);
    setSprData(null);
    setShortage(null);
    setDynCtx(null);
    setHasRun(false);
  }, []);

  const loadPreset = useCallback((name) => {
    setActivePreset(name);
    const p = PRESET_PARAMS[name];
    if (p && name !== "OPEC+ Emergency Cut") {
      setChokePoint(p.choke_point);
      setBlockagePct(p.blockage_pct);
    } else if (p) {
      setBlockagePct(p.blockage_pct);
    }
  }, []);

  // Fire all scenario fetches: fast data first, then the Gemini advisories.
  // `override` lets the NL flow pass freshly-parsed params without waiting for
  // the chokePoint/blockagePct state setters to flush.
  const runScenario = useCallback(async (override) => {
    setIsRunning(true);
    setHasRun(true);
    setAdvisory(null);
    setCurrencyPolicy(null);
    setGovernance(null);
    // Leaving the dynamic (NL) path → clear its banner/shortage/grounding
    setParsed(null);
    setShortage(null);
    setDynCtx(null);

    // Resolve the choke point / blockage used for downstream coord-based lookups
    const preset = !override && activePreset ? activePreset : "";
    const params = override
      ? { choke_point: override.choke_point, blockage_pct: override.blockage_pct }
      : preset && PRESET_PARAMS[preset]
        ? PRESET_PARAMS[preset]
        : { choke_point: chokePoint, blockage_pct: blockagePct };

    try {
      // 1) Fast, non-LLM data in parallel
      const simUrl = preset
        ? `${API}/api/scenario/preset?name=${encodeURIComponent(preset)}`
        : `${API}/api/scenario/simulate?choke_point=${encodeURIComponent(params.choke_point)}&blockage_pct=${params.blockage_pct}`;

      const [simRes, recsRes, curRes, sprRes] = await Promise.all([
        fetch(simUrl),
        fetch(`${API}/api/procurement/recs?refinery=${encodeURIComponent("Jamnagar Refinery")}&choke_point=${encodeURIComponent(params.choke_point)}&blockage_pct=${params.blockage_pct}`),
        fetch(`${API}/api/currency?choke_point=${encodeURIComponent(params.choke_point)}&blockage_pct=${params.blockage_pct}`),
        fetch(`${API}/api/spr/optimize?choke_point=${encodeURIComponent(params.choke_point)}&blockage_pct=${params.blockage_pct}`),
      ]);

      if (simRes.ok) setSimData(await simRes.json());
      if (recsRes.ok) {
        const recs = await recsRes.json();
        const list = (recs.recommendations || []).filter((r) => r.source_coords && r.dest_coords);
        setSolution(list.slice(0, 4)); // top 4 arcs
      }
      if (curRes.ok) setCurrency(await curRes.json());
      if (sprRes.ok) setSprData(await sprRes.json());
    } catch (e) {
      console.error("Scenario run failed:", e);
    } finally {
      setIsRunning(false);
    }

    // 2) Gemini advisories (slower) — don't block the visual solution
    setAiLoading(true);
    try {
      const [advRes, polRes, govRes] = await Promise.all([
        fetch(`${API}/api/scenario/advisory`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...params, refinery: "Jamnagar Refinery" }),
        }),
        fetch(`${API}/api/currency/policy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }),
        fetch(`${API}/api/scenario/governance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...params, severity: override?.severity || "" }),
        }),
      ]);
      if (advRes.ok) setAdvisory((await advRes.json()).advisory);
      if (polRes.ok) setCurrencyPolicy((await polRes.json()).policy);
      if (govRes.ok) setGovernance((await govRes.json()).governance);
    } catch (e) {
      console.error("Gemini advisory failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, [activePreset, chokePoint, blockagePct]);

  // Build the "Source (region) via route: …" line a focused advisory expects
  const routeLine = (r) =>
    r ? `${r.source_grade} (${r.region}) via ${r.route}: delivered $${r.delivered_cost_bbl}/bbl, `
        + `lead time ${r.lead_time_days} days, compatibility ${r.compatibility_pct}%, `
        + `tanker availability ${r.vessel_availability}, sanctions risk ${r.sanctions_risk}.`
      : "";

  // Dynamic flow: Gemini analyses the free text → bespoke routes + impact + honest
  // shortage verdict; currency/SPR are grounded server-side; advisories run on that.
  const runFromNaturalLanguage = useCallback(async (text) => {
    const desc = (text || "").trim();
    if (!desc) return;

    setNlParsing(true);
    setIsRunning(true);
    setHasRun(true);
    setActivePreset("");
    setParsed(null); setShortage(null); setGovernance(null);
    setAdvisory(null); setCurrencyPolicy(null);

    let ctx = null;
    try {
      const res = await fetch(`${API}/api/scenario/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: desc }),
      });
      if (!res.ok) throw new Error(`analyze failed: ${res.status}`);
      const a = await res.json();

      const routes = (a.routes || []).filter((r) => r.source_coords && r.dest_coords);
      setParsed({ title: a.title, summary: a.summary, severity: a.severity, dynamic: true,
                  volume_at_risk_pct: a.impact.volume_at_risk_pct });
      setSimData(a.sim_data);
      setSolution(routes);
      setCurrency(a.currency);
      setSprData(a.spr);
      setShortage(a.shortage);

      ctx = {
        dynamic: true, summary: a.summary, severity: a.severity, ...a.impact,
        shortage_reality: a.shortage.reality, shortage_unavoidable: a.shortage.unavoidable,
        route_line: routeLine(routes[0]),
      };
      setDynCtx(ctx);
    } catch (e) {
      console.error("NL scenario analyze failed:", e);
    } finally {
      setIsRunning(false);
      setNlParsing(false);
    }

    if (!ctx) return;

    // Gemini advisories (slower) — grounded in the analysed scenario
    setAiLoading(true);
    try {
      const [advRes, polRes, govRes] = await Promise.all([
        fetch(`${API}/api/scenario/advisory`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refinery: "Jamnagar Refinery", ctx }),
        }),
        fetch(`${API}/api/currency/policy`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ctx }),
        }),
        fetch(`${API}/api/scenario/governance`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ctx }),
        }),
      ]);
      if (advRes.ok) setAdvisory((await advRes.json()).advisory);
      if (polRes.ok) setCurrencyPolicy((await polRes.json()).policy);
      if (govRes.ok) setGovernance((await govRes.json()).governance);
    } catch (e) {
      console.error("Gemini advisory failed:", e);
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Fetch a procurement+policy advisory scoped to a single source (on-globe arc click).
  // `rec` is the clicked route object. In dynamic mode we ground it in the analysed
  // scenario + this route; in legacy mode we pass the choke point + source grade.
  const fetchSourceAdvisory = useCallback(async (rec) => {
    let body;
    if (dynCtx) {
      body = { refinery: "Jamnagar Refinery", source_grade: rec.source_grade,
               ctx: { ...dynCtx, route_line: routeLine(rec) } };
    } else {
      const params = activePreset && PRESET_PARAMS[activePreset]
        ? PRESET_PARAMS[activePreset]
        : { choke_point: chokePoint, blockage_pct: blockagePct };
      body = { ...params, source_grade: rec.source_grade, refinery: "Jamnagar Refinery" };
    }
    const res = await fetch(`${API}/api/scenario/advisory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()).advisory;
    return "Unable to load advisory.";
  }, [dynCtx, activePreset, chokePoint, blockagePct]);

  return {
    chokePoint, blockagePct, activePreset, nlText,
    simData, solution, currency, advisory, currencyPolicy,
    parsed, governance, sprData, shortage,
    isRunning, aiLoading, hasRun, nlParsing,
    setChokePoint, setBlockagePct, setActivePreset, setNlText,
    loadPreset, runScenario, runFromNaturalLanguage, reset, fetchSourceAdvisory,
  };
}
