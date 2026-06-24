import asyncio
import json
import logging
import os
import websockets
from typing import Set, Dict, Any
from dotenv import load_dotenv
from choke_points import CHOKE_POINTS, get_choke_point_for_coords

load_dotenv()

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AISClient")

AIS_STREAM_URL = "wss://stream.aisstream.io/v0/stream"
DEFAULT_API_KEY = "faa077e2e9c38a35328d3606443fef09c33f22b5"
API_KEY = os.getenv("AISSTREAM_API_KEY", DEFAULT_API_KEY)

class AISClientManager:
    def __init__(self):
        self.active_queues: Set[asyncio.Queue] = set()
        self.running = False
        self.task: asyncio.Task = None
        # Cache to keep track of last known ship positions to send static data updates, etc.
        self.ship_cache: Dict[int, Dict[str, Any]] = {}

    def register_queue(self, queue: asyncio.Queue):
        self.active_queues.add(queue)
        logger.info(f"Registered new client queue. Total queues: {len(self.active_queues)}")
        # Send cached ship positions to the newly connected client immediately
        for mmsi, ship_data in self.ship_cache.items():
            queue.put_nowait(ship_data)

    def unregister_queue(self, queue: asyncio.Queue):
        self.active_queues.remove(queue)
        logger.info(f"Unregistered client queue. Total queues: {len(self.active_queues)}")

    async def start(self):
        if self.running:
            return
        self.running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info("AISClientManager background task started.")

    async def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        logger.info("AISClientManager background task stopped.")

    async def _run_loop(self):
        retry_delay = 1
        max_retry_delay = 60

        # Construct bounding boxes list for aisstream.io
        bounding_boxes = [cp["bbox"] for cp in CHOKE_POINTS.values()]

        subscription_message = {
            "APIKey": API_KEY,
            "BoundingBoxes": bounding_boxes,
            "FilterMessageTypes": ["PositionReport"]
        }

        while self.running:
            try:
                logger.info(f"Connecting to aisstream.io at {AIS_STREAM_URL}...")
                async with websockets.connect(AIS_STREAM_URL, ping_interval=20, ping_timeout=20) as websocket:
                    # Reset retry delay on successful connection
                    retry_delay = 1
                    logger.info("Connected to aisstream.io. Sending subscription message...")
                    await websocket.send(json.dumps(subscription_message))
                    logger.info("Subscription sent. Listening for messages...")

                    while self.running:
                        message_str = await websocket.recv()
                        try:
                            msg = json.loads(message_str)
                            self._process_message(msg)
                        except json.JSONDecodeError:
                            logger.warning("Received invalid JSON message from aisstream.")
                        except Exception as e:
                            logger.error(f"Error processing message: {e}", exc_info=True)

            except (websockets.exceptions.ConnectionClosed, OSError) as e:
                logger.warning(f"Connection lost: {e}. Retrying in {retry_delay}s...")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)
            except asyncio.CancelledError:
                logger.info("AISClientManager loop cancelled.")
                break
            except Exception as e:
                logger.error(f"Unexpected error in AISClientManager: {e}", exc_info=True)
                await asyncio.sleep(5)

    def _process_message(self, msg: dict):
        metadata = msg.get("MetaData", {})
        mmsi = metadata.get("MMSI")
        if not mmsi:
            return

        lat = metadata.get("latitude")
        lon = metadata.get("longitude")
        if lat is None or lon is None:
            return

        choke_point = get_choke_point_for_coords(lat, lon)
        if not choke_point:
            # Drop messages that fall outside our designated choke point bounding boxes
            return

        ship_name = metadata.get("ShipName", "").strip() or f"Vessel {mmsi}"
        time_utc = metadata.get("time_utc")

        # Extract detailed position info if available
        msg_type = msg.get("MessageType")
        msg_payload = msg.get("Message", {}).get(msg_type, {}) if msg_type else {}

        # Speed and Heading
        sog = msg_payload.get("Sog")  # Speed over ground (in knots * 10 or float knots)
        # In AIS, Sog is usually in 1/10 knots, but aisstream decoded is typically float knots. Let's make sure it is float.
        sog = float(sog) if sog is not None else 0.0
        
        cog = msg_payload.get("Cog")  # Course over ground
        cog = float(cog) if cog is not None else 0.0

        heading = msg_payload.get("TrueHeading")
        heading = int(heading) if heading is not None and heading != 511 else None

        # Build clean payload for frontend
        payload = {
            "mmsi": mmsi,
            "name": ship_name,
            "lat": lat,
            "lon": lon,
            "sog": sog,
            "cog": cog,
            "heading": heading,
            "chokePoint": choke_point,
            "time": time_utc
        }

        # Cache the latest state of this vessel
        self.ship_cache[mmsi] = payload

        # Broadcast to all active websocket queues
        for queue in self.active_queues:
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                # If queue is full, retrieve one item to make space and put new one
                try:
                    queue.get_nowait()
                    queue.put_nowait(payload)
                except Exception:
                    pass

# Singleton instance
stream_manager = AISClientManager()
