import asyncio
import json
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

load_dotenv()

from backend.app.services.ais import ais_service
from backend.app.services.risk import risk_agent
from backend.app.services.scenarios import scenario_modeller, CHOKE_POINT_IMPACT_METRICS
from backend.app.services.orchestrator import procurement_orchestrator, REFINERY_COORDS
from backend.app.services.spr import spr_optimizer
from backend.app.services.graph import graph_service
from backend.app.services.currency import currency_service
from backend.app.services.digital_twin import digital_twin_service

# Logging Setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Energy Supply Chain Resilience Command API")

# Enable CORS for React Dev Server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active Connections for WebSocket streaming
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"New WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                # We will prune bad connections during loops if they occur

manager = ConnectionManager()

# Background task for periodic simulations & live AIS updates
async def periodic_worker():
    """Update ship positions and broadcast to connected clients."""
    await asyncio.sleep(1.0) # Grace period
    
    # Run the live AIS websocket connection in a separate async task
    asyncio.create_task(ais_service.connect_live_ais())
    
    # Run risk agent updates periodically in background (every 3 minutes)
    async def risk_loop():
        while True:
            try:
                risk_agent.update_signals()
            except Exception as e:
                logger.error(f"Risk loop update failed: {e}")
            await asyncio.sleep(180)
            
    asyncio.create_task(risk_loop())

    # Main vessel animation and broadcast loop
    while True:
        try:
            # Update simulated vessel steps
            if ais_service.simulation_mode:
                ais_service.update_simulation_step()
                
            # Update Knowledge Graph dynamic nodes with latest signals
            signals = risk_agent.get_latest_signals()
            graph_service.update_risk_nodes(signals)
            
            # Broadcast to web socket clients
            if manager.active_connections:
                payload = {
                    "type": "AIS_UPDATE",
                    "vessels": ais_service.get_vessels(),
                    "live_connected": ais_service.live_connected,
                    "timestamp": datetime.now().isoformat()
                }
                await manager.broadcast(payload)
                
        except Exception as e:
            logger.error(f"Periodic worker error: {e}")
            
        await asyncio.sleep(2.0)

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up FastAPI application...")
    asyncio.create_task(periodic_worker())

# --- API Endpoints ---

@app.get("/api/vessels")
def get_vessels():
    """Get list of active vessels and simulation status."""
    return {
        "vessels": ais_service.get_vessels(),
        "live_connected": ais_service.live_connected,
        "simulation_mode": ais_service.simulation_mode
    }

@app.get("/api/signals")
def get_signals():
    """Get latest news and risk signal feed."""
    return {
        "signals": risk_agent.get_latest_signals(),
        "brent_price": risk_agent.brent_price,
        "wti_price": risk_agent.wti_price,
        "last_update": risk_agent.last_update.isoformat()
    }

@app.post("/api/refresh-signals")
def refresh_signals():
    """Force run the geopolitical risk agent to scrape fresh signals."""
    try:
        signals = risk_agent.update_signals()
        graph_service.update_risk_nodes(signals)
        return {"status": "success", "signals": signals}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/scenario/simulate")
def simulate_scenario(choke_point: str = Query(...), blockage_pct: float = Query(...)):
    """Evaluate cascading economic impacts for custom blockage."""
    return scenario_modeller.simulate(choke_point, blockage_pct)

@app.get("/api/scenario/preset")
def get_preset(name: str = Query(...)):
    """Evaluate cascading economic impacts for preset templates."""
    return scenario_modeller.get_preset_scenario(name)

@app.get("/api/procurement/recs")
def get_procurement_recs(refinery: str = Query(...), choke_point: str = Query("None"), blockage_pct: float = Query(0.0)):
    """Get alternative routing recommendations."""
    return {
        "refinery": refinery,
        "recommendations": procurement_orchestrator.get_recommendations(
            refinery, choke_point, risk_agent.brent_price, blockage_pct
        )
    }

