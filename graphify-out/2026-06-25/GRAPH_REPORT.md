# Graph Report - ET Hackathon  (2026-06-25)

## Corpus Check
- 40 files · ~67,523 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 319 nodes · 408 edges · 26 communities (20 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd941cd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_API Endpoints & Main Routes|API Endpoints & Main Routes]]
- [[_COMMUNITY_Currency Service & Risk Limits|Currency Service & Risk Limits]]
- [[_COMMUNITY_Frontend Reasoning & Dashboard Components|Frontend Reasoning & Dashboard Components]]
- [[_COMMUNITY_Web App Index & Dependency Packages|Web App Index & Dependency Packages]]
- [[_COMMUNITY_WebSocket Connection & Active Vessel Updates|WebSocket Connection & Active Vessel Updates]]
- [[_COMMUNITY_Visualization Globe & Control Panels|Visualization Globe & Control Panels]]
- [[_COMMUNITY_AIS Service & Vessel Simulation|AIS Service & Vessel Simulation]]
- [[_COMMUNITY_Project Configurations & Scripts|Project Configurations & Scripts]]
- [[_COMMUNITY_AIS Client & Choke Point Detection|AIS Client & Choke Point Detection]]
- [[_COMMUNITY_Supply Chain Digital Twin Service|Supply Chain Digital Twin Service]]
- [[_COMMUNITY_Knowledge Graph & Graph RAG Service|Knowledge Graph & Graph RAG Service]]
- [[_COMMUNITY_Map Rendering & Core App Layout|Map Rendering & Core App Layout]]
- [[_COMMUNITY_Graphify Documentation & Commands|Graphify Documentation & Commands]]
- [[_COMMUNITY_Linter Configurations|Linter Configurations]]
- [[_COMMUNITY_Supply Chain Procurement Orchestrator|Supply Chain Procurement Orchestrator]]
- [[_COMMUNITY_Strategic Petroleum Reserve Optimizer|Strategic Petroleum Reserve Optimizer]]
- [[_COMMUNITY_Logo Assets & Documentation|Logo Assets & Documentation]]
- [[_COMMUNITY_Shell Start Scripts|Shell Start Scripts]]
- [[_COMMUNITY_Hero Image Asset|Hero Image Asset]]
- [[_COMMUNITY_HTML Root Element|HTML Root Element]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]

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

## Communities (26 total, 6 thin omitted)

### Community 0 - "API Endpoints & Main Routes"
Cohesion: 0.05
Nodes (55): AdvisoryRequest, analyze_scenario(), _clamp(), CurrencyPolicyRequest, _derive_severity(), get_ai_executive_brief(), get_currency(), get_currency_policy() (+47 more)

### Community 1 - "Currency Service & Risk Limits"
Cohesion: 0.22
Nodes (5): DigitalTwinService, Loads normalized infrastructure nodes and links from osm_cache.json., Fallback simulation if Gemini is offline., Return the complete energy supply chain infrastructure nodes and links., Analyze a natural language scenario using Gemini.         Returns disrupted faci

### Community 2 - "Frontend Reasoning & Dashboard Components"
Cohesion: 0.07
Nodes (22): AgentReasoningPanel(), LOGS_DB, ChatCopilot(), KnowledgeGraphView(), TYPE_STYLE, typeStyle(), RecommendationCard(), RECOMMENDATIONS (+14 more)

### Community 3 - "Web App Index & Dependency Packages"
Cohesion: 0.07
Nodes (23): AI Energy Supply Chain Resilience Command, INDIA_BOUNDS, NODE_CLASSES, NODE_ICONS, PRESET_SCENARIOS, SupplyChainTwin(), MapLibre GL, dependencies (+15 more)

### Community 4 - "WebSocket Connection & Active Vessel Updates"
Cohesion: 0.13
Nodes (13): ConnectionManager, get_vessels(), periodic_worker(), Get list of active vessels and simulation status., Update ship positions and broadcast to connected clients., startup_event(), websocket_endpoint(), get_chokepoints() (+5 more)

