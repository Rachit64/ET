# Graph Report - .  (2026-06-25)

## Corpus Check
- 46 files · ~67,748 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 314 nodes · 400 edges · 39 communities (27 shown, 12 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI Reasoning & Chat UI|AI Reasoning & Chat UI]]
- [[_COMMUNITY_Risk Agent & Gemini LLM|Risk Agent & Gemini LLM]]
- [[_COMMUNITY_Supply Chain Twin|Supply Chain Twin]]
- [[_COMMUNITY_Globe Map & Corridors|Globe Map & Corridors]]
- [[_COMMUNITY_AIS Vessel Tracking|AIS Vessel Tracking]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_WebSocket & API Gateway|WebSocket & API Gateway]]
- [[_COMMUNITY_AIS Client Manager|AIS Client Manager]]
- [[_COMMUNITY_FastAPI Main App|FastAPI Main App]]
- [[_COMMUNITY_Digital Twin Service|Digital Twin Service]]
- [[_COMMUNITY_Knowledge Graph Service|Knowledge Graph Service]]
- [[_COMMUNITY_Currency Service|Currency Service]]
- [[_COMMUNITY_Scenario Advisory|Scenario Advisory]]
- [[_COMMUNITY_React App & Map Components|React App & Map Components]]
- [[_COMMUNITY_Governance & Severity|Governance & Severity]]
- [[_COMMUNITY_SPR Optimization|SPR Optimization]]
- [[_COMMUNITY_Graphify Graph Report|Graphify Graph Report]]
- [[_COMMUNITY_Lint Configuration|Lint Configuration]]
- [[_COMMUNITY_Vessel Polling Worker|Vessel Polling Worker]]
- [[_COMMUNITY_Procurement Orchestrator|Procurement Orchestrator]]
- [[_COMMUNITY_SPR Optimizer|SPR Optimizer]]
- [[_COMMUNITY_Currency Policy API|Currency Policy API]]
- [[_COMMUNITY_Scenario Parsing|Scenario Parsing]]
- [[_COMMUNITY_RAG Copilot Query|RAG Copilot Query]]
- [[_COMMUNITY_Knowledge Graph API|Knowledge Graph API]]
- [[_COMMUNITY_Preset Scenarios API|Preset Scenarios API]]
- [[_COMMUNITY_Procurement Recs API|Procurement Recs API]]
- [[_COMMUNITY_Market Signals API|Market Signals API]]
- [[_COMMUNITY_Infrastructure API|Infrastructure API]]
- [[_COMMUNITY_Signal Refresh API|Signal Refresh API]]
- [[_COMMUNITY_Scenario Simulation API|Scenario Simulation API]]
- [[_COMMUNITY_Startup Script|Startup Script]]
- [[_COMMUNITY_Hero Image Asset|Hero Image Asset]]
- [[_COMMUNITY_HTML Entry Point|HTML Entry Point]]

## God Nodes (most connected - your core abstractions)
1. `RiskAgent` - 11 edges
2. `AISService` - 10 edges
3. `AISClientManager` - 8 edges
4. `analyze_scenario()` - 8 edges
5. `_spr_from_impact()` - 6 edges
6. `get_scenario_governance()` - 6 edges
7. `CurrencyService` - 6 edges
8. `DigitalTwinService` - 6 edges
9. `KnowledgeGraphService` - 6 edges
10. `ConnectionManager` - 5 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useAISStream()`  [INFERRED]
  src/App.jsx → src/hooks/useAISStream.js
- `App()` --calls--> `useScenario()`  [INFERRED]
  src/App.jsx → src/hooks/useScenario.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Query Tools (query, path, explain)** — claude_graphify_query, claude_graphify_path, claude_graphify_explain [EXTRACTED 0.95]
- **Frontend Technology Stack** — readme_readme, index_html, main_jsx [EXTRACTED 0.90]

## Communities (39 total, 12 thin omitted)

### Community 0 - "AI Reasoning & Chat UI"
Cohesion: 0.07
Nodes (22): AgentReasoningPanel(), LOGS_DB, ChatCopilot(), KnowledgeGraphView(), TYPE_STYLE, typeStyle(), RecommendationCard(), RECOMMENDATIONS (+14 more)

### Community 1 - "Risk Agent & Gemini LLM"
Cohesion: 0.10
Nodes (15): Any, _GeminiRateLimiter, Fetch crude oil spot prices from EIA API., Parse a GDELT article's publish date (``seendate``) into an ISO         timestam, Fetch the most recent news for one choke point and the region around         it, Invoke Gemini to analyze a news article and compute disruption parameters., Run the geopolitical agent flow: pull region-relevant news for every         cho, Return currently loaded risk signals. (+7 more)

### Community 2 - "Supply Chain Twin"
Cohesion: 0.07
Nodes (23): AI Energy Supply Chain Resilience Command, INDIA_BOUNDS, NODE_CLASSES, NODE_ICONS, PRESET_SCENARIOS, SupplyChainTwin(), MapLibre GL, dependencies (+15 more)

### Community 3 - "Globe Map & Corridors"
Cohesion: 0.12
Nodes (7): BACKGROUND, CORRIDOR_MAPPINGS, GlobeMap(), MapContainer(), NAME_TO_KEY, ScenarioLab(), SEVERITY_STYLE

### Community 4 - "AIS Vessel Tracking"
Cohesion: 0.14
Nodes (9): AISService, Interpolate point and compute heading along a MultiPoint route line., Return the current active vessels., Simulate ship movements by progressing them along their routes., Continuous simulation loop., Background task to connect to aisstream.io WebSockets.         If it fails or is, Parse live AIS reports and inject/update active tanker lists., Classify a location into a choke point corridor based on coordinate boxes. (+1 more)

### Community 5 - "Frontend Dependencies"
Cohesion: 0.12
Nodes (15): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+7 more)

### Community 6 - "WebSocket & API Gateway"
Cohesion: 0.19
Nodes (8): ConnectionManager, websocket_endpoint(), get_chokepoints(), lifespan(), Returns the configuration of all maritime choke points., websocket_endpoint(), FastAPI, WebSocket

### Community 7 - "AIS Client Manager"
Cohesion: 0.19
Nodes (4): AISClientManager, get_choke_point_for_coords(), Returns the key of the choke point if coordinates fall within its bbox, else Non, Queue

### Community 8 - "FastAPI Main App"
Cohesion: 0.25
Nodes (10): analyze_scenario(), _clamp(), get_ai_executive_brief(), get_currency(), _max_severity(), Generate dynamic Gemini AI Executive Brief based on the active scenario., Live USD/INR + 30-day trend + scenario-driven depreciation projection (no Gemini, The dynamic scenario engine. Gemini reads the free-text scenario and returns the (+2 more)

### Community 9 - "Digital Twin Service"
Cohesion: 0.22
Nodes (5): DigitalTwinService, Loads normalized infrastructure nodes and links from osm_cache.json., Fallback simulation if Gemini is offline., Return the complete energy supply chain infrastructure nodes and links., Analyze a natural language scenario using Gemini.         Returns disrupted faci

### Community 10 - "Knowledge Graph Service"
Cohesion: 0.22
Nodes (5): KnowledgeGraphService, Convert the NetworkX graph to a d3-compatible node-link JSON structure., Run a Graph-RAG query using NetworkX node traversal and Gemini., Construct the baseline NetworkX energy supply chain graph., Inject active news and risk signals as dynamic nodes connected to corridors.

### Community 11 - "Currency Service"
Cohesion: 0.20
Nodes (5): CurrencyService, Live USD/INR data + a transparent oil-shock depreciation model. No API key requi, Fetch the live USD/INR spot rate (open.er-api.com, falling back to frankfurter.a, Fetch a daily USD/INR time series for the sparkline (frankfurter.app)., Transparent model: India bills crude imports in USD, so an oil-price spike widen

### Community 12 - "Scenario Advisory"
Cohesion: 0.22
Nodes (9): AdvisoryRequest, get_scenario_advisory(), Optional dynamic-scenario grounding shared by the advisory endpoints. When     `, Gemini procurement rationale + India-specific domestic policy actions for a scen, Run the digital twin grid simulation on a natural-language scenario., ScenarioContext, simulate_supply_chain(), SupplyChainSimulateRequest (+1 more)