def _spr_from_impact(vol_at_risk_pct: float, price_increase_bbl: float) -> Dict[str, Any]:
    """Build the 30-day supply-gap timeline from scenario impact numbers and optimise
    the SPR drawdown schedule. The single place the reserve-timeline math lives."""
    # Baseline total Indian oil import is roughly 5.0 Million barrels/day
    total_imports_bpd = 5.0 * 1e6
    base_deficit_bpd = total_imports_bpd * (vol_at_risk_pct / 100.0)

    # Generate 30 days of inputs
    supply_gaps = []
    prices = []
    demands = []

    # Simulate a 30-day timeline where the blockage builds up and decays
    brent_base = risk_agent.brent_price
    for t in range(30):
        # Deficit starts high then gets solved or remains high
        # Add slight fluctuation
        multiplier = 1.0
        if t < 5:
            multiplier = 0.5 + (t / 10.0) # Ramp up
        elif t > 22:
            multiplier = max(0.2, 1.0 - ((t - 22) / 8.0)) # Gradual decay

        gap = base_deficit_bpd * multiplier + random.uniform(-50000, 50000)
        supply_gaps.append(max(0.0, gap))

        # Price spikes during deficit
        price = brent_base + (price_increase_bbl * multiplier)
        prices.append(price)

        # Indian refinery demand (roughly 5.3M barrels/day)
        demands.append(5.3 * 1e6)

    return spr_optimizer.optimize_drawdown(supply_gaps, demands, prices)


def _run_spr(choke_point: str, blockage_pct: float) -> Dict[str, Any]:
    """Legacy (manual choke-point) wrapper: derive impact from the numeric model first."""
    sim = scenario_modeller.simulate(choke_point, blockage_pct)
    return _spr_from_impact(sim.get("volume_at_risk_pct", 0.0), sim.get("price_increase_bbl", 0.0))


# Severity tiers, ascending. The numeric model sets a *floor* the LLM cannot soften.
_SEVERITY_ORDER = ["moderate", "elevated", "severe", "critical"]

def _severity_from_vol(vol: float) -> str:
    """Deterministic severity floor from the share of imports at risk."""
    if vol >= 40.0:
        return "critical"
    if vol >= 25.0:
        return "severe"
    if vol >= 12.0:
        return "elevated"
    return "moderate"

def _max_severity(a: str, b: str) -> str:
    ia = _SEVERITY_ORDER.index(a) if a in _SEVERITY_ORDER else 0
    ib = _SEVERITY_ORDER.index(b) if b in _SEVERITY_ORDER else 0
    return _SEVERITY_ORDER[max(ia, ib)]

def _derive_severity(choke_point: str, blockage_pct: float) -> str:
    """Legacy (manual choke-point) severity from the numeric model."""
    sim = scenario_modeller.simulate(choke_point, blockage_pct)
    return _severity_from_vol(sim.get("volume_at_risk_pct", 0.0))


@app.get("/api/spr/optimize")
def get_spr_optimization(choke_point: str = Query("None"), blockage_pct: float = Query(0.0)):
    """Run SPR drawdown schedule optimization based on the active scenario."""
    return _run_spr(choke_point, blockage_pct)

@app.get("/api/graph")
def get_knowledge_graph():
    """Retrieve current Knowledge Graph serialized nodes and links."""
    return graph_service.get_graph_json()

class QueryRequest(BaseModel):
    query: str

@app.post("/api/query")
def query_rag_copilot(req: QueryRequest):
    """Run Graph-RAG Natural Language query."""
    answer = graph_service.execute_rag_query(req.query)
    return {"answer": answer}

@app.get("/api/brief")
def get_ai_executive_brief(choke_point: str = Query("None"), blockage_pct: float = Query(0.0)):
    """Generate dynamic Gemini AI Executive Brief based on the active scenario."""
    sim = scenario_modeller.simulate(choke_point, blockage_pct)
    recs = procurement_orchestrator.get_recommendations("Jamnagar Refinery", choke_point, risk_agent.brent_price, blockage_pct)
    
    top_rec = recs[0]["source_grade"] if recs else "None"
    top_cost = recs[0]["delivered_cost_bbl"] if recs else 0.0
    
    summary_profile = (
        f"Active Incident Choke Point: {choke_point}. "
        f"Flow Blockage Percentage: {blockage_pct}%. "
        f"Indian Import Volume at Risk: {sim.get('volume_at_risk_pct')}% of total imports. "
        f"Projected price spike: +${sim.get('price_increase_bbl')}/bbl ({sim.get('fuel_price_rise_pct')}% rise). "
        f"Refinery run rate impacts: {', '.join([f'{r.get('name')}: {r.get('current_run_rate')}% (drop of {r.get('drop_pct')}%)' for r in sim.get('refineries', [])])}. "
        f"Power sector grid stress: {sim.get('power_stress_pct')}%. "
        f"Macroeconomic Delta: GDP {sim.get('gdp_delta_pct')}%, CPI +{sim.get('cpi_delta_pct')}%. "
        f"Top Alternative Sourcing Option: {top_rec} at delivered cost of ${top_cost}/bbl."
    )
    
    brief = risk_agent.generate_ai_brief(summary_profile)
    return {"brief": brief}

