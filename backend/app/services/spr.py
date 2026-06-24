from typing import Dict, List, Any
import numpy as np

class SPROptimizer:
    def __init__(self):
        # India's SPR configuration
        self.capacity_bbl = 39.0 * 1e6   # 39 Million Barrels total capacity
        self.current_stock_bbl = 26.5 * 1e6 # 26.5 Million Barrels currently stored (~68% full)
        self.max_drawdown_rate_bbl = 1.2 * 1e6 # 1.2 Million Barrels per day pumping limit
        self.max_replenish_rate_bbl = 0.4 * 1e6 # 0.4 Million Barrels per day injection limit

    def optimize_drawdown(self, supply_gap_forecast: List[float], refinery_demand: List[float], brent_prices: List[float]) -> Dict[str, Any]:
        """
        Optimize daily SPR drawdown schedules over a 30-day period.
        supply_gap_forecast: predicted import shortfall in barrels per day for 30 days.
        refinery_demand: daily refinery demand in barrels per day for 30 days.
        brent_prices: forecast price per day for 30 days.
        """
        days = len(supply_gap_forecast)
        
        # Initialize scheduling arrays
        drawdown_schedule = []
        replenish_schedule = []
        spr_inventory = []
        shortfall_remaining = []
        
        current_inventory = self.current_stock_bbl
        
        for t in range(days):
            gap = supply_gap_forecast[t]
            price = brent_prices[t]
            demand = refinery_demand[t]
            
            drawdown = 0.0
            replenish = 0.0
            
            # Heuristic decision making:
            # 1. If there is a supply gap, we need to draw down SPR.
            if gap > 0:
                # Can draw up to the gap, the daily pumping capacity, or remaining stock
                drawdown = min(gap, self.max_drawdown_rate_bbl, current_inventory)
                current_inventory -= drawdown
            # 2. If there is no gap and price is low, consider replenishing SPR
            elif gap <= 0 and price < 80.0:
                # Can inject up to the replenishment limit or available capacity
                avail_space = self.capacity_bbl - current_inventory
                replenish = min(self.max_replenish_rate_bbl, avail_space)
                current_inventory += replenish
                
            drawdown_schedule.append(round(drawdown, 0))
            replenish_schedule.append(round(replenish, 0))
            spr_inventory.append(round(current_inventory, 0))
            
            # Net shortfall on day t
            net_shortfall = max(0.0, gap - drawdown)
            shortfall_remaining.append(round(net_shortfall, 0))

        # Calculate summary metrics
        total_initial_gap = sum(supply_gap_forecast)
        total_covered = sum(drawdown_schedule)
        total_remaining_shortfall = sum(shortfall_remaining)
        
        percent_covered = 100.0
        if total_initial_gap > 0:
            percent_covered = round((total_covered / total_initial_gap) * 100.0, 1)
            
        remaining_days_cover = 0
        average_demand = np.mean(refinery_demand)
        if average_demand > 0:
            remaining_days_cover = round((current_inventory / average_demand), 1)
            
        exhaustion_days = -1
        if total_remaining_shortfall > 0 and current_inventory > 0:
            # How long could we survive at the average daily gap rate?
            avg_gap = np.mean(supply_gap_forecast)
            if avg_gap > 0:
                exhaustion_days = int(current_inventory / avg_gap)

        return {
            "time_steps": list(range(1, days + 1)),
            "daily_drawdown": [d / 1e6 for d in drawdown_schedule], # Convert to Million Barrels
            "daily_replenish": [r / 1e6 for r in replenish_schedule],
            "daily_inventory": [inv / 1e6 for inv in spr_inventory],
            "daily_shortfall_original": [g / 1e6 for g in supply_gap_forecast],
            "daily_shortfall_remaining": [s / 1e6 for s in shortfall_remaining],
            "metrics": {
                "initial_stock_mb": round(self.current_stock_bbl / 1e6, 2),
                "ending_stock_mb": round(current_inventory / 1e6, 2),
                "total_drawdown_mb": round(total_covered / 1e6, 2),
                "total_replenished_mb": round(sum(replenish_schedule) / 1e6, 2),
                "shortfall_covered_pct": percent_covered,
                "days_of_cover_remaining": remaining_days_cover,
                "inventory_fill_ratio_pct": round((current_inventory / self.capacity_bbl) * 100.0, 1),
                "exhaustion_risk_days": exhaustion_days # -1 means no risk
            }
        }

# Singleton instance
spr_optimizer = SPROptimizer()
