from typing import Dict, Any, List

# Define baseline configurations and sensitivities for each choke point
CHOKE_POINT_IMPACT_METRICS = {
    "Strait of Hormuz": {
        "import_share": 0.60, # 60% of Indian crude imports pass through Hormuz
        "refinery_exposure": {
            "Jamnagar Refinery": 0.85, # 85% dependent on Middle East crude
            "Mumbai Refinery": 0.70,
            "Mangalore Refinery": 0.65,
            "Kochi Refinery": 0.55
        },
        "price_sensitivity": 0.25, # Brent increases by $0.25 per 1% blockage
        "power_sensitivity": 0.6,
        "gdp_sensitivity": -0.015, # GDP drops by 0.015% per 1% blockage
        "cpi_sensitivity": 0.025
    },
    "Bab-el-Mandeb": {
        "import_share": 0.22, # 22% of crude/products (Russian, European oil)
        "refinery_exposure": {
            "Jamnagar Refinery": 0.15,
            "Mumbai Refinery": 0.35,
            "Mangalore Refinery": 0.40,
            "Kochi Refinery": 0.45
        },
        "price_sensitivity": 0.12, # Adds routing surcharge
        "power_sensitivity": 0.25,
        "gdp_sensitivity": -0.005,
        "cpi_sensitivity": 0.010
    },
    "Suez Canal": {
        "import_share": 0.15,
        "refinery_exposure": {
            "Jamnagar Refinery": 0.10,
            "Mumbai Refinery": 0.25,
            "Mangalore Refinery": 0.30,
            "Kochi Refinery": 0.35
        },
        "price_sensitivity": 0.08,
        "power_sensitivity": 0.18,
        "gdp_sensitivity": -0.003,
        "cpi_sensitivity": 0.006
    },
    "Strait of Malacca": {
        "import_share": 0.08,
        "refinery_exposure": {
            "Jamnagar Refinery": 0.05,
            "Mumbai Refinery": 0.10,
            "Mangalore Refinery": 0.15,
            "Kochi Refinery": 0.15
        },
        "price_sensitivity": 0.05,
        "power_sensitivity": 0.10,
        "gdp_sensitivity": -0.002,
        "cpi_sensitivity": 0.004
    },
    "Cape of Good Hope": {
        "import_share": 0.05,
        "refinery_exposure": {
            "Jamnagar Refinery": 0.02,
            "Mumbai Refinery": 0.05,
            "Mangalore Refinery": 0.08,
            "Kochi Refinery": 0.08
        },
        "price_sensitivity": 0.03,
        "power_sensitivity": 0.05,
        "gdp_sensitivity": -0.001,
        "cpi_sensitivity": 0.002
    },
    "Panama Canal": {
        "import_share": 0.02,
        "refinery_exposure": {
            "Jamnagar Refinery": 0.01,
            "Mumbai Refinery": 0.02,
            "Mangalore Refinery": 0.02,
            "Kochi Refinery": 0.02
        },
        "price_sensitivity": 0.02,
        "power_sensitivity": 0.02,
        "gdp_sensitivity": -0.0005,
        "cpi_sensitivity": 0.001
    }
}

