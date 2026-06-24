from typing import List, Dict, Any
import math

# Coordinates [lon, lat] for India's primary import refineries (mirrors ais.py ROUTES)
REFINERY_COORDS = {
    "Jamnagar Refinery": [69.8, 22.5],
    "Mumbai Refinery": [72.8, 18.9],
    "Mangalore Refinery": [74.8, 12.9],
    "Kochi Refinery": [76.2, 9.9],
}

# Baseline alternative crude sources and their characteristics
CRUDE_SOURCES = [
    {
        "name": "Angola Cabinda",
        "region": "West Africa",
        "coords": [12.2, -5.55], # Cabinda loading terminal
        "api_gravity": 32.0,
        "sulfur_pct": 0.12,
        "base_spot_premium": 1.80, # $/bbl above Brent
        "port_congestion_days": 1.5,
        "tanker_availability": "High",
        "distance_nm": 5200, # To India West Coast
        "refinery_suitability": {
            "Jamnagar Refinery": 92.0,
            "Mumbai Refinery": 95.0,
            "Mangalore Refinery": 94.0,
            "Kochi Refinery": 95.0
        },
        "sanctions_risk": "Low"
    },
    {
        "name": "Brazil Lula",
        "region": "Latin America",
        "coords": [-43.2, -24.0], # Santos basin / Angra dos Reis
        "api_gravity": 29.0,
        "sulfur_pct": 0.27,
        "base_spot_premium": 0.50, # $/bbl below Brent
        "port_congestion_days": 2.2,
        "tanker_availability": "Medium",
        "distance_nm": 6800,
        "refinery_suitability": {
            "Jamnagar Refinery": 96.0,
            "Mumbai Refinery": 90.0,
            "Mangalore Refinery": 92.0,
            "Kochi Refinery": 93.0
        },
        "sanctions_risk": "Low"
    },
    {
        "name": "US Eagle Ford",
        "region": "US Gulf Coast",
        "coords": [-97.4, 27.8], # Corpus Christi export terminal
        "api_gravity": 40.0,
        "sulfur_pct": 0.15,
        "base_spot_premium": 1.20,
        "port_congestion_days": 3.4,
        "tanker_availability": "High",
        "distance_nm": 11200,
        "refinery_suitability": {
            "Jamnagar Refinery": 84.0, # Requires blending for heavy-sour configs
            "Mumbai Refinery": 92.0,
            "Mangalore Refinery": 90.0,
            "Kochi Refinery": 91.0
        },
        "sanctions_risk": "Low"
    },
    {
        "name": "Russia Urals",
        "region": "Black Sea",
        "coords": [37.8, 44.7], # Novorossiysk
        "api_gravity": 31.7,
        "sulfur_pct": 1.35,
        "base_spot_premium": -12.50, # Heavily discounted due to sanctions/cap
        "port_congestion_days": 4.1,
        "tanker_availability": "Low", # Shadow fleet/Suezmax availability is tight
        "distance_nm": 4500, # Via Suez (or 11500 via Cape)
        "refinery_suitability": {
            "Jamnagar Refinery": 98.0, # Optimized for high-sulfur sour crude
            "Mumbai Refinery": 80.0,
            "Mangalore Refinery": 85.0,
            "Kochi Refinery": 82.0
        },
        "sanctions_risk": "High"
    },
    {
        "name": "Iraq Basrah Medium",
        "region": "Persian Gulf",
        "coords": [48.8, 29.7], # Basra oil terminal
        "api_gravity": 27.9,
        "sulfur_pct": 2.90,
        "base_spot_premium": -2.10,
        "port_congestion_days": 2.8,
        "tanker_availability": "Medium",
        "distance_nm": 1500, # Direct Hormuz (or 12500 via Cape if Hormuz closed!)
        "refinery_suitability": {
            "Jamnagar Refinery": 95.0,
            "Mumbai Refinery": 88.0,
            "Mangalore Refinery": 90.0,
            "Kochi Refinery": 89.0
        },
        "sanctions_risk": "Medium"
    }
]

