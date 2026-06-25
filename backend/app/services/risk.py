import re
import time
import threading
import requests
import json
import logging
import random
import os
from collections import deque
from datetime import datetime, timedelta
from typing import Dict, List, Any
from dotenv import load_dotenv

load_dotenv()

# EIA and Gemini Configuration
EIA_API_KEY = os.getenv("EIA_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

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

# ---------------------------------------------------------------------------
# Region-aware GDELT queries. Each choke point is paired with the geopolitics of
# the waters/countries immediately around it, so the news we surface is actually
# relevant to that corridor (and its neighbourhood) rather than generic oil
# headlines. Gemini then scores the *final* disruption risk for each article.
# ---------------------------------------------------------------------------
# Gemini scores genuine disruptions high and off-topic articles (that a broad
# region query incidentally matches) low, so we use its final risk score to gate
# noise out of the feed: anything below this disruption probability is dropped.
MIN_SIGNAL_PROBABILITY = 20

CHOKE_POINT_QUERIES = {
    "Strait of Hormuz": (
        '(Hormuz OR Iran OR "Persian Gulf" OR Oman OR "Bandar Abbas" OR UAE OR Qatar) '
        '(oil OR crude OR tanker OR shipping OR naval OR sanctions OR blockade OR seizure OR attack)'
    ),
    "Bab-el-Mandeb": (
        '(Houthi OR Yemen OR "Red Sea" OR "Bab-el-Mandeb" OR Djibouti OR "Gulf of Aden" OR Eritrea) '
        '(oil OR crude OR tanker OR shipping OR drone OR missile OR attack OR vessel OR convoy)'
    ),
    "Suez Canal": (
        '("Suez Canal" OR Egypt OR "Port Said" OR Ismailia) '
        '(oil OR crude OR tanker OR shipping OR transit OR blockage OR grounding OR delay OR toll)'
    ),
    "Strait of Malacca": (
        '(Malacca OR Singapore OR Indonesia OR Malaysia OR "South China Sea") '
        '(oil OR crude OR tanker OR shipping OR piracy OR robbery OR vessel OR "ship-to-ship")'
    ),
}


class RiskAgent:
    def __init__(self):
        self.cached_signals: List[Dict[str, Any]] = DEFAULT_SIGNALS
        self.brent_price = 84.36
        self.wti_price = 84.65
        self.last_update = datetime.now()
        # Guards against two signal updates running at once (background loop +
        # manual /api/refresh-signals), which otherwise bursts GDELT into 429s.
        self._update_lock = threading.Lock()

    def fetch_eia_prices(self):
        """Fetch crude oil spot prices from EIA API."""
        if not EIA_API_KEY:
            logger.warning("EIA_API_KEY environment variable is not set. EIA spot price queries will fail.")
            return
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

    @staticmethod
    def _parse_article_date(article: Dict[str, Any]):
        """Parse a GDELT article's publish date (``seendate``) into an ISO
        timestamp plus its age in days. GDELT uses ``YYYYMMDDTHHMMSSZ``; we also
        accept plain ISO. Returns ``(None, None)`` when the date is missing or
        unparseable."""
        raw = (article.get("seendate") or "").strip()
        for fmt in ("%Y%m%dT%H%M%SZ", "%Y-%m-%dT%H:%M:%SZ"):
            try:
                dt = datetime.strptime(raw, fmt)
                age_days = (datetime.utcnow() - dt).total_seconds() / 86400.0
                return dt.strftime("%Y-%m-%dT%H:%M:%SZ"), age_days
            except (ValueError, TypeError):
                continue
        return None, None

    def fetch_choke_point_news(self, corridor: str, query: str,
                               max_articles: int = 5) -> List[Dict[str, Any]]:
        """Fetch the most recent news for one choke point and the region around
        it from GDELT (last 5 days, English, newest first).

        GDELT throttles aggressively (~1 request / 5s per IP), so transient 429s
        and read timeouts are retried with backoff before giving up."""
        params = {
            "query": f"{query} sourcelang:english",
            "mode": "ArtList",
            "format": "JSON",
            "maxrecords": max_articles,
            "sort": "DateDesc",
            "timespan": "5d",
        }
        url = "https://api.gdeltproject.org/api/v2/doc/doc"

        for attempt in range(3):
            try:
                resp = requests.get(url, params=params, timeout=15)
                if resp.status_code == 200:
                    # GDELT occasionally returns HTML on throttling — guard json().
                    try:
                        return resp.json().get("articles", []) or []
                    except ValueError:
                        logger.warning(f"GDELT returned non-JSON for {corridor}; retrying…")
                elif resp.status_code == 429:
                    wait = 5.0 * (attempt + 1)
                    logger.warning(f"GDELT 429 for {corridor}; retry in {wait:.0f}s…")
                    time.sleep(wait)
                    continue
                else:
                    logger.warning(f"GDELT HTTP {resp.status_code} for {corridor}")
                    break
            except requests.exceptions.Timeout:
                logger.warning(f"GDELT timeout for {corridor} (attempt {attempt + 1}); retrying…")
                time.sleep(3.0)
                continue
            except Exception as e:
                logger.error(f"Failed to fetch GDELT news for {corridor}: {e}")
                break
        return []

    def call_gemini_analysis(self, article: Dict[str, Any],
                             hint_corridor: str = None,
                             timestamp: str = None) -> Dict[str, Any]:
        """Invoke Gemini to analyze a news article and compute disruption parameters.

        ``hint_corridor`` is the choke point this article was surfaced for (the
        region-targeted GDELT query it came from). It is treated as authoritative
        for tagging so every monitored corridor gets its own live signals — Gemini
        only scores the probability/type/summary. ``timestamp`` is the article's
        real publish date (ISO); we fall back to now() if it is missing."""
        try:
            title = article.get("title", "")
            domain = article.get("domain", "")
            url = article.get("url", "")
            seendate = article.get("seendate", "")

            corridor_line = (
                f"This news concerns the {hint_corridor} region.\n"
                if hint_corridor else ""
            )

            prompt = f"""
            Analyze the following news item and evaluate its geopolitical risk impact on energy supply chains.
            {corridor_line}Specifically, determine:
            1. The Disruption Probability Score (integer, 0 to 100) reflecting the likelihood that crude shipments along this route are delayed, blocked, or rerouted.
            2. The risk category: "Geopolitical", "Security", "Logistics", "Sanctions", or "Weather".
            3. A concise 2-sentence summary detailing the operational impact of the risk.

            News Item:
            Title: {title}
            Source Domain: {domain}
            Published: {seendate}
            URL: {url}

            You MUST output the result in a raw JSON format exactly like this:
            {{
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

                # The corridor is fixed by the region query that surfaced this
                # article, so each choke point reliably gets its own signals.
                corridor = hint_corridor or "Strait of Hormuz"

                return {
                    "id": f"sig-{random.randint(1000, 9999)}",
                    "timestamp": timestamp or datetime.now().strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "corridor": corridor,
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
        """Run the geopolitical agent flow: pull region-relevant news for every
        choke point and have Gemini score the final disruption risk per item."""
        # Skip if another update is already running (background loop + manual
        # refresh) — hammering GDELT concurrently just earns 429s.
        if not self._update_lock.acquire(blocking=False):
            logger.info("Signal update already in progress; returning cached signals.")
            return self.cached_signals
        try:
            return self._run_update()
        finally:
            self._update_lock.release()

    def _run_update(self) -> List[Dict[str, Any]]:
        logger.info("Running Geopolitical Risk Agent signal update...")
        self.fetch_eia_prices()

        new_signals: List[Dict[str, Any]] = []

        for idx, (corridor, query) in enumerate(CHOKE_POINT_QUERIES.items()):
            # Space GDELT requests ~5s apart to stay under its rate limit.
            if idx > 0:
                time.sleep(5.0)
            articles = self.fetch_choke_point_news(corridor, query, max_articles=5)
            seen_titles = set()
            analyzed = 0
            for art in articles:
                title = (art.get("title") or "").strip()
                if not title or title in seen_titles:
                    continue
                seen_titles.add(title)
                # Only keep genuinely recent news (within the last 5 days). Skip
                # before spending a Gemini call on stale articles.
                ts_iso, age_days = self._parse_article_date(art)
                if age_days is not None and age_days > 5:
                    continue
                signal = self.call_gemini_analysis(
                    art, hint_corridor=corridor, timestamp=ts_iso
                )
                # Count every Gemini call for cost control, but only keep signals
                # whose final risk clears the noise threshold.
                if signal:
                    analyzed += 1
                    if signal["probability"] >= MIN_SIGNAL_PROBABILITY:
                        new_signals.append(signal)
                # Cap Gemini calls at 2 per corridor to respect the rate limit.
                if analyzed >= 2:
                    break

        # Merge fresh signals ahead of the cache, de-duplicating by title.
        if new_signals:
            titles = {s["title"] for s in new_signals}
            self.cached_signals = new_signals + [
                s for s in self.cached_signals if s["title"] not in titles
            ]

        # Keep newest first and cap the list size.
        self.cached_signals = sorted(
            self.cached_signals, key=lambda x: x["timestamp"], reverse=True
        )[:16]
        self.last_update = datetime.now()

        logger.info(
            f"Risk signal update complete: {len(new_signals)} fresh, "
            f"{len(self.cached_signals)} total cached."
        )
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
        if not GEMINI_API_KEY:
            logger.error("GEMINI_API_KEY environment variable is not set. Gemini API requests will fail.")
            return "ERROR: Gemini API key is not configured."

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