class ScenarioModeller:
    def __init__(self):
        pass

    def simulate(self, choke_point: str, blockage_pct: float) -> Dict[str, Any]:
        """
        Simulate cascading impact of a specific flow blockage at a choke point.
        blockage_pct ranges from 0 to 100.
        """
        if choke_point not in CHOKE_POINT_IMPACT_METRICS:
            # Return baseline empty stats
            return self._get_baseline_stats()

        metrics = CHOKE_POINT_IMPACT_METRICS[choke_point]
        import_share = metrics["import_share"]
        
        # Calculate Import Volume at Risk
        volume_at_risk_pct = round(import_share * blockage_pct, 2)
        
        # Refinery Run Rates
        refineries_impact = {}
        for ref_name, exposure in metrics["refinery_exposure"].items():
            # Run rate starts at 98% and drops based on exposure and blockage
            drop = exposure * (blockage_pct / 100.0) * 22.0 # Max 22% drop for full exposure
            run_rate = max(100.0 - drop - (5.0 if blockage_pct > 10 else 0), 45.0) # Lower bound 45%
            refineries_impact[ref_name] = {
                "name": ref_name,
                "exposure": exposure,
                "baseline_run_rate": 96.0,
                "current_run_rate": round(run_rate, 1),
                "drop_pct": round(96.0 - run_rate, 1)
            }
            
        # Fuel Price Impact
        price_increase_bbl = round(metrics["price_sensitivity"] * blockage_pct, 2)
        fuel_price_rise_pct = round((price_increase_bbl / 84.36) * 100.0, 1)
        
        # Power Sector Stress
        power_stress = min(25.0 + (metrics["power_sensitivity"] * blockage_pct), 95.0)
        
        # GDP / CPI
        gdp_delta = round(metrics["gdp_sensitivity"] * blockage_pct, 2)
        cpi_delta = round(metrics["cpi_sensitivity"] * blockage_pct, 2)
        
        return {
            "choke_point": choke_point,
            "blockage_pct": blockage_pct,
            "volume_at_risk_pct": volume_at_risk_pct,
            "refineries": list(refineries_impact.values()),
            "price_increase_bbl": price_increase_bbl,
            "fuel_price_rise_pct": fuel_price_rise_pct,
            "power_stress_pct": round(power_stress, 1),
            "gdp_delta_pct": gdp_delta,
            "cpi_delta_pct": cpi_delta,
            "assumptions": [
                f"India imports {int(import_share * 100)}% of crude through {choke_point}.",
                f"Alternative logistics routes add shipping premiums of ${round(metrics['price_sensitivity']*4, 2)}/bbl per day delay.",
                "Power grid stress accounts for domestic coal-to-gas fuel switching limits.",
                "Economic cascading models assume a 3-week persistence of disruption before SPR drawdown."
            ]
        }

    def _get_baseline_stats(self) -> Dict[str, Any]:
        return {
            "choke_point": "None",
            "blockage_pct": 0.0,
            "volume_at_risk_pct": 0.0,
            "refineries": [
                {"name": "Jamnagar Refinery", "exposure": 0.0, "baseline_run_rate": 96.0, "current_run_rate": 96.0, "drop_pct": 0.0},
                {"name": "Mumbai Refinery", "exposure": 0.0, "baseline_run_rate": 94.0, "current_run_rate": 94.0, "drop_pct": 0.0},
                {"name": "Mangalore Refinery", "exposure": 0.0, "baseline_run_rate": 95.0, "current_run_rate": 95.0, "drop_pct": 0.0},
                {"name": "Kochi Refinery", "exposure": 0.0, "baseline_run_rate": 95.0, "current_run_rate": 95.0, "drop_pct": 0.0}
            ],
            "price_increase_bbl": 0.0,
            "fuel_price_rise_pct": 0.0,
            "power_stress_pct": 25.0,
            "gdp_delta_pct": 0.0,
            "cpi_delta_pct": 0.0,
            "assumptions": ["All shipping lanes operating under normal safety protocols."]
        }

    def get_preset_scenario(self, name: str) -> Dict[str, Any]:
        """Get simulation results for standard preset incidents."""
        if name == "Hormuz Partial Closure":
            return self.simulate("Strait of Hormuz", 50.0)
        elif name == "OPEC+ Emergency Cut":
            # OPEC+ cut isn't just one choke point, it blocks supply globally.
            # We model it as a high-risk scenario on Strait of Hormuz + general routes.
            res = self.simulate("Strait of Hormuz", 30.0)
            res["choke_point"] = "OPEC+ Emergency Cut"
            res["price_increase_bbl"] = 15.20
            res["fuel_price_rise_pct"] = 18.0
            res["power_stress_pct"] = 52.0
            res["gdp_delta_pct"] = -0.55
            res["cpi_delta_pct"] = 1.15
            res["assumptions"] = [
                "OPEC+ cuts 3.0 million barrels per day starting immediately.",
                "Global spot oil markets react with panic bidding, raising Brent crude prices by 18%.",
                "Downstream power sector suffers from secondary LNG spikes as gas is diverted to Europe."
            ]
            return res
        elif name == "Red Sea shipping suspension":
            # 100% Bab-el-Mandeb closure
            res = self.simulate("Bab-el-Mandeb", 100.0)
            res["choke_point"] = "Bab-el-Mandeb"
            # Adjust price rise since it's a rerouting fee rather than a complete cut
            res["price_increase_bbl"] = 4.80
            res["fuel_price_rise_pct"] = 5.7
            res["power_stress_pct"] = 38.0
            res["gdp_delta_pct"] = -0.18
            res["cpi_delta_pct"] = 0.35
            res["assumptions"] = [
                "Bab-el-Mandeb/Suez routing suspended for all VLCC tankers.",
                "Rerouting via Cape of Good Hope adds 12-15 days and 6,000 miles to transit.",
                "Freight rates jump by 50% due to tight tanker supply; war insurance premiums rise 100%."
            ]
            return res
        else:
            return self._get_baseline_stats()

# Singleton instance
scenario_modeller = ScenarioModeller()
