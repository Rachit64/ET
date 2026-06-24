# Graph Report - ET Hackathon  (2026-06-24)

## Corpus Check
- 37 files · ~29,976 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 276 nodes · 336 edges · 25 communities (19 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_WebSocket API Server|WebSocket API Server]]
- [[_COMMUNITY_Agent UI Components|Agent UI Components]]
- [[_COMMUNITY_Currency & Data Services|Currency & Data Services]]
- [[_COMMUNITY_Risk Assessment Engine|Risk Assessment Engine]]
- [[_COMMUNITY_Project Configuration|Project Configuration]]
- [[_COMMUNITY_AIS Vessel Tracking|AIS Vessel Tracking]]
- [[_COMMUNITY_Globe Map Visualizer|Globe Map Visualizer]]
- [[_COMMUNITY_Frontend Package Config|Frontend Package Config]]
- [[_COMMUNITY_AIS Backend Client|AIS Backend Client]]
- [[_COMMUNITY_Knowledge Graph RAG|Knowledge Graph RAG]]
- [[_COMMUNITY_Map & Graph Components|Map & Graph Components]]
- [[_COMMUNITY_FastAPI Route Handlers|FastAPI Route Handlers]]
- [[_COMMUNITY_Graphify Knowledge Graph|Graphify Knowledge Graph]]
- [[_COMMUNITY_Linting Configuration|Linting Configuration]]
- [[_COMMUNITY_Procurement Orchestrator|Procurement Orchestrator]]
- [[_COMMUNITY_Static Assets|Static Assets]]
- [[_COMMUNITY_App Startup Script|App Startup Script]]
- [[_COMMUNITY_Hero Image Asset|Hero Image Asset]]
- [[_COMMUNITY_React DOM Root|React DOM Root]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]

## God Nodes (most connected - your core abstractions)
1. `AISService` - 10 edges
2. `RiskAgent` - 9 edges
3. `AISClientManager` - 8 edges
4. `CurrencyService` - 6 edges
5. `KnowledgeGraphService` - 6 edges
6. `ConnectionManager` - 5 edges
7. `periodic_worker()` - 5 edges
8. `_run_spr()` - 5 edges
9. `get_scenario_governance()` - 5 edges
10. `websocket_endpoint()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useAISStream()`  [INFERRED]
  src/App.jsx → src/hooks/useAISStream.js
- `App()` --calls--> `useScenario()`  [INFERRED]
  src/App.jsx → src/hooks/useScenario.js

## Import Cycles
- None detected.

## Communities (25 total, 6 thin omitted)

### Community 0 - "WebSocket API Server"
Cohesion: 0.06
Nodes (43): AdvisoryRequest, CurrencyPolicyRequest, _derive_severity(), get_ai_executive_brief(), get_currency(), get_currency_policy(), get_knowledge_graph(), get_preset() (+35 more)

### Community 1 - "Agent UI Components"
Cohesion: 0.06
Nodes (24): AgentReasoningPanel(), LOGS_DB, ChatCopilot(), BACKGROUND, CORRIDOR_MAPPINGS, GlobeMap(), MapContainer(), RecommendationCard() (+16 more)

### Community 2 - "Currency & Data Services"
Cohesion: 0.20
Nodes (5): CurrencyService, Live USD/INR data + a transparent oil-shock depreciation model. No API key requi, Fetch the live USD/INR spot rate (open.er-api.com, falling back to frankfurter.a, Fetch a daily USD/INR time series for the sparkline (frankfurter.app)., Transparent model: India bills crude imports in USD, so an oil-price spike widen

### Community 3 - "Risk Assessment Engine"
Cohesion: 0.10
Nodes (14): Any, _GeminiRateLimiter, Fetch crude oil spot prices from EIA API., Fetch oil/crude/shipping/blockade news articles from GDELT., Invoke Gemini 2.5 Flash to analyze a news article and compute disruption paramet, Run the geopolitical agent flow: fetch news and extract risk signals., Return currently loaded risk signals., Send a prompt to the configured Gemini models, honouring the         per-minute (+6 more)

### Community 4 - "Project Configuration"
Cohesion: 0.10
Nodes (18): AI Energy Supply Chain Resilience Command, MapLibre GL, dependencies, autoprefixer, deck.gl, @deck.gl/core, @deck.gl/extensions, @deck.gl/layers (+10 more)

### Community 5 - "AIS Vessel Tracking"
Cohesion: 0.14
Nodes (9): AISService, Interpolate point and compute heading along a MultiPoint route line., Return the current active vessels., Simulate ship movements by progressing them along their routes., Continuous simulation loop., Background task to connect to aisstream.io WebSockets.         If it fails, auto, Parse live AIS reports and inject/update active tanker lists., Classify a location into a choke point corridor based on coordinate boxes. (+1 more)

### Community 6 - "Globe Map Visualizer"
Cohesion: 0.33
Nodes (3): KnowledgeGraphView(), TYPE_STYLE, typeStyle()

### Community 7 - "Frontend Package Config"
Cohesion: 0.12
Nodes (15): devDependencies, oxlint, @types/react, @types/react-dom, vite, @vitejs/plugin-react, name, private (+7 more)

### Community 8 - "AIS Backend Client"
Cohesion: 0.19
Nodes (4): AISClientManager, get_choke_point_for_coords(), Returns the key of the choke point if coordinates fall within its bbox, else Non, Queue

### Community 9 - "Knowledge Graph RAG"
Cohesion: 0.22
Nodes (5): KnowledgeGraphService, Convert the NetworkX graph to a d3-compatible node-link JSON structure., Run a Graph-RAG query using NetworkX node traversal and Gemini., Construct the baseline NetworkX energy supply chain graph., Inject active news and risk signals as dynamic nodes connected to corridors.

### Community 10 - "Map & Graph Components"
Cohesion: 0.28
Nodes (5): KnowledgeGraph(), CHOKE_POINTS, CORRIDOR_LINES, Map(), REFINERIES

### Community 11 - "FastAPI Route Handlers"
Cohesion: 0.19
Nodes (8): ConnectionManager, websocket_endpoint(), get_chokepoints(), lifespan(), Returns the configuration of all maritime choke points., websocket_endpoint(), FastAPI, WebSocket

### Community 12 - "Graphify Knowledge Graph"
Cohesion: 0.47
Nodes (6): GRAPH_REPORT.md - Architecture Overview, graphify explain - focused concept explanation, graphify path - relationship tracing, graphify query - codebase Q&A, graphify update - incremental graph refresh, Knowledge Graph (graphify-out/)

### Community 13 - "Linting Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 15 - "Static Assets"
Cohesion: 0.33
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + Vite

## Knowledge Gaps
- **56 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `CHOKE_POINTS` (+51 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_run_spr()` connect `WebSocket API Server` to `Risk Assessment Engine`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Project Configuration` to `Frontend Package Config`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `WebSocket API Server` be split into smaller, more focused modules?**
  _Cohesion score 0.06236786469344609 - nodes in this community are weakly interconnected._
- **Should `Agent UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._
- **Should `Risk Assessment Engine` be split into smaller, more focused modules?**
  _Cohesion score 0.10114942528735632 - nodes in this community are weakly interconnected._
- **Should `Project Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._