class ProcurementOrchestrator:
    def __init__(self):
        pass

    def get_recommendations(self, target_refinery: str, active_choke_point: str, brent_base: float, blockage_pct: float) -> List[Dict[str, Any]]:
        """
        Rank alternative crude sources for a target refinery based on active disruptions.
        Reroutes routing options if the primary pathway is blocked.
        """
        recs = []
        ship_speed = 14.0 # knots
        nm_per_day = ship_speed * 24.0 # ~336 nm/day
        
        # Freight base costs ($/bbl per 1000 nm)
        freight_rate_base = 0.65
        
        # If Bab-el-Mandeb or Suez is blocked, routes passing through them must go around Cape of Good Hope
        suez_blocked = (active_choke_point in ["Bab-el-Mandeb", "Suez Canal"]) and blockage_pct > 40.0
        hormuz_blocked = (active_choke_point == "Strait of Hormuz") and blockage_pct > 30.0
        
        for source in CRUDE_SOURCES:
            # Copy source data
            name = source["name"]
            region = source["region"]
            compatibility = source["refinery_suitability"].get(target_refinery, 90.0)
            
            # Determine route and distance adjustments
            distance = source["distance_nm"]
            route_desc = f"{region} to {target_refinery.split()[0]} via Direct Lane"
            
            # Adjustments for Persian Gulf crude (Basrah Medium) if Hormuz is blocked
            if name == "Iraq Basrah Medium":
                if hormuz_blocked:
                    # Basrah crude cannot be shipped easily if Hormuz is closed!
                    # It would require pipelines to Red Sea (Yanbu) and then shipping via Bab-el-Mandeb.
                    # We increase distance, cost, and drop its compatibility/availability.
                    distance = 4500 # Route through Yanbu
                    route_desc = "Yanbu Pipeline Bypass -> Bab-el-Mandeb -> India"
                    freight_extra = 3.50 # pipeline tariff + freight
                    vessel_avail = "Low"
                    operational_risk = 75
                else:
                    vessel_avail = source["tanker_availability"]
                    freight_extra = 0.0
                    operational_risk = 15
            else:
                # Other crudes
                vessel_avail = source["tanker_availability"]
                freight_extra = 0.0
                operational_risk = 10
                
            # If Suez is blocked, Russian Urals (from Black Sea) must reroute around Cape of Good Hope
            if name == "Russia Urals" and suez_blocked:
                distance = 11500
                route_desc = "Black Sea -> Cape of Good Hope -> India"
                operational_risk += 35
                vessel_avail = "Low"
                
            # Tanker voyage time
            voyage_days = round(distance / nm_per_day, 1)
            total_lead_time_days = round(voyage_days + source["port_congestion_days"], 1)
            
            # Calculate cost breakdown
            # Base price
            base_price = brent_base + source["base_spot_premium"]
            
            # Freight fee
            freight_cost = round((distance / 1000.0) * freight_rate_base + freight_extra, 2)
            
            # Risk premium (sanctions or local conflict insurance)
            insurance_premium = 0.20
            if source["sanctions_risk"] == "High":
                insurance_premium = 4.50 # Compliance/sanction check fees
            elif active_choke_point == "Bab-el-Mandeb" and name == "Russia Urals" and not suez_blocked:
                insurance_premium = 2.80 # War risk premium in Red Sea
            elif hormuz_blocked and name == "Iraq Basrah Medium":
                insurance_premium = 5.00 # High premium for Strait exit bypass
                
            delivered_cost = round(base_price + freight_cost + insurance_premium, 2)
            
            # Compatibility penalty: if compatibility is below 90%, add blending costs
            blending_cost = 0.0
            if compatibility < 90.0:
                blending_cost = round((90.0 - compatibility) * 0.40, 2)
                delivered_cost = round(delivered_cost + blending_cost, 2)
                
            # Compute a recommendation score (0-100)
            # High score is better.
            # 1. Cost score (lower cost is better). Normalized against $100/bbl limit.
            cost_score = max(0, 100.0 - (delivered_cost - 60.0) * 1.5)
            # 2. Compatibility score (higher is better)
            comp_score = compatibility
            # 3. Lead time score (shorter is better). Normalized against 40 days limit.
            lead_score = max(0, 100.0 - (total_lead_time_days * 2.2))
            # 4. Risk penalty
            risk_score = 100 - (operational_risk if source["sanctions_risk"] != "High" else 60)
            
            final_score = int(
                cost_score * 0.30 +
                comp_score * 0.30 +
                lead_score * 0.20 +
                risk_score * 0.20
            )
            
            recs.append({
                "source_grade": name,
                "region": region,
                "source_coords": source.get("coords"),
                "dest_coords": REFINERY_COORDS.get(target_refinery),
                "route": route_desc,
                "voyage_days": voyage_days,
                "lead_time_days": total_lead_time_days,
                "compatibility_pct": compatibility,
                "api_gravity": source["api_gravity"],
                "sulfur_pct": source["sulfur_pct"],
                "base_price": base_price,
                "freight_cost": freight_cost,
                "insurance_premium": insurance_premium,
                "blending_cost": blending_cost,
                "delivered_cost_bbl": delivered_cost,
                "vessel_availability": vessel_avail,
                "sanctions_risk": source["sanctions_risk"],
                "score": final_score
            })
            
        # Sort recommendations by score descending
        recs = sorted(recs, key=lambda x: x["score"], reverse=True)
        return recs

# Singleton instance
procurement_orchestrator = ProcurementOrchestrator()
