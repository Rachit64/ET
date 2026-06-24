import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# India's structural crude import footprint (used for the depreciation model)
INDIA_CRUDE_IMPORT_BPD = 4.7e6        # ~4.7 million barrels/day imported
INDIA_FX_RESERVES_USD = 645e9         # ~$645B FX reserves (cushion reference)
FALLBACK_USD_INR = 86.5               # used only if every live source fails


class CurrencyService:
    """Live USD/INR data + a transparent oil-shock depreciation model. No API key required."""

    def __init__(self):
        self._cache_rate: float = FALLBACK_USD_INR
        self._cache_time: datetime = datetime.min

    def get_live(self) -> Dict[str, Any]:
        """Fetch the live USD/INR spot rate (open.er-api.com, falling back to frankfurter.app)."""
        # Primary: open.er-api.com (free, no key)
        try:
            resp = requests.get("https://open.er-api.com/v6/latest/USD", timeout=10)
            if resp.status_code == 200:
                rate = resp.json().get("rates", {}).get("INR")
                if rate:
                    self._cache_rate = float(rate)
                    self._cache_time = datetime.now()
                    return {"usd_inr": round(self._cache_rate, 4), "source": "open.er-api.com",
                            "as_of": datetime.now().strftime("%Y-%m-%d %H:%M")}
        except Exception as e:
            logger.error(f"open.er-api currency fetch failed: {e}")

        # Fallback: frankfurter.app (ECB, free, no key)
        try:
            resp = requests.get("https://api.frankfurter.app/latest?from=USD&to=INR", timeout=10)
            if resp.status_code == 200:
                rate = resp.json().get("rates", {}).get("INR")
                if rate:
                    self._cache_rate = float(rate)
                    self._cache_time = datetime.now()
                    return {"usd_inr": round(self._cache_rate, 4), "source": "frankfurter.app",
                            "as_of": datetime.now().strftime("%Y-%m-%d")}
        except Exception as e:
            logger.error(f"frankfurter currency fetch failed: {e}")

        return {"usd_inr": round(self._cache_rate, 4), "source": "cached/fallback",
                "as_of": datetime.now().strftime("%Y-%m-%d")}

    def get_trend(self, days: int = 30) -> List[Dict[str, Any]]:
        """Fetch a daily USD/INR time series for the sparkline (frankfurter.app)."""
        try:
            end = datetime.now().date()
            start = end - timedelta(days=days)
            url = f"https://api.frankfurter.app/{start}..{end}?from=USD&to=INR"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                rates = resp.json().get("rates", {})
                series = [
                    {"date": d, "usd_inr": round(float(v.get("INR")), 4)}
                    for d, v in sorted(rates.items())
                    if v.get("INR") is not None
                ]
                if series:
                    return series
        except Exception as e:
            logger.error(f"frankfurter trend fetch failed: {e}")
        return []

    def project_impact(self, current_inr: float, price_increase_bbl: float,
                       volume_at_risk_pct: float) -> Dict[str, Any]:
        """
        Transparent model: India bills crude imports in USD, so an oil-price spike widens the
        annual import bill and pressures the rupee. We translate the extra USD outflow into an
        approximate depreciation, dampened by FX reserves.

        extra_annual_usd = crude_bpd * price_rise * 365
        pressure_ratio   = extra_annual_usd / FX_reserves
        depreciation_pct = pressure_ratio scaled (with a disruption/risk multiplier)
        """
        extra_annual_usd = INDIA_CRUDE_IMPORT_BPD * max(price_increase_bbl, 0.0) * 365.0
        pressure_ratio = extra_annual_usd / INDIA_FX_RESERVES_USD

        # Disruption multiplier: more import volume at risk => sharper, faster pass-through
        risk_multiplier = 1.0 + (volume_at_risk_pct / 100.0)

        # Scale to a realistic FX move (capped). Empirically, a 10% import-bill shock
        # tends to drive a low-single-digit % rupee move over weeks.
        depreciation_pct = round(min(pressure_ratio * 100.0 * 0.9 * risk_multiplier, 12.0), 2)

        projected_inr = round(current_inr * (1.0 + depreciation_pct / 100.0), 4)

        return {
            "current_inr": round(current_inr, 4),
            "projected_inr": projected_inr,
            "depreciation_pct": depreciation_pct,
            "extra_annual_import_bill_usd_bn": round(extra_annual_usd / 1e9, 2),
            "rationale": (
                f"A +${price_increase_bbl}/bbl spike on ~{INDIA_CRUDE_IMPORT_BPD/1e6:.1f} Mbpd of "
                f"crude imports adds ~${extra_annual_usd/1e9:.1f}B/yr to India's USD import bill. "
                f"With {volume_at_risk_pct}% of imports at risk, rupee pass-through is projected at "
                f"~{depreciation_pct}%, taking USD/INR from {round(current_inr,2)} toward {projected_inr}."
            ),
        }


# Singleton instance
currency_service = CurrencyService()