class ScenarioContext(BaseModel):
    """Optional dynamic-scenario grounding shared by the advisory endpoints. When
    `dynamic` is true these values (from /api/scenario/analyze) drive the prompts
    instead of the fixed choke-point numeric model — so every advisory reflects the
    free-text scenario the user actually described."""
    dynamic: bool = False
    summary: str = ""
    severity: str = ""
    volume_at_risk_pct: float = 0.0
    price_increase_bbl: float = 0.0
    fuel_price_rise_pct: float = 0.0
    power_stress_pct: float = 0.0
    gdp_delta_pct: float = 0.0
    cpi_delta_pct: float = 0.0
    shortage_reality: str = ""
    shortage_unavoidable: bool = False
    route_line: str = ""  # prebuilt "Source (region) via route: ..." line for the focused route

class AdvisoryRequest(BaseModel):
    choke_point: str = "None"
    blockage_pct: float = 0.0
    source_grade: str = ""  # optional: focus the advisory on one alternative source
    refinery: str = "Jamnagar Refinery"
    ctx: Optional[ScenarioContext] = None

@app.post("/api/scenario/advisory")
def get_scenario_advisory(req: AdvisoryRequest):
    """Gemini procurement rationale + India-specific domestic policy actions for a scenario.

    Dynamic mode (req.ctx.dynamic): grounded in the analyzed free-text scenario.
    Legacy mode: re-derives impact from the fixed choke-point model. If source_grade is
    provided, the advisory is scoped to that specific alternative source (on-globe arc click)."""
    if req.ctx and req.ctx.dynamic:
        c = req.ctx
        rec_line = c.route_line or "No alternative routing available."
        scenario_line = c.summary or "(free-text scenario)"
        impact = {
            "volume_at_risk_pct": c.volume_at_risk_pct, "price_increase_bbl": c.price_increase_bbl,
            "fuel_price_rise_pct": c.fuel_price_rise_pct, "power_stress_pct": c.power_stress_pct,
            "gdp_delta_pct": c.gdp_delta_pct, "cpi_delta_pct": c.cpi_delta_pct,
        }
        chosen_grade = req.source_grade or None
    else:
        sim = scenario_modeller.simulate(req.choke_point, req.blockage_pct)
        recs = procurement_orchestrator.get_recommendations(
            req.refinery, req.choke_point, risk_agent.brent_price, req.blockage_pct
        )
        chosen = None
        if req.source_grade:
            chosen = next((r for r in recs if r["source_grade"] == req.source_grade), None)
        if chosen is None and recs:
            chosen = recs[0]
        rec_line = "No alternative routing available."
        if chosen:
            rec_line = (
                f"{chosen['source_grade']} ({chosen['region']}) via {chosen['route']}: "
                f"delivered ${chosen['delivered_cost_bbl']}/bbl, lead time {chosen['lead_time_days']} days, "
                f"compatibility {chosen['compatibility_pct']}% with {req.refinery}, "
                f"tanker availability {chosen['vessel_availability']}, sanctions risk {chosen['sanctions_risk']}."
            )
        scenario_line = f'choke point "{req.choke_point}" at {req.blockage_pct}% blockage'
        impact = sim
        chosen_grade = chosen["source_grade"] if chosen else None

    prompt = f"""
    You are India's Energy Security & Trade Policy advisor.
    Scenario: {scenario_line}.
    Impact: {impact.get('volume_at_risk_pct')}% of crude imports at risk, +${impact.get('price_increase_bbl')}/bbl
    spot premium ({impact.get('fuel_price_rise_pct')}% retail fuel rise), power grid stress
    {impact.get('power_stress_pct')}%, GDP {impact.get('gdp_delta_pct')}%, CPI +{impact.get('cpi_delta_pct')}%.
    Recommended alternative procurement: {rec_line}

    Respond in clean Markdown with EXACTLY these two sections:
    ## Procurement Rationale
    2-3 sentences on why this alternative source is the right next move (cost, lead time, compatibility, risk).
    ## Domestic Policy Actions
    A numbered list of 3-4 concrete, costed India-specific policy levers to cushion this shock
    (e.g. SPR drawdown volume, fuel excise/duty cut basis points, OMC under-recovery support,
    rupee-settlement / G2G crude deals, refinery feedstock-mix switching, ethanol blending push).
    Be specific and actionable. No code fences.
    """
    text = risk_agent.gemini_generate(prompt)
    return {"advisory": text, "source_grade": chosen_grade}

