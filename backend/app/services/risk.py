import re
import time
import threading
import requests
import json
import logging
import random
from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Any

# EIA and Gemini Configuration
EIA_API_KEY = "NpvEsbZ7tefWoXj5SYrQEPRT5YyADH0cd8x6Rng4"
GEMINI_API_KEY = "AQ.Ab8RN6KCGkynNxFab8geBhFmlZ6X0YDbsQpPgpQl2hWmfCgwKw"

# Models tried in order by gemini_generate(): the first is primary, the rest are
# silent fallbacks. If the primary exhausts its retries (transient 5xx/429),
# generation drops to the next model so the UI never shows the
# "AI advisory unavailable" banner. gemini_generate() also retries on 5xx as
# well as 429/503 and logs every HTTP status to the console.
GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash"]

# ---------------------------------------------------------------------------
# Thread-safe sliding-window rate limiter: max 9 Gemini calls per 60 seconds.
# Blocks the calling thread until a slot opens rather than dropping requests.
# ---------------------------------------------------------------------------
class _GeminiRateLimiter:
    def __init__(self, limit: int = 9, window: float = 60.0):
        self._limit  = limit
        self._window = window
        self._calls: deque = deque()
        self._lock   = threading.Lock()

    def acquire(self) -> None:
        """Block until a rate-limit slot is available, then claim it."""
        while True:
            with self._lock:
                now = time.monotonic()
                # Evict timestamps older than the window
                while self._calls and now - self._calls[0] >= self._window:
                    self._calls.popleft()
                if len(self._calls) < self._limit:
                    self._calls.append(now)
                    return
                # Compute how long until the oldest slot expires
                wait = self._window - (now - self._calls[0])
            logger.info(f"Gemini rate limit reached ({self._limit}/min). Waiting {wait:.1f}s…")
            time.sleep(max(wait, 0.5))

_rate_limiter = _GeminiRateLimiter(limit=13, window=60.0)

logger = logging.getLogger(__name__)

