import os
import json
import logging
from typing import Dict, List, Any
from backend.app.services.risk import risk_agent

logger = logging.getLogger(__name__)

class DigitalTwinService:
    def __init__(self):
        self.nodes = []
        self.links = []
        self.load_cache()

    def load_cache(self):
        """Loads normalized infrastructure nodes and links from osm_cache.json."""
        cache_file = os.path.join(os.path.dirname(__file__), "osm_cache.json")
        if os.path.exists(cache_file):
            try:
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.nodes = data.get("nodes", [])
                    self.links = data.get("links", [])
                    logger.info(f"Successfully loaded {len(self.nodes)} facilities from OSM Cache.")
                    return
            except Exception as e:
                logger.error(f"Error reading osm_cache.json: {e}")
        
        # Safe fallback if cache doesn't exist
        logger.warning("OSM cache not found. Falling back to default static infrastructure.")
        self.nodes = [
            {
                "id": "vindhyachal_coal",
                "name": "Vindhyachal Super Thermal Power Station",
                "type": "power_plant",
                "fuel": "coal",
                "coords": [82.672, 24.098],
                "capacity": "4760 MW",
                "operator": "NTPC",
                "description": "Largest thermal power station in India, located in Madhya Pradesh."
            },
            {
                "id": "mundra_coal",
                "name": "Mundra Ultra Mega Power Plant",
                "type": "power_plant",
                "fuel": "coal",
                "coords": [69.528, 22.822],
                "capacity": "4000 MW",
                "operator": "Tata Power",
                "description": "Coal-fired power plant in Kutch district, Gujarat."
            },
            {
                "id": "jamnagar_refinery",
                "name": "Jamnagar Refinery Complex",
                "type": "refinery",
                "fuel": "crude",
                "coords": [69.8, 22.5],
                "capacity": "1.24M bpd",
                "operator": "Reliance Industries",
                "description": "Largest oil refinery complex in the world."
            },
            {
                "id": "delhi_hub",
                "name": "Delhi NCR Distribution Hub",
                "type": "hub",
                "fuel": "city",
                "coords": [77.2, 28.6],
                "capacity": "High Demand",
                "operator": "National Grid",
                "description": "Primary consumption area and regional distribution hub for North India."
            }
        ]
        self.links = [
            {"id": "link-1", "from_node": "vindhyachal_coal", "to_node": "delhi_hub", "type": "transmission", "capacity": "3000 MW"}
        ]

    def get_infrastructure(self) -> Dict[str, Any]:
        """Return the complete energy supply chain infrastructure nodes and links."""
        return {
            "nodes": self.nodes,
            "links": self.links
        }

    def simulate_twin_scenario(self, scenario_text: str) -> Dict[str, Any]:
        """
        Analyze a natural language scenario using Gemini.
        Returns disrupted facilities, diversion strategy text, load-shedding info, and coordinate lines for visual representation.
        """
        logger.info(f"Simulating digital twin scenario: {scenario_text[:100]}...")
        
        # Because we now have 500+ nodes, we shouldn't send the entire list in the prompt
        # to avoid blowing up the context and slowing down the response.
        # Instead, we send a summary of our hubs/regions and refineries, and ask Gemini
        # to return the name or region of affected facilities, which we will then match in python.
        # We will also send the top 20 major power plants as direct examples.
        major_plants = sorted([n for n in self.nodes if n["type"] == "power_plant"], 
                              key=lambda x: float(x["capacity"].split()[0]) if x["capacity"].split() else 0, 
                              reverse=True)[:25]
        refineries = [n for n in self.nodes if n["type"] == "refinery"]
        wellheads = [n for n in self.nodes if n["type"] == "wellhead"]
        hubs = [n for n in self.nodes if n["type"] == "hub"]

        nodes_brief = []
        for n in major_plants + refineries + wellheads + hubs:
            nodes_brief.append(
                f"- ID: {n['id']}, Name: {n['name']}, Type: {n['type']}, Fuel: {n['fuel']}, Coords: {n['coords']}, Capacity: {n['capacity']}"
            )
        nodes_str = "\n".join(nodes_brief)

        prompt = f"""
        You are India's Strategic Grid Security & Energy Logistics Digital Twin Copilot.
        Your job is to run a geospatial resilience simulation of a natural-language disruption scenario and generate a power/fuel diversion demonstration strategy.
        Be highly realistic and base your analysis on real-world Indian grid dynamics, regional vulnerabilities, and emergency protocols.

        Here is a list of major energy infrastructure nodes in India (major power plants, refineries, wellheads, and regional hubs):
        {nodes_str}

        Note: The full database contains over 500 power plants and refineries. If the scenario affects other facilities not in the list above, you can specify them by name or region, and we will match them in our database.

        Disruption Scenario: "{scenario_text}"

        Evaluate:
        1. Which of the nodes are disrupted (damaged, shut down, or running at reduced capacity). Map them to the node IDs from the list, or if not listed, return their exact names or approximate location region. Assign an impact percentage (10 to 100) and reason for each.
        2. A structured "survive and adapt" strategy in Markdown. Describe the operational adjustments, emergency grid islands, fuel rerouting, or load-shedding policies.
        3. Which specific heavy industries to divert power FROM (e.g. Steel production, Aluminum smelting, Cement mills, heavy manufacturing) in which grid region, and how many Megawatts (MW) or Barrels per Day (bpd) to reclaim.
        4. Which downstream industries, sectors, or cities will be affected by this load shedding or outage.
        5. Generate 4 to 8 concrete "diversion lines" to demonstrate grid/pipeline routing modifications on the map.
           Each line represents power or fuel flowing to bridge the deficit.
           - Each line MUST have 'from_coords' and 'to_coords' as [longitude, latitude].
           - Try to connect actual nodes in the database (use their coordinates from the list, or approximate coordinates for major regions/cities in India). For example, drawing a line from an Eastern plant or Northern solar park to a western hub like mumbai_hub, showing power redirection.
           - Provide a label (e.g. "Rerouting power from Bhadla Solar"), an amount (e.g. "800 MW" or "50k bpd"), and status ("diverted").

        You MUST respond with a single raw JSON object of the form (do NOT wrap it in ```json blocks, do NOT add extra text outside the JSON):
        {{
          "title": "<Concise Headline of the Scenario, max 8 words>",
          "severity": "moderate|elevated|severe|critical",
          "summary": "<A 2-sentence summary of the regional energy impact>",
          "affected_nodes": [
            {{
              "id": "<infrastructure node ID from the list, or a string name>",
              "impact_pct": <integer 10-100>,
              "reason": "<reason for outage/drop>"
            }}
          ],
          "diversion_strategy": "<Detailed markdown text describing grid stabilization and fuel rerouting. State specific policy/operational levers. Keep it professional, 3 paragraphs maximum. Use bullet points where appropriate.>",
          "divert_from_industries": [
            {{
              "industry": "<e.g. Steel Plants (Odisha)>",
              "power_mw": "<amount, e.g. 600 MW or 45k bpd>",
              "region": "<e.g. Eastern Grid>"
            }}
          ],
          "affected_industries": [
            {{
              "industry": "<e.g. Automotive manufacturing in Chennai>",
              "impact": "<e.g. 30% reduction in shift capacity due to power limits>"
            }}
          ],
          "diversion_lines": [
            {{
              "from_node": "<ID of source node, or 'custom'>",
              "from_name": "<Name of source location>",
              "from_coords": [<lon>, <lat>],
              "to_node": "<ID of destination node, or 'custom'>",
              "to_name": "<Name of destination location>",
              "to_coords": [<lon>, <lat>],
              "amount": "<amount, e.g. 500 MW>",
              "label": "<brief line label, e.g. Rerouting Western Hydro surplus>"
            }}
          ]
        }}
        """

        raw_resp = risk_agent.gemini_generate(prompt, timeout=25, generation_config={"responseMimeType": "application/json"})
        if not raw_resp or raw_resp.startswith("ERROR:"):
            logger.error("Gemini failed during digital twin simulation")
            return self._get_fallback_simulation(scenario_text)

        try:
            cleaned = raw_resp.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
                if cleaned.endswith("```"):
                    cleaned = cleaned.rsplit("\n", 1)[0]
                cleaned = cleaned.replace("json", "").strip()

            parsed = json.loads(cleaned)
            
            # Post-process: try to match any "name" affected_nodes to our actual OSM IDs
            matched_affected = []
            for an in parsed.get("affected_nodes", []):
                an_id = an.get("id", "")
                # check if it matches an existing ID
                if any(n["id"] == an_id for n in self.nodes):
                    matched_affected.append(an)
                else:
                    # try to match by name (substring search)
                    name_lower = an_id.lower()
                    best_match = None
                    for n in self.nodes:
                        if name_lower in n["name"].lower() or n["name"].lower() in name_lower:
                            best_match = n["id"]
                            break
                    if best_match:
                        an["id"] = best_match
                        matched_affected.append(an)
                    else:
                        # Keep it anyway, we can show it as custom
                        matched_affected.append(an)
            
            parsed["affected_nodes"] = matched_affected
            return parsed
        except Exception as e:
            logger.error(f"Failed to parse Gemini digital twin response: {e}. Raw response: {raw_resp[:300]}")
            return self._get_fallback_simulation(scenario_text)

    def _get_fallback_simulation(self, scenario_text: str) -> Dict[str, Any]:
        """Fallback simulation if Gemini is offline."""
        # Find some real nodes in self.nodes to use in fallback
        talcher = next((n for n in self.nodes if "talcher" in n["id"]), self.nodes[0])
        paradip = next((n for n in self.nodes if "paradip" in n["id"]), self.nodes[1])
        bhadla = next((n for n in self.nodes if "bhadla" in n["id"]), self.nodes[2])
        delhi = next((n for n in self.nodes if "delhi" in n["id"]), self.nodes[3])

        return {
            "title": "Grid Interconnection Resilience Restoration",
            "severity": "severe",
            "summary": f"Regional grid alert activated following scenario: '{scenario_text[:80]}...'. Supply deficits observed across multiple nodes.",
            "affected_nodes": [
                {
                    "id": talcher["id"],
                    "impact_pct": 80,
                    "reason": "Transmission line trip and substation overflow."
                },
                {
                    "id": paradip["id"],
                    "impact_pct": 50,
                    "reason": "Preemptive logistics safety shutdown."
                }
            ],
            "diversion_strategy": "### Emergency Resilience Protocol\n- **Grid Balancing:** Redirecting 1,500 MW from the Western Grid to the Eastern sectors via inter-regional HVDC lines.\n- **SPR Deployment:** Triggering immediate drawdown advisory at Visakhapatnam to sustain refineries.\n- **Demand Management:** Implementing rolling load shedding for heavy industries to guarantee uninterrupted supply to residential areas, hospitals, and transit grids.",
            "divert_from_industries": [
                {
                    "industry": "Steel smelters (Odisha/Jharkhand)",
                    "power_mw": "750 MW",
                    "region": "Eastern Grid"
                },
                {
                    "industry": "Cement mills (Chhattisgarh)",
                    "power_mw": "300 MW",
                    "region": "Western Grid"
                }
            ],
            "affected_industries": [
                {
                    "industry": "Heavy manufacturing in Kolkata",
                    "impact": "Production shifts halted due to emergency grid balancing."
                },
                {
                    "industry": "Alloy production",
                    "impact": "Shedding load indefinitely during restoration."
                }
            ],
            "diversion_lines": [
                {
                    "from_node": bhadla["id"],
                    "from_name": bhadla["name"],
                    "from_coords": bhadla["coords"],
                    "to_node": delhi["id"],
                    "to_name": delhi["name"],
                    "to_coords": delhi["coords"],
                    "amount": "1200 MW",
                    "label": "Emergency Solar Power Redirection"
                }
            ]
        }

# Singleton instance
digital_twin_service = DigitalTwinService()