@app.get("/api/currency")
def get_currency(choke_point: str = Query("None"), blockage_pct: float = Query(0.0)):
    """Live USD/INR + 30-day trend + scenario-driven depreciation projection (no Gemini, fast)."""
    live = currency_service.get_live()
    trend = currency_service.get_trend(30)
    sim = scenario_modeller.simulate(choke_point, blockage_pct)
    impact = currency_service.project_impact(
        live["usd_inr"], sim.get("price_increase_bbl", 0.0), sim.get("volume_at_risk_pct", 0.0)
    )
    return {"live": live, "trend": trend, "impact": impact}

class CurrencyPolicyRequest(BaseModel):
    choke_point: str = "None"
    blockage_pct: float = 0.0
    ctx: Optional[ScenarioContext] = None

@app.post("/api/currency/policy")
def get_currency_policy(req: CurrencyPolicyRequest):
    """Gemini RBI/fiscal policy actions to defend the rupee under the active scenario."""
    live = currency_service.get_live()
    if req.ctx and req.ctx.dynamic:
        price_inc, vol = req.ctx.price_increase_bbl, req.ctx.volume_at_risk_pct
    else:
        sim = scenario_modeller.simulate(req.choke_point, req.blockage_pct)
        price_inc, vol = sim.get("price_increase_bbl", 0.0), sim.get("volume_at_risk_pct", 0.0)
    impact = currency_service.project_impact(live["usd_inr"], price_inc, vol)

    prompt = f"""
    You are an advisor to the Reserve Bank of India and the Ministry of Finance.
    The rupee is under pressure from an energy supply shock.
    Current USD/INR: {impact['current_inr']}. Projected: {impact['projected_inr']}
    (~{impact['depreciation_pct']}% depreciation). Driver: an extra
    ~${impact['extra_annual_import_bill_usd_bn']}B/yr crude import bill from a
    +${price_inc}/bbl spike, with {vol}% of imports at risk.

    Respond in clean Markdown with:
    ## Currency Impact
    2 sentences summarising the rupee/inflation transmission.
    ## Stabilisation Policy Levers
    A numbered list of 3-4 concrete actions (e.g. FX reserve intervention size, repo-rate stance,
    NDF/forward guidance, rupee-trade settlement, import-duty rationalisation, sovereign/NRI bond issuance).
    Be specific and actionable. No code fences.
    """
    text = risk_agent.gemini_generate(prompt)
    return {"policy": text, "impact": impact, "live": live}

class ScenarioParseRequest(BaseModel):
    text: str

