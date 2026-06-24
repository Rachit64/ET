import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Sparkles, AlertCircle, Bot, User } from "lucide-react";

export default function ChatCopilot() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hello! I am the **Antigravity Energy Security Intelligence Copilot**. Ask me any question regarding Indian crude imports, refinery configurations, shipping corridors, or geopolitical threat analysis.",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const logEndRef = useRef(null);

  const quickPrompts = [
    "What happens to diesel prices if Hormuz closes for 3 weeks?",
    "Which Indian refineries are exposed to Bab-el-Mandeb?",
    "List the dynamic risk events currently threatening Strait of Hormuz."
  ];

  const handleSend = async (textToSend) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg = { sender: "user", text: textToSend };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("http://localhost:8000/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textToSend })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [...prev, { sender: "bot", text: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { sender: "bot", text: "Failed to retrieve answer from Graph RAG API." }]);
      }
    } catch (error) {
      console.error("Failed to query RAG copilot:", error);
      setMessages((prev) => [...prev, { sender: "bot", text: "Network error: Make sure the FastAPI backend is running." }]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  // A simple formatter to render bold, lists, and breaks safely in React
  const formatText = (text) => {
    return text.split("\n").map((line, lineIdx) => {
      // Bullet items
      const isBullet = line.trim().startsWith("*") || line.trim().startsWith("-");
      let content = isBullet ? line.replace(/^[\*\-]\s*/, "") : line;

      // Replace **bold** tags
      const parts = content.split(/\*\*([^*]+)\*\*/g);
      const renderedLine = parts.map((part, partIdx) => {
        // odd indices correspond to matches between ** **
        if (partIdx % 2 === 1) {
          return <strong key={partIdx} className="text-cyan-400 font-extrabold">{part}</strong>;
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={lineIdx} className="ml-4 list-disc list-inside text-slate-300 py-0.5 leading-relaxed text-[11px] font-mono">
            {renderedLine}
          </li>
        );
      }

      return (
        <p key={lineIdx} className="min-h-[12px] leading-relaxed text-[11px] font-mono text-slate-200">
          {renderedLine}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#090d16] border border-slate-800/80 rounded-xl overflow-hidden shadow-2xl select-none">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-cyan-400 animate-pulse" />
          <div>
            <h3 className="font-extrabold text-slate-100 text-xs uppercase tracking-wider">Graph-RAG Copilot</h3>
            <p className="text-[9px] text-slate-500 font-mono">AI Geopolitical & Commodity Intelligence</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 px-2.5 py-1 rounded bg-cyan-950/20 border border-cyan-800/40 text-[9px] text-cyan-400 font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini Enabled</span>
        </div>
      </div>

      {/* Message History logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20 scroll-smooth">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex items-start space-x-3 max-w-[85%] ${
              msg.sender === "user" ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
            }`}
          >
            <div className={`p-2 rounded-lg border shrink-0 ${
              msg.sender === "user" 
                ? "bg-slate-900 border-slate-800 text-slate-300" 
                : "bg-cyan-950/20 border-cyan-800/40 text-cyan-400"
            }`}>
              {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`p-3.5 rounded-xl border text-xs shadow-md space-y-1.5 select-text ${
              msg.sender === "user" 
                ? "bg-slate-900 border-slate-800/80 rounded-tr-none text-slate-200" 
                : "bg-slate-950/60 border-slate-850 rounded-tl-none text-slate-300"
            }`}>
              {formatText(msg.text)}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start space-x-3 max-w-[80%]">
            <div className="p-2 rounded-lg border bg-cyan-950/20 border-cyan-800/40 text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl rounded-tl-none text-xs text-slate-500 font-mono flex items-center space-x-2 animate-pulse">
              <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-ping"></span>
              <span>Copilot parsing Knowledge Graph relationships...</span>
            </div>
          </div>
        )}
        <div ref={logEndRef} />
      </div>

      {/* Suggested Prompts Block */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-900 space-y-2">
          <label className="text-[9px] font-bold font-mono tracking-wider text-slate-600 uppercase">Suggested Inquiries</label>
          <div className="flex flex-col space-y-1.5">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="w-full text-left p-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-lg text-[10px] text-slate-400 hover:text-slate-200 transition-all cursor-pointer font-sans"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Text Input Drawer */}
      <div className="p-3 bg-slate-950 border-t border-slate-900 flex space-x-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend(input)}
          placeholder="Ask about price forecasts, supply flows, pipelines..."
          className="flex-1 bg-slate-900 border border-slate-850 hover:border-slate-800 px-4 py-2 rounded-xl text-xs text-slate-200 outline-none focus:border-cyan-500 transition-colors"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isLoading}
          className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-900 border border-cyan-800/40 disabled:border-slate-800 text-slate-950 disabled:text-slate-600 rounded-xl cursor-pointer disabled:cursor-not-allowed transition-all shadow-md shadow-cyan-600/10"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </div>

    </div>
  );
}
