import networkx as nx
import requests
import json
import logging
import os
from typing import Dict, List, Any
from dotenv import load_dotenv

load_dotenv()

# Gemini Configuration
GEMINI_API_KEY = os.getenv("GRAPH_GEMINI_API_KEY") or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    def __init__(self):
        self.g = nx.DiGraph()
        self._build_static_graph()

    def _build_static_graph(self):
        """Construct the baseline NetworkX energy supply chain graph."""
        self.g.clear()
        
        # 1. Suppliers
        self.g.add_node("Saudi Aramco", type="Supplier", country="Saudi Arabia", capacity="12.0M bpd", api_gravity=28.0)
        self.g.add_node("ADNOC", type="Supplier", country="UAE", capacity="4.0M bpd", api_gravity=39.0)
        self.g.add_node("Rosneft", type="Supplier", country="Russia", capacity="8.5M bpd", api_gravity=31.7)
        self.g.add_node("Chevron", type="Supplier", country="USA", capacity="11.0M bpd", api_gravity=40.0)
        self.g.add_node("Petrobras", type="Supplier", country="Brazil", capacity="3.0M bpd", api_gravity=29.0)
        self.g.add_node("Sonangol", type="Supplier", country="Angola", capacity="1.2M bpd", api_gravity=32.0)
        
        # 2. Shipping Corridors (Choke Points)
        self.g.add_node("Strait of Hormuz", type="Corridor", flow_capacity="21M bpd", risk_level="High")
        self.g.add_node("Bab-el-Mandeb", type="Corridor", flow_capacity="8.8M bpd", risk_level="Critical")
        self.g.add_node("Suez Canal", type="Corridor", flow_capacity="9.0M bpd", risk_level="Medium")
        self.g.add_node("Strait of Malacca", type="Corridor", flow_capacity="16M bpd", risk_level="Low")
        self.g.add_node("Cape of Good Hope", type="Corridor", flow_capacity="Infinite (Bypass)", risk_level="Low")
        self.g.add_node("Panama Canal", type="Corridor", flow_capacity="5M bpd", risk_level="Low")

        # 3. Indian Refineries
        self.g.add_node("Jamnagar Refinery", type="Refinery", capacity="1.24M bpd", owner="Reliance Industries", config="Deep Sour/Heavy")
        self.g.add_node("Mumbai Refinery", type="Refinery", capacity="0.30M bpd", owner="BPCL/HPCL", config="Medium Sweet/Sour")
        self.g.add_node("Mangalore Refinery", type="Refinery", capacity="0.30M bpd", owner="MRPL", config="Sour/Acidic")
        self.g.add_node("Kochi Refinery", type="Refinery", capacity="0.31M bpd", owner="BPCL", config="Medium Sweet")

        # 4. Connecting Suppliers to Corridors
        self.g.add_edge("Saudi Aramco", "Strait of Hormuz", relationship="SHIPS_THROUGH")
        self.g.add_edge("ADNOC", "Strait of Hormuz", relationship="SHIPS_THROUGH")
        
        self.g.add_edge("Rosneft", "Suez Canal", relationship="SHIPS_THROUGH")
        self.g.add_edge("Rosneft", "Bab-el-Mandeb", relationship="SHIPS_THROUGH")
        
        self.g.add_edge("Chevron", "Cape of Good Hope", relationship="SHIPS_THROUGH")
        self.g.add_edge("Chevron", "Panama Canal", relationship="SHIPS_THROUGH")
        
        self.g.add_edge("Petrobras", "Cape of Good Hope", relationship="SHIPS_THROUGH")
        self.g.add_edge("Sonangol", "Cape of Good Hope", relationship="SHIPS_THROUGH")

        # 5. Connecting Corridors to Refineries
        self.g.add_edge("Strait of Hormuz", "Jamnagar Refinery", relationship="SUPPLIES_CRUDE")
        self.g.add_edge("Strait of Hormuz", "Mumbai Refinery", relationship="SUPPLIES_CRUDE")
        self.g.add_edge("Strait of Hormuz", "Mangalore Refinery", relationship="SUPPLIES_CRUDE")
        self.g.add_edge("Strait of Hormuz", "Kochi Refinery", relationship="SUPPLIES_CRUDE")
        
        self.g.add_edge("Bab-el-Mandeb", "Kochi Refinery", relationship="SUPPLIES_CRUDE")
        self.g.add_edge("Bab-el-Mandeb", "Mumbai Refinery", relationship="SUPPLIES_CRUDE")
        
        self.g.add_edge("Suez Canal", "Jamnagar Refinery", relationship="SUPPLIES_CRUDE")
        
        self.g.add_edge("Cape of Good Hope", "Mangalore Refinery", relationship="SUPPLIES_CRUDE")
        self.g.add_edge("Cape of Good Hope", "Kochi Refinery", relationship="SUPPLIES_CRUDE")

    def update_risk_nodes(self, active_signals: List[Dict[str, Any]]):
        """Inject active news and risk signals as dynamic nodes connected to corridors."""
        # Re-build static base
        self._build_static_graph()
        
        for sig in active_signals:
            corridor = sig.get("corridor")
            sig_id = sig.get("id")
            title = sig.get("title")
            prob = sig.get("probability")
            
            if not corridor or corridor not in self.g:
                continue
                
            # Add risk node
            self.g.add_node(
                sig_id, 
                type="RiskEvent", 
                title=title, 
                probability=f"{prob}%", 
                severity="High" if prob > 60 else "Medium",
                category=sig.get("type")
            )
            
            # Draw edge from Risk to Corridor and downstream refineries
            self.g.add_edge(sig_id, corridor, relationship="THREATENS")
            
            # Find refineries supplied by this corridor and link risk downstream
            successors = list(self.g.successors(corridor))
            for succ in successors:
                if self.g.nodes[succ].get("type") == "Refinery":
                    self.g.add_edge(sig_id, succ, relationship="IMPACTS_DOWNSTREAM")

    def get_graph_json(self) -> Dict[str, Any]:
        """Convert the NetworkX graph to a d3-compatible node-link JSON structure."""
        nodes = []
        for n, data in self.g.nodes(data=True):
            node_info = {"id": n}
            node_info.update(data)
            nodes.append(node_info)
            
        links = []
        for u, v, data in self.g.edges(data=True):
            links.append({
                "source": u,
                "target": v,
                "relationship": data.get("relationship", "CONNECTED")
            })
            
        return {"nodes": nodes, "links": links}

    def execute_rag_query(self, query: str) -> str:
        """Run a Graph-RAG query using NetworkX node traversal and Gemini."""
        if not GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY / GRAPH_GEMINI_API_KEY environment variable is not set. Graph RAG query cannot run.")
            return "Sorry, I encountered an issue querying the RAG copilot: API key is not configured."

        # 1. Retrieve relevant node data by matching query keywords
        relevant_context = []
        query_lower = query.lower()
        
        # Traverse graph and extract node features
        for node, data in self.g.nodes(data=True):
            node_matches = (
                node.lower() in query_lower or
                data.get("type", "").lower() in query_lower or
                data.get("category", "").lower() in query_lower
            )
            if node_matches:
                node_desc = f"Node [{node}] (Type: {data.get('type')})"
                for k, v in data.items():
                    if k != "type":
                        node_desc += f", {k}: {v}"
                relevant_context.append(node_desc)
                
                # Fetch connected neighbors
                predecessors = list(self.g.predecessors(node))
                successors = list(self.g.successors(node))
                if predecessors:
                    relevant_context.append(f"   -> Connected inputs: {', '.join(predecessors)}")
                if successors:
                    relevant_context.append(f"   -> Connected outputs: {', '.join(successors)}")

        # Clean context
        context_str = "\n".join(relevant_context[:12]) if relevant_context else "No direct Graph matching nodes found. Rely on general energy security facts."
        
        # 2. Call Gemini with retrieved Graph Context
        try:
            prompt = f"""
            You are the Antigravity Energy Security Intelligence Copilot.
            Answer the following query using the energy supply chain relationship data provided below.
            If the data is insufficient, combine it with your textbook knowledge of energy markets, global logistics, and Indian refineries.

            Graph RAG Context:
            {context_str}

            User Query:
            {query}

            Provide a quantitative, structured, and realistic answer (e.g. estimate price changes, run rate drops, or rerouting times if requested).
            Use bullet points and bold text for readability. Return clean Markdown without code fences.
            """
            
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
            headers = {"Content-Type": "application/json"}
            data = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            
            resp = requests.post(url, headers=headers, json=data, timeout=12)
            if resp.status_code == 200:
                result = resp.json()
                answer = result['candidates'][0]['content']['parts'][0]['text']
                return answer.strip()
        except Exception as e:
            logger.error(f"Graph RAG Gemini call failed: {e}")
            
        return "Sorry, I encountered an issue querying the RAG copilot. Please try again."

# Singleton instance
graph_service = KnowledgeGraphService()