### Community 13 - "React App & Map Components"
Cohesion: 0.28
Nodes (5): KnowledgeGraph(), CHOKE_POINTS, CORRIDOR_LINES, Map(), REFINERIES

### Community 14 - "Governance & Severity"
Cohesion: 0.33
Nodes (7): _derive_severity(), get_scenario_governance(), GovernanceRequest, Deterministic severity floor from the share of imports at risk., Legacy (manual choke-point) severity from the numeric model., Gemini crisis-governance advisory: government measures (incl. strict emergency, _severity_from_vol()

### Community 15 - "SPR Optimization"
Cohesion: 0.33
Nodes (6): get_spr_optimization(), Build the 30-day supply-gap timeline from scenario impact numbers and optimise, Legacy (manual choke-point) wrapper: derive impact from the numeric model first., Run SPR drawdown schedule optimization based on the active scenario., _run_spr(), _spr_from_impact()

### Community 16 - "Graphify Graph Report"
Cohesion: 0.47
Nodes (6): GRAPH_REPORT.md - Architecture Overview, graphify explain - focused concept explanation, graphify path - relationship tracing, graphify query - codebase Q&A, graphify update - incremental graph refresh, Knowledge Graph (graphify-out/)

### Community 17 - "Lint Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 18 - "Vessel Polling Worker"
Cohesion: 0.40
Nodes (5): get_vessels(), periodic_worker(), Get list of active vessels and simulation status., Update ship positions and broadcast to connected clients., startup_event()

### Community 21 - "Currency Policy API"
Cohesion: 0.67
Nodes (3): CurrencyPolicyRequest, get_currency_policy(), Gemini RBI/fiscal policy actions to defend the rupee under the active scenario.

### Community 22 - "Scenario Parsing"
Cohesion: 0.67
Nodes (3): parse_scenario(), Turn a free-text scenario description into the structured     {choke_point, bloc, ScenarioParseRequest

### Community 23 - "RAG Copilot Query"
Cohesion: 0.67
Nodes (3): query_rag_copilot(), QueryRequest, Run Graph-RAG Natural Language query.

## Knowledge Gaps
- **58 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `CHOKE_POINTS` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_spr_from_impact()` connect `SPR Optimization` to `FastAPI Main App`, `Risk Agent & Gemini LLM`, `Governance & Severity`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `_run_spr()` connect `SPR Optimization` to `FastAPI Main App`, `Risk Agent & Gemini LLM`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `MapLibre GL` connect `Supply Chain Twin` to `React App & Map Components`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _117 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI Reasoning & Chat UI` be split into smaller, more focused modules?**
  _Cohesion score 0.07357357357357357 - nodes in this community are weakly interconnected._
- **Should `Risk Agent & Gemini LLM` be split into smaller, more focused modules?**
  _Cohesion score 0.09848484848484848 - nodes in this community are weakly interconnected._
- **Should `Supply Chain Twin` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._