@app.post("/api/scenario/parse")
def parse_scenario(req: ScenarioParseRequest):
    """Turn a free-text scenario description into the structured
    {choke_point, blockage_pct, severity} that drives the rest of the pipeline.

    Gemini extracts the dominant choke point + effective blockage; everything is
    validated/clamped server-side and severity is derived from the numeric model."""
    valid_chokes = list(CHOKE_POINT_IMPACT_METRICS.keys())
    default = {
        "choke_point": "Strait of Hormuz", "blockage_pct": 50.0,
        "severity": _derive_severity("Strait of Hormuz", 50.0),
        "title": "Custom Scenario", "summary": req.text.strip()[:200], "parse_ok": False,
    }

    prompt = f"""
    You are an energy-security analyst. Read the scenario description and map it to the
    single most relevant maritime crude choke point for India and an effective flow
    blockage percentage (0-100). Approximate non-maritime shocks (e.g. an OPEC volume cut
    or a refinery outage) onto the dominant corridor's equivalent blockage.

    Scenario description: "{req.text}"

    Choose choke_point from EXACTLY this list: {valid_chokes}.
    Respond with ONLY a JSON object (no prose, no code fences) of the form:
    {{"choke_point": "<one of the list>", "blockage_pct": <number 0-100>,
      "title": "<<=6 word headline>", "summary": "<one sentence interpretation>"}}
    """
    raw = risk_agent.gemini_generate(prompt, generation_config={"responseMimeType": "application/json"})
    if not raw or raw.startswith("ERROR:"):
        return default

    try:
        parsed = json.loads(raw)
        choke = parsed.get("choke_point", "")
        if choke not in CHOKE_POINT_IMPACT_METRICS:
            choke = "Strait of Hormuz"
        blockage = float(parsed.get("blockage_pct", 50.0))
        blockage = max(0.0, min(100.0, blockage))
        return {
            "choke_point": choke,
            "blockage_pct": round(blockage, 1),
            "severity": _derive_severity(choke, blockage),
            "title": str(parsed.get("title", "Custom Scenario"))[:80],
            "summary": str(parsed.get("summary", req.text.strip()))[:240],
            "parse_ok": True,
        }
    except (json.JSONDecodeError, ValueError, TypeError) as e:
        logger.error(f"Scenario parse failed: {e}; raw={raw[:200]}")
        return default


def _valid_coords(c) -> bool:
    return (
        isinstance(c, (list, tuple)) and len(c) == 2
        and all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in c)
        and -180.0 <= c[0] <= 180.0 and -90.0 <= c[1] <= 90.0
    )

def _clamp(v, lo, hi, default=0.0):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default

class ScenarioAnalyzeRequest(BaseModel):
    text: str