### Community 5 - "Visualization Globe & Control Panels"
Cohesion: 0.12
Nodes (7): BACKGROUND, CORRIDOR_MAPPINGS, GlobeMap(), MapContainer(), NAME_TO_KEY, ScenarioLab(), SEVERITY_STYLE

### Community 6 - "AIS Service & Vessel Simulation"
Cohesion: 0.14
Nodes (9): AISService, Interpolate point and compute heading along a MultiPoint route line., Return the current active vessels., Simulate ship movements by progressing them along their routes., Continuous simulation loop., Background task to connect to aisstream.io WebSockets.         If it fails, auto, Parse live AIS reports and inject/update active tanker lists., Classify a location into a choke point corridor based on coordinate boxes. (+1 more)

### Community 7 - "Project Configurations & Scripts"
Cohesion: 0.12
Nodes (15): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+7 more)

### Community 8 - "AIS Client & Choke Point Detection"
Cohesion: 0.19
Nodes (4): AISClientManager, get_choke_point_for_coords(), Returns the key of the choke point if coordinates fall within its bbox, else Non, Queue

### Community 9 - "Supply Chain Digital Twin Service"
Cohesion: 0.11
Nodes (15): Any, _GeminiRateLimiter, Fetch crude oil spot prices from EIA API., Parse a GDELT article's publish date (``seendate``) into an ISO         timestam, Fetch the most recent news for one choke point and the region around         it, Invoke Gemini to analyze a news article and compute disruption parameters., Run the geopolitical agent flow: pull region-relevant news for every         cho, Block until a rate-limit slot is available, then claim it. (+7 more)

### Community 10 - "Knowledge Graph & Graph RAG Service"
Cohesion: 0.22
Nodes (5): KnowledgeGraphService, Convert the NetworkX graph to a d3-compatible node-link JSON structure., Run a Graph-RAG query using NetworkX node traversal and Gemini., Construct the baseline NetworkX energy supply chain graph., Inject active news and risk signals as dynamic nodes connected to corridors.

### Community 11 - "Map Rendering & Core App Layout"
Cohesion: 0.28
Nodes (5): KnowledgeGraph(), CHOKE_POINTS, CORRIDOR_LINES, Map(), REFINERIES

### Community 12 - "Graphify Documentation & Commands"
Cohesion: 0.47
Nodes (6): GRAPH_REPORT.md - Architecture Overview, graphify explain - focused concept explanation, graphify path - relationship tracing, graphify query - codebase Q&A, graphify update - incremental graph refresh, Knowledge Graph (graphify-out/)

### Community 13 - "Linter Configurations"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 16 - "Logo Assets & Documentation"
Cohesion: 0.33
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

### Community 25 - "Community 25"
Cohesion: 0.20
Nodes (5): CurrencyService, Live USD/INR data + a transparent oil-shock depreciation model. No API key requi, Fetch the live USD/INR spot rate (open.er-api.com, falling back to frankfurter.a, Fetch a daily USD/INR time series for the sparkline (frankfurter.app)., Transparent model: India bills crude imports in USD, so an oil-price spike widen

## Knowledge Gaps
- **61 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `CHOKE_POINTS` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_spr_from_impact()` connect `API Endpoints & Main Routes` to `Supply Chain Digital Twin Service`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **Why does `_run_spr()` connect `API Endpoints & Main Routes` to `Supply Chain Digital Twin Service`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `MapLibre GL` connect `Web App Index & Dependency Packages` to `Map Rendering & Core App Layout`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _120 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Endpoints & Main Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.052597402597402594 - nodes in this community are weakly interconnected._
- **Should `Frontend Reasoning & Dashboard Components` be split into smaller, more focused modules?**
  _Cohesion score 0.07357357357357357 - nodes in this community are weakly interconnected._
- **Should `Web App Index & Dependency Packages` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._