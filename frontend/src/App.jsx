import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, Globe, Activity, FileText, Terminal, MessageSquare, 
  TrendingUp, HardHat, Compass, RefreshCw, Play, Sliders, Download, 
  Database, AlertTriangle, CheckCircle, Ship, MapPin, Send
} from 'lucide-react';
import Map from './components/Map';
import KnowledgeGraph from './components/KnowledgeGraph';
import './dashboard.css';

const API_BASE = "http://localhost:8000";

export default function App() {
  // Navigation & View States
  const [selectedChoke, setSelectedChoke] = useState("Global");
  const [activeTab, setActiveTab] = useState("terminal"); // terminal, chat
  const [drawerTab, setDrawerTab] = useState("recs"); // recs, scenarios, spr, graph
  
  // Data States
  const [vessels, setVessels] = useState([]);
  const [isLive, setIsLive] = useState(false);
  const [signals, setSignals] = useState([]);
  const [brentPrice, setBrentPrice] = useState(84.36);
  const [wtiPrice, setWtiPrice] = useState(84.65);
  const [selectedSignal, setSelectedSignal] = useState(null);
  
  // Scenario & Simulation States
  const [activePreset, setActivePreset] = useState("None");
  const [blockagePct, setBlockagePct] = useState(0);
  const [scenarioData, setScenarioData] = useState(null);
  
  // Optimization & Recommendations States
  const [targetRefinery, setTargetRefinery] = useState("Jamnagar Refinery");
  const [procurementRecs, setProcurementRecs] = useState([]);
  const [sprData, setSprData] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  
  // Chat States
  const [chatMessages, setChatMessages] = useState([
    { role: 'copilot', text: "Hello! I am the Antigravity Energy Security Copilot. Ask me anything about geopolitical risks, route disruptions, refinery run rates, or SPR drawdown strategies." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Agent Reasoning Stream States
  const [agentLogs, setAgentLogs] = useState([
    { type: 'sys', text: "[SYS] Energy supply chain intelligence engine initialized." },
    { type: 'sys', text: "[SYS] Ingesting GDELT news corpus, EIA price indices, and live AIS vessel streams..." }
  ]);
  const terminalEndRef = useRef(null);

  // Executive Briefing States
  const [isBriefOpen, setIsBriefOpen] = useState(false);
  const [briefText, setBriefText] = useState("");
  const [isBriefLoading, setIsBriefLoading] = useState(false);

  // Refresh Spinning Status
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. WebSocket for real-time AIS vessel movements
  useEffect(() => {
    let ws;
    const connectWS = () => {
      ws = new WebSocket("ws://localhost:8000/ws");
      
      ws.onopen = () => {
        loggerLog("[SYS] Live AIS WebSocket stream link established.", "success");
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "CONNECTION_ESTABLISHED" || payload.type === "AIS_UPDATE") {
            setVessels(payload.vessels);
            setIsLive(payload.live_connected);
          }
        } catch (e) {
          console.error("WS parse error:", e);
        }
      };

      ws.onclose = () => {
        setIsLive(false);
        // Retry connection in 3 seconds
        setTimeout(connectWS, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWS();
    return () => {
      if (ws) ws.close();
    };
  }, []);

  // 2. Fetch Risk Signals, Prices and base configurations
  const fetchSignals = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`${API_BASE}/api/signals`);
      if (res.ok) {
        const data = await res.json();
        setSignals(data.signals);
        setBrentPrice(data.brent_price);
        setWtiPrice(data.wti_price);
      }
    } catch (e) {
      console.error("Fetch signals error:", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSignals();
    // Refresh signals every 60s
    const tid = setInterval(fetchSignals, 60000);
    return () => clearInterval(tid);
  }, []);

  // Fetch Knowledge Graph nodes
  const fetchGraph = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/graph`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (e) {
      console.error("Fetch graph error:", e);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [signals]);

  // 3. Trigger Scenarios & Cascading Calculations
  const handleSimulate = async (choke, pct) => {
    try {
      const res = await fetch(`${API_BASE}/api/scenario/simulate?choke_point=${encodeURIComponent(choke)}&blockage_pct=${pct}`);
      if (res.ok) {
        const data = await res.json();
        setScenarioData(data);
      }
    } catch (e) {
      console.error("Simulation error:", e);
    }
  };

  // Re-run scenario simulation when selected choke or blockage slider shifts
  useEffect(() => {
    if (activePreset === "None") {
      handleSimulate(selectedChoke, blockagePct);
    }
  }, [selectedChoke, blockagePct, activePreset]);

  // Fetch SPR Drawdowns & Re-route options based on current simulation
  useEffect(() => {
    const fetchRecsAndSPR = async () => {
      const choke = activePreset !== "None" ? 
        (activePreset === "Hormuz Partial Closure" ? "Strait of Hormuz" : "Bab-el-Mandeb") : selectedChoke;
      
      const pct = activePreset !== "None" ? 
        (activePreset === "Hormuz Partial Closure" ? 50 : 100) : blockagePct;

      try {
        // 1. Procurement Recs
        const rRes = await fetch(`${API_BASE}/api/procurement/recs?refinery=${encodeURIComponent(targetRefinery)}&choke_point=${encodeURIComponent(choke)}&blockage_pct=${pct}`);
        if (rRes.ok) {
          const rData = await rRes.json();
          setProcurementRecs(rData.recommendations);
        }

        // 2. SPR Drawdown schedule
        const sRes = await fetch(`${API_BASE}/api/spr/optimize?choke_point=${encodeURIComponent(choke)}&blockage_pct=${pct}`);
        if (sRes.ok) {
          const sData = await sRes.json();
          setSprData(sData);
        }
      } catch (e) {
        console.error("Error fetching SPR or procurement:", e);
      }
    };

    fetchRecsAndSPR();
  }, [selectedChoke, blockagePct, activePreset, targetRefinery]);

  // Scroll Terminal to bottom
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentLogs]);

  const loggerLog = (text, type = "sys") => {
    setAgentLogs(prev => [...prev, { type, text: `[${new Date().toLocaleTimeString()}] ${text}` }]);
  };

  // 4. Scrolling Risk Signal Clicking -> Agent activation sequence
  const handleSelectSignal = (sig) => {
    setSelectedSignal(sig);
    setSelectedChoke(sig.corridor);
    setBlockagePct(sig.probability); // Link blockage slider to disruption probability
    setActivePreset("None");

    // Clear previous logs and run sequence
    setAgentLogs([
      { type: 'sys', text: "[SYS] Event Signal Selected. Activating Geopolitical intelligence workflow..." }
    ]);

    setTimeout(() => loggerLog(`GEOPOLITICAL_AGENT: Ingested risk event: "${sig.title}"`, "agent"), 400);
    setTimeout(() => loggerLog(`GEOPOLITICAL_AGENT: Extracted Affected Corridor -> ${sig.corridor}. Corridor disruption probability calculated at ${sig.probability}%.`, "agent"), 1000);
    setTimeout(() => loggerLog(`DISRUPTION_MODELLER: Activating cascade analysis. Simulating downstream impacts on refinery assets...`, "agent"), 1600);
    setTimeout(() => loggerLog(`DISRUPTION_MODELLER: Casacading delta computed: Jamnagar Run Rate projected to fall to ${96.0 - (sig.probability * 0.17)}%. Power stress rising to ${25.0 + (sig.probability * 0.6)}%.`, "warning"), 2200);
    setTimeout(() => loggerLog(`PROCUREMENT_ORCHESTRATOR: Rerouting initiated. Evaluating alternative sweet/sour crude replacement configurations...`, "agent"), 2800);
    setTimeout(() => loggerLog(`PROCUREMENT_ORCHESTRATOR: Recommending alternative grades (West Africa/Brazil) bypassing the corridor. Recommendations mapped to bottom drawer.`, "success"), 3400);
    setTimeout(() => loggerLog(`SPR_DRAWDOWN_AGENT: Computing optimal drawdown schedules to cover the net import supply gap. Reserve release scheduled.`, "success"), 4000);
  };

  // 5. Handle Preset buttons
  const handlePresetSelect = async (presetName) => {
    setActivePreset(presetName);
    loggerLog(`[SYS] Preset Scenario Selected: "${presetName}". Initializing cascading model...`, "sys");

    try {
      const res = await fetch(`${API_BASE}/api/scenario/preset?name=${encodeURIComponent(presetName)}`);
      if (res.ok) {
        const data = await res.json();
        setScenarioData(data);
        setSelectedChoke(data.choke_point);
        setBlockagePct(data.blockage_pct);
        
        // Agent sequence
        setTimeout(() => loggerLog(`DISRUPTION_MODELLER: Loaded scenario metrics. Total import volume at risk: ${data.volume_at_risk_pct}%.`, "agent"), 400);
        setTimeout(() => loggerLog(`DISRUPTION_MODELLER: Domestic crude spot premiums rise to +$${data.price_increase_bbl}/bbl.`, "warning"), 1000);
        setTimeout(() => loggerLog(`DISRUPTION_MODELLER: Macroeconomic impact: GDP projected at ${data.gdp_delta_pct}% delta. CPI projected at +${data.cpi_delta_pct}% delta.`, "danger"), 1600);
        setTimeout(() => loggerLog(`PROCUREMENT_ORCHESTRATOR: Recalculated alternative sourcing. Spot tanker freight adjustments completed.`, "success"), 2200);
      }
    } catch (e) {
      console.error("Preset load error:", e);
    }
  };

  // 6. Natural-Language Chat Submit
  const handleChatSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput("");
    setIsChatLoading(true);

    loggerLog(`CHAT_COPILOT: Processing NL query: "${userText}"`, "agent");

    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText })
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'copilot', text: data.answer }]);
        loggerLog("CHAT_COPILOT: Response returned with Graph RAG citations.", "success");
      }
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'copilot', text: "Error fetching response from Gemini. Please verify backend state." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // 7. Get Executive Brief
  const triggerBrief = async () => {
    setIsBriefOpen(true);
    setIsBriefLoading(true);
    loggerLog("EXECUTIVE_AGENT: Generating AI Executive Briefing via Gemini...", "agent");
    try {
      const choke = activePreset !== "None" ? 
        (activePreset === "Hormuz Partial Closure" ? "Strait of Hormuz" : "Bab-el-Mandeb") : selectedChoke;
      const pct = activePreset !== "None" ? 
        (activePreset === "Hormuz Partial Closure" ? 50 : 100) : blockagePct;

      const res = await fetch(`${API_BASE}/api/brief?choke_point=${encodeURIComponent(choke)}&blockage_pct=${pct}`);
      if (res.ok) {
        const data = await res.json();
        setBriefText(data.brief);
        loggerLog("EXECUTIVE_AGENT: Executive briefing loaded successfully.", "success");
      }
    } catch (e) {
      setBriefText("Failed to retrieve Executive Briefing. Check connection to Gemini API.");
    } finally {
      setIsBriefLoading(false);
    }
  };

  // 8. Execute Trade Mock
  const handleExecuteProcurement = (gradeName, cost) => {
    loggerLog(`[SYS] Executing procurement routing command...`, "sys");
    loggerLog(`[SYS] Contacting freight broker. Chartering VLCC tanker for ${gradeName} delivery.`, "agent");
    setTimeout(() => {
      loggerLog(`[SUCCESS] Cargo cargo locked: ${gradeName} at delivered price of $${cost}/bbl. Estimated arrival in 22 days.`, "success");
      alert(`Procurement Executed successfully!\nCargo: ${gradeName}\nDelivered Cost: $${cost}/bbl\nStatus: Voyage underway.`);
    }, 1500);
  };

  // 9. Download Briefing PDF Mock
  const handleDownloadPDF = () => {
    const textContent = briefText;
    const blob = new Blob([textContent], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Energy_Resilience_Brief_${selectedChoke.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    loggerLog("EXECUTIVE_AGENT: PDF briefing document downloaded.", "success");
  };

  // Calculate active risk zones to pulse red on map
  const activeRiskZones = {};
  signals.forEach(sig => {
    if (sig.probability > 40) {
      activeRiskZones[sig.corridor] = sig.probability;
    }
  });

  return (
    <div className="dashboard-container">
      {/* Top Header Bar */}
      <header className="top-header">
        <div className="header-left">
          <Globe className="accent-blue-icon" size={22} style={{ color: 'var(--accent-cyan)' }} />
          <h1>ENERGY RESILIENCE SYSTEMS</h1>
          <div className={`live-badge ${isLive ? '' : 'simulated'}`}>
            <span className="dot" />
            <span>AIS: {isLive ? 'Live WebSocket' : 'Kinematic Sim'}</span>
          </div>
        </div>

        <div className="header-right">
          <div className="kpi-container">
            <div className="kpi-card">
              <div className="kpi-label">Brent Crude</div>
              <div className="kpi-value price">${brentPrice.toFixed(2)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">India Days-of-Cover</div>
              <div className="kpi-value risk-green">
                {sprData ? sprData.metrics.days_of_cover_remaining.toFixed(0) : "68"} Days
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Imports At Risk</div>
              <div className={`kpi-value ${blockagePct > 60 ? 'risk-red' : blockagePct > 30 ? 'risk-yellow' : 'risk-green'}`}>
                {scenarioData ? scenarioData.volume_at_risk_pct.toFixed(0) : "0"}%
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">AI Latency</div>
              <div className="kpi-value" style={{ color: 'var(--accent-cyan)' }}>3.8s</div>
            </div>
          </div>
        </div>
      </header>

      {/* Left Rail: Risk Signal Feed */}
      <aside className="left-rail">
        <div className="panel-header">
          <h2>
            <ShieldAlert size={16} style={{ color: 'var(--accent-red)' }} />
            Risk Signal Feed
          </h2>
          <button 
            className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={fetchSignals}
            title="Refresh Feed"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="feed-container">
          {signals.map(sig => (
            <div 
              key={sig.id} 
              className={`signal-card ${sig.type} ${selectedSignal?.id === sig.id ? 'active' : ''}`}
              onClick={() => handleSelectSignal(sig)}
            >
              <div className="signal-meta">
                <span className="signal-source">{sig.source}</span>
                <span className={`signal-score ${
                  sig.probability > 75 ? 'score-high' : sig.probability > 40 ? 'score-medium' : 'score-low'
                }`}>
                  {sig.probability}%
                </span>
              </div>
              <div className="signal-title">{sig.title}</div>
              <div className="signal-summary">{sig.summary}</div>
              <div className="signal-time">
                {new Date(sig.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Center Geospatial Map */}
      <main className="center-map-container">
        <Map 
          selectedChoke={selectedChoke} 
          activeRiskZones={activeRiskZones} 
          vessels={vessels} 
          onSelectVessel={(v) => {
            loggerLog(`[MAP] Selected Vessel: ${v.name} | MMSI: ${v.mmsi} | Status: ${v.status} | Speed: ${v.speed} kts.`, "sys");
            alert(`Vessel Tracking Report:\nName: ${v.name}\nMMSI: ${v.mmsi}\nCargo: ${v.cargo_type}\nDestination: ${v.destination}\nFlag: ${v.flag}\nSpeed: ${v.speed} knots`);
          }}
          onSelectChokePoint={(cp) => {
            setSelectedChoke(cp);
            setActivePreset("None");
            loggerLog(`[MAP] Camera repositioned to focal point: "${cp}".`, "sys");
          }}
        />
      </main>

      {/* Right Rail: Agent Reasoning / Chat Copilot */}
      <aside className="right-rail">
        <nav className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === 'terminal' ? 'active' : ''}`}
            onClick={() => setActiveTab('terminal')}
          >
            <Terminal size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Agent Reasoning
          </button>
          <button 
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Chat Copilot
          </button>
        </nav>

        <div className="tab-content">
          {activeTab === 'terminal' ? (
            <div className="terminal-panel">
              {agentLogs.map((log, idx) => (
                <div key={idx} className={`terminal-line ${log.type}`}>
                  {log.text}
                </div>
              ))}
              <div className="terminal-line">
                <span className="terminal-cursor" />
              </div>
              <div ref={terminalEndRef} />
            </div>
          ) : (
            <div className="chat-panel">
              <div className="chat-history">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-message ${msg.role}`}>
                    <strong>{msg.role === 'user' ? 'You' : 'Copilot'}: </strong>
                    {msg.text}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="chat-message copilot">
                    <span className="terminal-cursor" /> Analyzing Knowledge Graph...
                  </div>
                )}
              </div>

              {/* Chat Preset Helper Buttons */}
              <div className="chat-presets">
                <button 
                  className="preset-query-btn"
                  onClick={() => { setChatInput("What happens to Jamnagar Refinery run rates if Hormuz blocks 50% flow?"); }}
                >
                  "Impact of 50% Hormuz blockage on Jamnagar"
                </button>
                <button 
                  className="preset-query-btn"
                  onClick={() => { setChatInput("Rerouting options if Suez blocks Russian Urals"); }}
                >
                  "Rerouting Urals crude if Suez closes"
                </button>
              </div>

              <form className="chat-input-form" onSubmit={handleChatSubmit}>
                <input 
                  type="text" 
                  className="chat-input"
                  placeholder="Ask energy security copilot..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="chat-submit-btn">
                  <Send size={14} />
                </button>
              </form>
            </div>
          )}
        </div>
      </aside>

      {/* Bottom Drawer Component */}
      <footer className="bottom-drawer">
        <aside className="drawer-sidebar">
          <button 
            className={`drawer-tab-btn ${drawerTab === 'recs' ? 'active' : ''}`}
            onClick={() => setDrawerTab('recs')}
          >
            <Compass size={14} />
            Reroute Options
          </button>
          <button 
            className={`drawer-tab-btn ${drawerTab === 'scenarios' ? 'active' : ''}`}
            onClick={() => setDrawerTab('scenarios')}
          >
            <Sliders size={14} />
            Scenario Lab
          </button>
          <button 
            className={`drawer-tab-btn ${drawerTab === 'spr' ? 'active' : ''}`}
            onClick={() => setDrawerTab('spr')}
          >
            <Database size={14} />
            SPR Optimizer
          </button>
          <button 
            className={`drawer-tab-btn ${drawerTab === 'graph' ? 'active' : ''}`}
            onClick={() => setDrawerTab('graph')}
          >
            <Activity size={14} />
            Knowledge Graph
          </button>
          
          <button 
            className="btn-primary" 
            style={{ width: '100%', marginTop: 'auto', padding: '10px', fontSize: '0.75rem' }}
            onClick={triggerBrief}
          >
            <FileText size={14} />
            AI Executive Brief
          </button>
        </aside>

        <div className="drawer-content">
          {/* TAB 1: Procurement recommendations */}
          {drawerTab === 'recs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#fff' }}>Ranked Alternative Procurement Recommendations</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Target Asset:</span>
                  <select 
                    value={targetRefinery}
                    onChange={(e) => setTargetRefinery(e.target.value)}
                    style={{ background: '#0a0d14', border: '1px solid var(--panel-border)', color: '#fff', padding: '3px 8px', borderRadius: '4px' }}
                  >
                    <option value="Jamnagar Refinery">Jamnagar (Reliance)</option>
                    <option value="Mumbai Refinery">Mumbai (BPCL/HPCL)</option>
                    <option value="Mangalore Refinery">Mangalore (MRPL)</option>
                    <option value="Kochi Refinery">Kochi (BPCL)</option>
                  </select>
                </div>
              </div>

              <div className="recs-grid">
                {procurementRecs.map((rec, i) => (
                  <div key={rec.source_grade} className="rec-card" style={{ borderTop: i === 0 ? '2px solid var(--accent-green)' : '1px solid var(--panel-border)' }}>
                    <div className="rec-header">
                      <span className="rec-grade">{rec.source_grade}</span>
                      <span className="rec-score-badge">Match: {rec.score}/100</span>
                    </div>
                    <div className="rec-details">
                      <div className="rec-detail-row">
                        <span>Route:</span>
                        <span style={{ color: '#fff' }}>{rec.route}</span>
                      </div>
                      <div className="rec-detail-row">
                        <span>Voyage Time:</span>
                        <span style={{ color: '#fff' }}>{rec.lead_time_days} days</span>
                      </div>
                      <div className="rec-detail-row">
                        <span>Compatibility:</span>
                        <span style={{ color: '#fff' }}>{rec.compatibility_pct}%</span>
                      </div>
                      <div className="rec-detail-row">
                        <span>Delivered Price:</span>
                        <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>${rec.delivered_cost_bbl.toFixed(2)}/bbl</span>
                      </div>
                    </div>
                    <button 
                      className="rec-action-btn"
                      onClick={() => handleExecuteProcurement(rec.source_grade, rec.delivered_cost_bbl)}
                    >
                      Execute Procurement
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: Scenario lab simulation */}
          {drawerTab === 'scenarios' && (
            <div className="scenario-lab-grid">
              <div className="scenario-controls">
                <h3 style={{ fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disruption Control</h3>
                <div className="preset-group">
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Incident Presets</span>
                  <button 
                    className={`preset-query-btn ${activePreset === 'Hormuz Partial Closure' ? 'active' : ''}`}
                    onClick={() => handlePresetSelect("Hormuz Partial Closure")}
                    style={{ background: activePreset === 'Hormuz Partial Closure' ? 'var(--accent-blue)' : '', color: activePreset === 'Hormuz Partial Closure' ? '#000' : '' }}
                  >
                    Hormuz Partial Closure (50%)
                  </button>
                  <button 
                    className={`preset-query-btn ${activePreset === 'OPEC+ Emergency Cut' ? 'active' : ''}`}
                    onClick={() => handlePresetSelect("OPEC+ Emergency Cut")}
                    style={{ background: activePreset === 'OPEC+ Emergency Cut' ? 'var(--accent-blue)' : '', color: activePreset === 'OPEC+ Emergency Cut' ? '#000' : '' }}
                  >
                    OPEC+ Emergency Cut
                  </button>
                  <button 
                    className={`preset-query-btn ${activePreset === 'Red Sea shipping suspension' ? 'active' : ''}`}
                    onClick={() => handlePresetSelect("Red Sea shipping suspension")}
                    style={{ background: activePreset === 'Red Sea shipping suspension' ? 'var(--accent-blue)' : '', color: activePreset === 'Red Sea shipping suspension' ? '#000' : '' }}
                  >
                    Red Sea Suspension (100%)
                  </button>
                </div>
                
                <div className="slider-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <label>Blockage Slider</label>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{blockagePct}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    className="custom-slider"
                    value={blockagePct}
                    onChange={(e) => {
                      setBlockagePct(parseInt(e.target.value));
                      setActivePreset("None");
                    }}
                  />
                </div>
              </div>

              {scenarioData && (
                <div className="scenario-results">
                  <div className="result-card">
                    <span className="result-title">Brent Price Spike</span>
                    <span className="result-value" style={{ color: 'var(--accent-cyan)' }}>
                      +${scenarioData.price_increase_bbl.toFixed(2)}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      (+{scenarioData.fuel_price_rise_pct}% retail rise)
                    </span>
                  </div>
                  <div className="result-card">
                    <span className="result-title">Grid Stress</span>
                    <span className="result-value" style={{ color: 'var(--accent-yellow)' }}>
                      {scenarioData.power_stress_pct}%
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Grid load capability</span>
                  </div>
                  <div className="result-card">
                    <span className="result-title">GDP Projection</span>
                    <span className="result-value" style={{ color: 'var(--accent-red)' }}>
                      {scenarioData.gdp_delta_pct > 0 ? '+' : ''}{scenarioData.gdp_delta_pct}%
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Macro contraction</span>
                  </div>
                  <div className="result-card">
                    <span className="result-title">CPI Delta</span>
                    <span className="result-value" style={{ color: 'var(--accent-orange)' }}>
                      +{scenarioData.cpi_delta_pct}%
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Inflation pressure</span>
                  </div>

                  {/* Refineries Run Rates Chart */}
                  <div className="refinery-bar-container">
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}>
                      Downstream Refinery Run Rates
                    </span>
                    {scenarioData.refineries.map(ref => {
                      const runRate = ref.current_run_rate;
                      const drop = ref.drop_pct;
                      
                      let barColorClass = "";
                      if (runRate < 75) barColorClass = "danger";
                      else if (runRate < 90) barColorClass = "warning";
                      
                      return (
                        <div key={ref.name} className="refinery-row">
                          <span className="refinery-name">{ref.name}</span>
                          <div className="bar-bg">
                            <div 
                              className={`bar-fill ${barColorClass}`}
                              style={{ width: `${runRate}%` }}
                            />
                          </div>
                          <span style={{ width: '40px', textAlign: 'right', fontWeight: 'bold' }}>{runRate}%</span>
                          <span style={{ width: '45px', textAlign: 'right', color: drop > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                            {drop > 0 ? `-${drop}%` : 'Stable'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SPR Optimization */}
          {drawerTab === 'spr' && sprData && (
            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '0.85rem', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Drawdown Metrics</h3>
                
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total Inventory Release:</span>
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-cyan)', fontWeight: 'bold', marginTop: '2px' }}>
                    {sprData.metrics.total_drawdown_mb.toFixed(1)} MB
                  </div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Shortfall Coverage Ratio:</span>
                  <div style={{ fontSize: '0.9rem', color: 'var(--accent-green)', fontWeight: 'bold', marginTop: '2px' }}>
                    {sprData.metrics.shortfall_covered_pct}% Covered
                  </div>
                </div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ending Stock Capacity:</span>
                  <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold', marginTop: '2px' }}>
                    {sprData.metrics.ending_stock_mb.toFixed(1)} MB ({sprData.metrics.inventory_fill_ratio_pct}%)
                  </div>
                </div>
                <div style={{ paddingBottom: '4px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reserve Exhaustion Risk:</span>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: sprData.metrics.exhaustion_risk_days === -1 ? 'var(--accent-green)' : sprData.metrics.exhaustion_risk_days < 20 ? 'var(--accent-red)' : 'var(--accent-yellow)', 
                    fontWeight: 'bold', 
                    marginTop: '2px' 
                  }}>
                    {sprData.metrics.exhaustion_risk_days === -1 ? 'No Immediate Risk' : `${sprData.metrics.exhaustion_risk_days} Days to Empty`}
                  </div>
                </div>
              </div>

              {/* Drawdown schedule chart */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#090b10', border: '1px solid var(--panel-border)', padding: '10px', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '6px' }}>
                  30-Day Drawdown Scheduling Simulation (M bbl/day)
                </span>
                <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: '12px' }}>
                  {sprData.daily_inventory.map((inv, idx) => {
                    const draw = sprData.daily_drawdown[idx];
                    const gap = sprData.daily_shortfall_original[idx];
                    
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        {/* Shortfall Original (Red Bar) */}
                        <div 
                          style={{ 
                            width: '40%', 
                            backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                            height: `${Math.min(gap * 70, 70)}%`,
                            marginBottom: '2px',
                            position: 'relative'
                          }}
                          title={`Day ${idx+1}: Target shortfall ${gap.toFixed(2)}M bbl`}
                        >
                          {/* Drawdown (Green inner fill) */}
                          <div 
                            style={{ 
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              backgroundColor: 'var(--accent-green)',
                              height: `${(draw / (gap || 1)) * 100}%`
                            }}
                            title={`Day ${idx+1}: Drawdown ${draw.toFixed(2)}M bbl`}
                          />
                        </div>
                        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>{idx + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '15px', fontSize: '0.65rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', backgroundColor: 'var(--accent-green)' }} />
                    <span>SPR Drawdown (Release)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', backgroundColor: 'rgba(239,68,68,0.2)' }} />
                    <span>Supply Shortfall Deficit</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Knowledge Graph Visualizer */}
          {drawerTab === 'graph' && (
            <KnowledgeGraph graphData={graphData} />
          )}
        </div>
      </footer>

      {/* AI Executive Brief Modal Popup */}
      {isBriefOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <header className="modal-header">
              <h3>AI Geopolitical & Logistics Briefing</h3>
              <button className="refresh-btn" onClick={() => setIsBriefOpen(false)}>✕</button>
            </header>
            
            <main className="modal-body">
              {isBriefLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'var(--font-mono)' }}>
                  <span className="terminal-cursor" /> Ingesting active corridors... Asking Gemini model...
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-line' }}>
                  {/* Markdown rendered simple styles */}
                  {briefText}
                </div>
              )}
            </main>

            <footer className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsBriefOpen(false)}>Close</button>
              {!isBriefLoading && (
                <button className="btn-primary" onClick={handleDownloadPDF}>
                  <Download size={14} />
                  Download briefing report (.md)
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