@app.post("/api/scenario/analyze")
def analyze_scenario(req: ScenarioAnalyzeRequest):
    """The dynamic scenario engine. Gemini reads the free-text scenario and returns the
    *entire* scenario-specific dataset — bespoke procurement routes WITH real port
    coordinates, impact numbers, and an honest severity/shortage verdict — instead of
    snapping the scenario onto a fixed choke point. Currency + national-reserve (SPR)
    projections are then computed server-side from those numbers so they stay grounded.

    Severity is floored by the import-volume-at-risk and the shortage verdict is grounded
    in the reserve math, so the model cannot soften a genuine crisis."""
    refinery_list = ", ".join(f"{k} {v}" for k, v in REFINERY_COORDS.items())

    prompt = f"""
    You are India's Energy Security operations analyst. Read the disruption scenario and assess its
    impact on India's crude oil supply. Be realistic and honest — if the disruption removes a large
    share of imports that cannot be physically replaced quickly, say so; do not give false comfort.

    Scenario: "{req.text}"

    India's destination refineries and their [lon, lat] are: {refinery_list}.

    Produce 4 to 6 REALISTIC alternative crude procurement routes India could turn to under THIS
    scenario, each loading from a real port/terminal with accurate [longitude, latitude] coordinates,
    delivering to one of the refineries above. Score each 0-100 (higher = more attractive given cost,
    lead time, crude compatibility, vessel availability and sanctions/geopolitical risk).

    Respond with ONLY a JSON object (no prose, no code fences):
    {{
      "title": "<<=6 word headline>",
      "summary": "<one-sentence interpretation of the scenario>",
      "severity": "moderate|elevated|severe|critical",
      "volume_at_risk_pct": <number 0-100, share of India's crude imports disrupted>,
      "price_increase_bbl": <number, $/bbl spot premium>,
      "fuel_price_rise_pct": <number, retail fuel rise %>,
      "power_stress_pct": <number 0-100>,
      "gdp_delta_pct": <negative number>,
      "cpi_delta_pct": <number>,
      "shortage": {{"unavoidable": <true|false>, "uncovered_gap_pct": <number 0-100>, "reality": "<blunt 1-2 sentence verdict>"}},
      "routes": [
        {{"source_grade": "<crude grade / source>", "region": "<region>", "source_coords": [<lon>, <lat>],
          "dest_refinery": "<one of the refineries above>", "dest_coords": [<lon>, <lat>],
          "route": "<short routing description>", "delivered_cost_bbl": <number>, "lead_time_days": <number>,
          "compatibility_pct": <number 0-100>, "vessel_availability": "High|Medium|Low",
          "sanctions_risk": "Low|Medium|High", "score": <number 0-100>, "rationale": "<one sentence>"}}
      ]
    }}
    """
    raw = risk_agent.gemini_generate(prompt, generation_config={"responseMimeType": "application/json"})
    if not raw or raw.startswith("ERROR:"):
        raise HTTPException(status_code=503, detail="Scenario analysis unavailable (Gemini error).")

    try:
        d = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"analyze parse failed: {e}; raw={raw[:300]}")
        raise HTTPException(status_code=502, detail="Could not parse scenario analysis.")

    # --- Validate / clamp impact numbers ---
    vol = _clamp(d.get("volume_at_risk_pct"), 0.0, 100.0)
    price_inc = round(_clamp(d.get("price_increase_bbl"), 0.0, 250.0), 2)
    fuel_rise = round(_clamp(d.get("fuel_price_rise_pct"), 0.0, 200.0), 1)
    power = round(_clamp(d.get("power_stress_pct"), 0.0, 100.0), 1)
    gdp = round(_clamp(d.get("gdp_delta_pct"), -25.0, 5.0), 2)
    cpi = round(_clamp(d.get("cpi_delta_pct"), -5.0, 30.0), 2)

    # Severity: take the worse of the model's call and the volume-at-risk floor.
    severity = _max_severity(str(d.get("severity", "moderate")).lower(), _severity_from_vol(vol))

    # --- Validate routes ---
    routes = []
    for r in (d.get("routes") or []):
        if not isinstance(r, dict):
            continue
        src = r.get("source_coords")
        if not _valid_coords(src):
            continue
        dest = r.get("dest_coords")
        if not _valid_coords(dest):
            # fall back to the named refinery's coordinates
            dest = REFINERY_COORDS.get(r.get("dest_refinery"))
            if not _valid_coords(dest):
                continue
        routes.append({
            "source_grade": str(r.get("source_grade", "Unknown"))[:60],
            "region": str(r.get("region", ""))[:40],
            "source_coords": [round(float(src[0]), 3), round(float(src[1]), 3)],
            "dest_coords": [round(float(dest[0]), 3), round(float(dest[1]), 3)],
            "route": str(r.get("route", ""))[:120],
            "delivered_cost_bbl": round(_clamp(r.get("delivered_cost_bbl"), 0.0, 500.0), 2),
            "lead_time_days": round(_clamp(r.get("lead_time_days"), 0.0, 120.0), 1),
            "compatibility_pct": round(_clamp(r.get("compatibility_pct"), 0.0, 100.0), 1),
            "vessel_availability": r.get("vessel_availability", "Medium") if r.get("vessel_availability") in ("High", "Medium", "Low") else "Medium",
            "sanctions_risk": r.get("sanctions_risk", "Low") if r.get("sanctions_risk") in ("Low", "Medium", "High") else "Low",
            "score": int(_clamp(r.get("score"), 0.0, 100.0)),
            "rationale": str(r.get("rationale", ""))[:200],
        })
    routes.sort(key=lambda x: x["score"], reverse=True)
    routes = routes[:6]

    # --- Grounded currency + reserve projections ---
    live = currency_service.get_live()
    trend = currency_service.get_trend(30)
    cur_impact = currency_service.project_impact(live["usd_inr"], price_inc, vol)
    currency = {"live": live, "trend": trend, "impact": cur_impact}
    spr = _spr_from_impact(vol, price_inc)
    m = spr.get("metrics", {})

    # --- Honest shortage verdict, grounded in the reserve math ---
    sh = d.get("shortage") if isinstance(d.get("shortage"), dict) else {}
    covered = m.get("shortfall_covered_pct", 100.0)
    exhausts = m.get("exhaustion_risk_days", -1)
    unavoidable = bool(sh.get("unavoidable")) or (
        severity in ("severe", "critical") and (covered < 85.0 or exhausts >= 0)
    )
    reality = str(sh.get("reality", "")).strip()[:400]
    if not reality:
        if unavoidable:
            reality = (
                f"A real oil shortage is likely: ~{vol}% of imports are disrupted and reserves cover only "
                f"{covered}% of the gap" + (f", exhausting in ~{exhausts} days" if exhausts >= 0 else "") +
                ". Reroutes cannot fully replace lost supply in time — drastic demand-side measures will be needed."
            )
        else:
            reality = (
                f"Manageable: ~{vol}% of imports affected, largely coverable via reroutes and reserve drawdown "
                f"({covered}% of the gap covered) without a physical shortage."
            )

    # --- Build a simData-shaped impact so existing cascading-impact cards work ---
    refineries = []
    for name in REFINERY_COORDS:
        expo = 0.9 if "Jamnagar" in name else 0.7 if "Mumbai" in name else 0.65 if "Mangalore" in name else 0.55
        drop = min(round(vol * expo * 0.7, 1), 51.0)
        refineries.append({
            "name": name, "exposure": expo, "baseline_run_rate": 96.0,
            "current_run_rate": round(max(45.0, 96.0 - drop), 1), "drop_pct": round(min(drop, 51.0), 1),
        })
    sim_data = {
        "choke_point": d.get("title", "Custom Scenario"),
        "blockage_pct": vol,
        "volume_at_risk_pct": vol,
        "refineries": refineries,
        "price_increase_bbl": price_inc,
        "fuel_price_rise_pct": fuel_rise,
        "power_stress_pct": power,
        "gdp_delta_pct": gdp,
        "cpi_delta_pct": cpi,
        "assumptions": [
            f"Dynamic scenario: {str(d.get('summary', req.text))[:160]}",
            "Procurement routes generated for this specific scenario (not a fixed choke-point template).",
            "Currency depreciation and SPR drawdown are computed from the modelled import-volume-at-risk.",
        ],
    }

    return {
        "title": str(d.get("title", "Custom Scenario"))[:80],
        "summary": str(d.get("summary", req.text.strip()))[:240],
        "severity": severity,
        "impact": {
            "volume_at_risk_pct": vol, "price_increase_bbl": price_inc, "fuel_price_rise_pct": fuel_rise,
            "power_stress_pct": power, "gdp_delta_pct": gdp, "cpi_delta_pct": cpi,
        },
        "sim_data": sim_data,
        "routes": routes,
        "currency": currency,
        "spr": spr,
        "shortage": {"unavoidable": unavoidable, "uncovered_gap_pct": round(max(0.0, 100.0 - covered), 1), "reality": reality},
    }