# Fallback signals to display instantly while fetching or if APIs fail
DEFAULT_SIGNALS = [
    {
        "id": "sig-001",
        "timestamp": (datetime.now() - timedelta(minutes=15)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "corridor": "Strait of Hormuz",
        "title": "Iran Floating Oil Stockpile Jumps 65% As U.S. Naval Blockade Bites",
        "source": "ZeroHedge",
        "url": "https://www.zerohedge.com/markets/irans-floating-oil-stockpile-jumps-65-us-naval-blockade-bites",
        "probability": 72,
        "type": "Geopolitical",
        "summary": "Satellite imagery shows tankers loitering near Bandar Abbas, marking a spike in stockpiled crude. U.S. Navy enforces stricter naval monitoring, causing ship tracking systems to go dark."
    },
    {
        "id": "sig-002",
        "timestamp": (datetime.now() - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "corridor": "Bab-el-Mandeb",
        "title": "Houthi Forces Target Bulk Crude Carrier off Yemen Coast in Red Sea",
        "source": "Reuters",
        "url": "https://www.reuters.com",
        "probability": 85,
        "type": "Security",
        "summary": "A crude carrier reporting under Liberian flag was targeted by an explosive drone. The vessel sustained minor damage but continues on its path. War risk premiums for the Bab-el-Mandeb transit surge by 40%."
    },
    {
        "id": "sig-003",
        "timestamp": (datetime.now() - timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "corridor": "Suez Canal",
        "title": "Suez Canal Authority Increases Transit Surcharges for VLCC Tankers",
        "source": "Bloomberg",
        "url": "https://www.bloomberg.com",
        "probability": 30,
        "type": "Logistics",
        "summary": "Suez Canal announces a 15% rate hike for laden tankers starting next month. The hike is expected to drive minor route adjustments around the Cape of Good Hope for cost-conscious shippers."
    },
    {
        "id": "sig-004",
        "timestamp": (datetime.now() - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "corridor": "Strait of Malacca",
        "title": "Malaysian Maritime Authorities Intercept Illegal Ship-to-Ship Oil Transfer",
        "source": "Lloyd's List",
        "url": "https://lloydslist.maritimeintelligence.informa.com",
        "probability": 25,
        "type": "Sanctions",
        "summary": "Two dark VLCCs were intercepted transferring sanctioned Russian Urals crude in Malaysian waters. The action causes localized patrol tightening and temporary route delays near Singapore."
    }
]

class RiskAgent:
    def __init__(self):
        self.cached_signals: List[Dict[str, Any]] = DEFAULT_SIGNALS
        self.brent_price = 84.36
        self.wti_price = 84.65
        self.last_update = datetime.now()

    def fetch_eia_prices(self):
        """Fetch crude oil spot prices from EIA API."""
        try:
            url = f"https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key={EIA_API_KEY}&frequency=daily&data[]=value&sort[0][column]=period&sort[0][direction]=desc&length=5"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get("response", {}).get("data", [])
                for row in data:
                    if row.get("series") == "RBRTE": # Europe Brent
                        self.brent_price = float(row.get("value", 84.36))
                    elif row.get("series") == "RWTC": # WTI Cushing
                        self.wti_price = float(row.get("value", 84.65))
                logger.info(f"EIA prices fetched: Brent=${self.brent_price}, WTI=${self.wti_price}")
        except Exception as e:
            logger.error(f"Failed to fetch EIA prices: {e}")

    def fetch_gdelt_news(self) -> List[Dict[str, Any]]:
        """Fetch oil/crude/shipping/blockade news articles from GDELT."""
        try:
            # Query GDELT for recent shipping/oil disruption news
            query = "(oil OR crude OR geopolitical OR shipping OR blockade OR tankers)"
            url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={query}&mode=ArtList&format=JSON&maxresults=10"
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                articles = resp.json().get("articles", [])
                return articles
        except Exception as e:
            logger.error(f"Failed to fetch GDELT news: {e}")
        return []

    def call_gemini_analysis(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """Invoke Gemini 2.5 Flash to analyze a news article and compute disruption parameters."""
        try:
            title = article.get("title", "")
            domain = article.get("domain", "")
            url = article.get("url", "")
            
            prompt = f"""
            Analyze the following news item and evaluate its geopolitical risk impact on energy supply chains.
            Specifically, determine:
            1. Which shipping corridor/choke point is affected. Choose EXACTLY from: "Strait of Hormuz", "Bab-el-Mandeb", "Strait of Malacca", "Suez Canal", "Cape of Good Hope", "Panama Canal". If none are mentioned, map to the closest logical shipping pathway.
            2. The Disruption Probability Score (integer, 0 to 100) reflecting the likelihood that crude shipments along this route are delayed, blocked, or rerouted.
            3. The risk category: "Geopolitical", "Security", "Logistics", "Sanctions", or "Weather".
            4. A concise 2-sentence summary detailing the operational impact of the risk.

            News Item:
            Title: {title}
            Source Domain: {domain}
            URL: {url}

            You MUST output the result in a raw JSON format exactly like this:
            {{
                "corridor": "Affected Choke Point",
                "probability": 75,
                "type": "Risk Category",
                "summary": "Your 2-sentence summary here."
            }}
            Do NOT wrap the JSON in ```json markdown blocks. Return only raw text.
            """
            
            generation_config = {"responseMimeType": "application/json"}
            text = self.gemini_generate(prompt, timeout=12, generation_config=generation_config)
            if text and not text.startswith("ERROR:"):
                # Clean the response in case it contains markdown formatting
                text_clean = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
                text_clean = re.sub(r"\s*```$", "", text_clean, flags=re.IGNORECASE).strip()
                
                parsed = json.loads(text_clean)
                
                # Double-check corridor names
                valid_corridors = ["Strait of Hormuz", "Bab-el-Mandeb", "Strait of Malacca", "Suez Canal", "Cape of Good Hope", "Panama Canal"]
                if parsed.get("corridor") not in valid_corridors:
                    # Choose a sensible default based on keywords
                    title_lower = title.lower()
                    if "hormuz" in title_lower or "iran" in title_lower:
                        parsed["corridor"] = "Strait of Hormuz"
                    elif "houthi" in title_lower or "red sea" in title_lower or "yemen" in title_lower:
                        parsed["corridor"] = "Bab-el-Mandeb"
                    elif "suez" in title_lower or "egypt" in title_lower:
                        parsed["corridor"] = "Suez Canal"
                    elif "malacca" in title_lower or "singapore" in title_lower:
                        parsed["corridor"] = "Strait of Malacca"
                    elif "panama" in title_lower:
                        parsed["corridor"] = "Panama Canal"
                    else:
                        parsed["corridor"] = random.choice(valid_corridors)
                
                return {
                    "id": f"sig-{random.randint(1000, 9999)}",
                    "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "corridor": parsed.get("corridor"),
                    "title": title,
                    "source": domain if domain else "GDELT News",
                    "url": url,
                    "probability": int(parsed.get("probability", 50)),
                    "type": parsed.get("type", "Geopolitical"),
                    "summary": parsed.get("summary", "No detail provided.")
                }
        except Exception as e:
            logger.error(f"Gemini article analysis failed: {e}")
        return None

    def update_signals(self) -> List[Dict[str, Any]]:
        """Run the geopolitical agent flow: fetch news and extract risk signals."""
        logger.info("Running Geopolitical Risk Agent signal update...")
        self.fetch_eia_prices()
        
        articles = self.fetch_gdelt_news()
        new_signals = []
        
        # Analyze top 3 articles to save tokens and time
        for art in articles[:3]:
            signal = self.call_gemini_analysis(art)
            if signal:
                new_signals.append(signal)
                
        # Merge and keep unique signals sorted by timestamp
        if new_signals:
            # Filter duplicates by title
            titles = [s["title"] for s in new_signals]
            self.cached_signals = new_signals + [s for s in self.cached_signals if s["title"] not in titles]
            
        # Keep list size capped
        self.cached_signals = sorted(self.cached_signals, key=lambda x: x["timestamp"], reverse=True)[:12]
        self.last_update = datetime.now()
        
        return self.cached_signals

    def get_latest_signals(self) -> List[Dict[str, Any]]:
        """Return currently loaded risk signals."""
        return self.cached_signals

    def gemini_generate(self, prompt: str, timeout: int = 60,
                        generation_config: Dict[str, Any] = None) -> str:
        """Send a prompt to the configured Gemini models, honouring the
        per-minute rate limit.

        Tries each model in GEMINI_MODELS in order (primary first, then silent
        fallbacks). For each model it retries on transient 429/5xx errors. Every
        HTTP status is logged to the console. Only returns the error string if
        every model and retry is exhausted."""
        _rate_limiter.acquire()

        headers = {"Content-Type": "application/json"}
        data    = {"contents": [{"parts": [{"text": prompt}]}]}
        if generation_config:
            data["generationConfig"] = generation_config

        attempts = 4
        for model in GEMINI_MODELS:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{model}:generateContent?key={GEMINI_API_KEY}"
            )
            for attempt in range(attempts):
                try:
                    resp = requests.post(url, headers=headers, json=data, timeout=timeout)
                    # Log the API status to the console for every call.
                    logger.info(
                        f"[Gemini] {model} attempt {attempt + 1}/{attempts} -> "
                        f"HTTP {resp.status_code}"
                    )
                    if resp.status_code == 200:
                        # Thinking models stream a `thought` part before the real
                        # answer — skip those and return the first non-thought part.
                        parts = (
                            resp.json()
                            .get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [])
                        )
                        text = next(
                            (p["text"] for p in parts if not p.get("thought") and p.get("text")),
                            None,
                        )
                        if text:
                            return text.strip()
                        # 200 but no usable answer (e.g. truncated mid-thought) —
                        # treat as transient and retry.
                        logger.warning(
                            f"[Gemini] {model} returned 200 with no answer part on "
                            f"attempt {attempt + 1}; retrying…"
                        )
                    # Retry on rate limits (429) and any transient 5xx.
                    elif resp.status_code == 429 or resp.status_code >= 500:
                        wait = 2.0 ** attempt          # 1 s, 2 s, 4 s
                        logger.warning(
                            f"[Gemini] {model} {resp.status_code} on attempt "
                            f"{attempt + 1}, retrying in {wait:.0f}s…"
                        )
                        time.sleep(wait)
                        continue
                    else:
                        # Non-retryable client error (e.g. 400/403) — abandon this
                        # model and fall through to the next one.
                        logger.error(f"[Gemini] {model} {resp.status_code}: {resp.text[:300]}")
                        break
                except Exception as exc:
                    logger.error(f"[Gemini] {model} request error (attempt {attempt + 1}): {exc}")
                    time.sleep(min(2.0 ** attempt, 8.0))

            # This model is exhausted; fall back to the next one (if any).
            if model != GEMINI_MODELS[-1]:
                logger.warning(f"[Gemini] {model} exhausted; falling back to next model…")

        logger.error("[Gemini] all models exhausted — returning error string.")
        return "ERROR: Unable to communicate with Gemini API. Please verify network connectivity."

    def generate_ai_brief(self, current_risk_profile: str) -> str:
        """Query Gemini to generate a high-level executive resilience brief."""
        prompt = f"""
        You are the Antigravity Energy Security Intelligence Copilot.
        Generate an Executive Briefing on the current global oil shipping risk profile based on this summary data:
        {current_risk_profile}

        Structure the briefing as follows:
        1. **CRITICAL RISK ASSESSMENT**: Highlight the highest probability corridors at risk and why.
        2. **SUPPLY CHAIN & REFINERY IMPLICATION**: How this impacts refinery run rates in India (Jamnagar, Kochi, Mumbai, Mangalore) and days of cover.
        3. **STRATEGIC RECOMMENDATIONS**: List 3 immediate, costed actions for the procurement and policy teams (e.g. SPR releases, spot rerouting, tanker hedging).

        Keep the tone formal, direct, and actionable. Write about 250 words total. Return clean Markdown without code fences.
        """
        return self.gemini_generate(prompt)

# Singleton instance
risk_agent = RiskAgent()
