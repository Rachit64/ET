# Graph Report - .  (2026-06-24)

## Corpus Check
- Corpus is ~32,273 words - fits in a single context window. You may not need a graph.

## Summary
- 284 nodes · 356 edges · 23 communities (18 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backend Main and Scenario Advisory Routing|Backend Main and Scenario Advisory Routing]]
- [[_COMMUNITY_Currency Impact Service|Currency Impact Service]]
- [[_COMMUNITY_Agent UI Panels and Chat Copilot|Agent UI Panels and Chat Copilot]]
- [[_COMMUNITY_App Shell and Map Setup|App Shell and Map Setup]]
- [[_COMMUNITY_WebSocket Connection and Vessel Updates|WebSocket Connection and Vessel Updates]]
- [[_COMMUNITY_Globe Map UI Component|Globe Map UI Component]]
- [[_COMMUNITY_AIS Telemetry Service|AIS Telemetry Service]]
- [[_COMMUNITY_Frontend Project Config|Frontend Project Config]]
- [[_COMMUNITY_AIS Client Stream Manager|AIS Client Stream Manager]]
- [[_COMMUNITY_Knowledge Graph RAG Service|Knowledge Graph RAG Service]]
- [[_COMMUNITY_React Map and Knowledge Graph Components|React Map and Knowledge Graph Components]]
- [[_COMMUNITY_Graphify Documentation|Graphify Documentation]]
- [[_COMMUNITY_Oxlint Linter Rules|Oxlint Linter Rules]]
- [[_COMMUNITY_Procurement Recommendation Orchestrator|Procurement Recommendation Orchestrator]]
- [[_COMMUNITY_SPR Drawdown Optimization|SPR Drawdown Optimization]]
- [[_COMMUNITY_Shell Start Script|Shell Start Script]]
- [[_COMMUNITY_Hero Visual Asset|Hero Visual Asset]]
- [[_COMMUNITY_HTML Root Div|HTML Root Div]]

## God Nodes (most connected - your core abstractions)
1. `AISService` - 10 edges
2. `RiskAgent` - 9 edges
3. `AISClientManager` - 8 edges
4. `analyze_scenario()` - 8 edges
5. `_spr_from_impact()` - 6 edges
6. `get_scenario_governance()` - 6 edges
7. `CurrencyService` - 6 edges
8. `KnowledgeGraphService` - 6 edges
9. `ConnectionManager` - 5 edges
10. `periodic_worker()` - 5 edges

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

## Communities (23 total, 5 thin omitted)

### Community 0 - "Backend Main and Scenario Advisory Routing"
Cohesion: 0.06
Nodes (50): AdvisoryRequest, analyze_scenario(), _clamp(), CurrencyPolicyRequest, _derive_severity(), get_ai_executive_brief(), get_currency(), get_currency_policy() (+42 more)

### Community 1 - "Currency Impact Service"
Cohesion: 0.07
Nodes (19): Any, CurrencyService, Live USD/INR data + a transparent oil-shock depreciation model. No API key requi, Fetch the live USD/INR spot rate (open.er-api.com, falling back to frankfurter.a, Fetch a daily USD/INR time series for the sparkline (frankfurter.app)., Transparent model: India bills crude imports in USD, so an oil-price spike widen, _GeminiRateLimiter, Fetch crude oil spot prices from EIA API. (+11 more)

### Community 2 - "Agent UI Panels and Chat Copilot"
Cohesion: 0.08
Nodes (20): AgentReasoningPanel(), LOGS_DB, ChatCopilot(), KnowledgeGraphView(), TYPE_STYLE, typeStyle(), RecommendationCard(), RECOMMENDATIONS (+12 more)

### Community 3 - "App Shell and Map Setup"
Cohesion: 0.10
Nodes (18): AI Energy Supply Chain Resilience Command, MapLibre GL, dependencies, autoprefixer, deck.gl, @deck.gl/core, @deck.gl/extensions, @deck.gl/layers (+10 more)

### Community 4 - "WebSocket Connection and Vessel Updates"
Cohesion: 0.13
Nodes (13): ConnectionManager, get_vessels(), periodic_worker(), Get list of active vessels and simulation status., Update ship positions and broadcast to connected clients., startup_event(), websocket_endpoint(), get_chokepoints() (+5 more)

### Community 5 - "Globe Map UI Component"
Cohesion: 0.12
Nodes (7): BACKGROUND, CORRIDOR_MAPPINGS, GlobeMap(), MapContainer(), NAME_TO_KEY, ScenarioLab(), SEVERITY_STYLE

### Community 6 - "AIS Telemetry Service"
Cohesion: 0.14
Nodes (9): AISService, Interpolate point and compute heading along a MultiPoint route line., Return the current active vessels., Simulate ship movements by progressing them along their routes., Continuous simulation loop., Background task to connect to aisstream.io WebSockets.         If it fails, auto, Parse live AIS reports and inject/update active tanker lists., Classify a location into a choke point corridor based on coordinate boxes. (+1 more)

### Community 7 - "Frontend Project Config"
Cohesion: 0.12
Nodes (15): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+7 more)

### Community 8 - "AIS Client Stream Manager"
Cohesion: 0.19
Nodes (4): AISClientManager, get_choke_point_for_coords(), Returns the key of the choke point if coordinates fall within its bbox, else Non, Queue

### Community 9 - "Knowledge Graph RAG Service"
Cohesion: 0.22
Nodes (5): KnowledgeGraphService, Convert the NetworkX graph to a d3-compatible node-link JSON structure., Run a Graph-RAG query using NetworkX node traversal and Gemini., Construct the baseline NetworkX energy supply chain graph., Inject active news and risk signals as dynamic nodes connected to corridors.

### Community 10 - "React Map and Knowledge Graph Components"
Cohesion: 0.28
Nodes (5): KnowledgeGraph(), CHOKE_POINTS, CORRIDOR_LINES, Map(), REFINERIES

### Community 11 - "Graphify Documentation"
Cohesion: 0.47
Nodes (6): GRAPH_REPORT.md - Architecture Overview, graphify explain - focused concept explanation, graphify path - relationship tracing, graphify query - codebase Q&A, graphify update - incremental graph refresh, Knowledge Graph (graphify-out/)

### Community 12 - "Oxlint Linter Rules"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

## Knowledge Gaps
- **53 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `CHOKE_POINTS` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_spr_from_impact()` connect `Backend Main and Scenario Advisory Routing` to `Currency Impact Service`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `_run_spr()` connect `Backend Main and Scenario Advisory Routing` to `Currency Impact Service`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _105 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Backend Main and Scenario Advisory Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.05803921568627451 - nodes in this community are weakly interconnected._
- **Should `Currency Impact Service` be split into smaller, more focused modules?**
  _Cohesion score 0.07179487179487179 - nodes in this community are weakly interconnected._
- **Should `Agent UI Panels and Chat Copilot` be split into smaller, more focused modules?**
  _Cohesion score 0.08021390374331551 - nodes in this community are weakly interconnected._
- **Should `App Shell and Map Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._