class GovernanceRequest(BaseModel):
    choke_point: str = "None"
    blockage_pct: float = 0.0
    severity: str = ""  # optional; recomputed server-side if absent
    ctx: Optional[ScenarioContext] = None

@app.post("/api/scenario/governance")
def get_scenario_governance(req: GovernanceRequest):
    """Gemini crisis-governance advisory: government measures (incl. strict emergency
    controls under severe shortage), national-reserve strategy, and citizen cooperation.
    Returns the grounding SPR schedule alongside so the UI can render both.

    Dynamic mode (req.ctx.dynamic) grounds the prompt in the analyzed free-text scenario;
    legacy mode re-derives impact from the fixed choke-point model."""
    if req.ctx and req.ctx.dynamic:
        c = req.ctx
        vol, price = c.volume_at_risk_pct, c.price_increase_bbl
        impact = {
            "volume_at_risk_pct": vol, "price_increase_bbl": price,
            "fuel_price_rise_pct": c.fuel_price_rise_pct, "power_stress_pct": c.power_stress_pct,
            "gdp_delta_pct": c.gdp_delta_pct, "cpi_delta_pct": c.cpi_delta_pct,
        }
        scenario_line = c.summary or "(free-text scenario)"
        severity = c.severity or _severity_from_vol(vol)
        shortage_reality = c.shortage_reality
        shortage_unavoidable = c.shortage_unavoidable
        spr = _spr_from_impact(vol, price)
    else:
        sim = scenario_modeller.simulate(req.choke_point, req.blockage_pct)
        impact = sim
        scenario_line = f'choke point "{req.choke_point}" at {req.blockage_pct}% blockage'
        severity = req.severity or _derive_severity(req.choke_point, req.blockage_pct)
        vol, price = sim.get("volume_at_risk_pct", 0.0), sim.get("price_increase_bbl", 0.0)
        spr = _spr_from_impact(vol, price)
        shortage_reality = ""
        shortage_unavoidable = False

    m = spr.get("metrics", {})
    # Ground the "tell the truth" verdict in the actual reserve math, not the LLM's mood.
    covered = m.get("shortfall_covered_pct", 100.0)
    exhausts = m.get("exhaustion_risk_days", -1)
    if not shortage_reality:
        shortage_unavoidable = severity in ("severe", "critical") and (covered < 85.0 or exhausts >= 0)

    if severity in ("severe", "critical"):
        escalation = (
            "This is a SEVERE/CRITICAL shock. DO NOT downplay it. State plainly that a real fuel/oil "
            "shortage is likely and that demand will exceed deliverable supply even after reroutes and "
            "reserve drawdown. Prescribe strict, enforceable, drastic controls: fuel rationing/quotas, "
            "odd-even and non-essential driving bans, anti-hoarding enforcement & FIR-backed penalties, "
            "temporary price caps with priority allocation to hospitals/transport/agriculture, and "
            "emergency demand-curtailment of industry/power."
        )
    else:
        escalation = (
            "This is a manageable shortfall — emphasise proportionate demand-management and keep the "
            "strict/emergency section reserved for genuine escalation. Be honest, do not over-dramatise."
        )

    prompt = f"""
    You are India's Energy Security & Civil Contingencies advisor. Be truthful and direct — if the
    situation genuinely means shortages, say so; do not give false reassurance.
    Scenario: {scenario_line}. Severity: {severity}.
    Impact: {impact.get('volume_at_risk_pct')}% of crude imports at risk, +${impact.get('price_increase_bbl')}/bbl
    spot premium ({impact.get('fuel_price_rise_pct')}% retail fuel rise), power grid stress
    {impact.get('power_stress_pct')}%, GDP {impact.get('gdp_delta_pct')}%, CPI +{impact.get('cpi_delta_pct')}%.
    National strategic reserve (SPR): {m.get('days_of_cover_remaining')} days of cover remaining,
    {covered}% of the import shortfall coverable from reserves,
    ending stock {m.get('ending_stock_mb')}M bbl ({m.get('inventory_fill_ratio_pct')}% of capacity),
    exhaustion risk in {exhausts} days (-1 = no exhaustion risk).
    {escalation}

    Respond in clean Markdown with EXACTLY these five sections:
    ## Reality Check
    2-3 blunt sentences stating whether India faces an actual shortage and how bad, given the numbers above.
    ## Government Measures
    A numbered list of 3-4 standard demand-management & coordination steps.
    ## Emergency Measures (Severe Shortage)
    A numbered list of 3-4 strict, drastic controls to prevent chaos/panic, scaled to the severity above.
    ## National Reserve Strategy
    2-3 sentences on how to deploy the SPR, citing the days of cover and shortfall coverage above.
    ## How Citizens Can Cooperate
    A numbered list of 3-4 concrete actions ordinary citizens can take to ease the shock.
    Be specific and actionable. No code fences.
    """
    text = risk_agent.gemini_generate(prompt)
    return {
        "governance": text, "severity": severity, "spr": spr,
        "shortage_unavoidable": shortage_unavoidable, "shortage_reality": shortage_reality,
    }

class SupplyChainSimulateRequest(BaseModel):
    scenario: str

@app.get("/api/supply-chain/infrastructure")
def get_supply_chain_infrastructure():
    """Get India energy supply chain nodes and links."""
    return digital_twin_service.get_infrastructure()

@app.post("/api/supply-chain/simulate")
def simulate_supply_chain(req: SupplyChainSimulateRequest):
    """Run the digital twin grid simulation on a natural-language scenario."""
    try:
        return digital_twin_service.simulate_twin_scenario(req.scenario)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- WebSocket server endpoint ---
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial data immediately upon connection
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "vessels": ais_service.get_vessels(),
            "live_connected": ais_service.live_connected,
            "timestamp": datetime.now().isoformat()
        })
        while True:
            # Keep-alive or handle client messages
            data = await websocket.receive_text()
            logger.info(f"Received WS message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket handler error: {e}")
        manager.disconnect(websocket)
