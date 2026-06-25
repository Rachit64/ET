import asyncio
import json
import logging
import random
import time
import math
import os
from typing import Dict, List, Any
from dotenv import load_dotenv

load_dotenv()

# Predefined waypoints for shipping corridors to Indian refineries
# Coordinates: [lon, lat] - GeoJSON standard is [lon, lat]
ROUTES = {
    "Strait of Hormuz": {
        "corridor_line": [[48.0, 30.0], [50.0, 27.0], [53.5, 25.0], [55.0, 26.0], [56.3, 26.6], [57.5, 25.8], [60.0, 24.5], [65.0, 23.0], [69.8, 22.5]], # To Jamnagar
        "destinations": [
            {"name": "Jamnagar Refinery", "coords": [69.8, 22.5]},
            {"name": "Mumbai Refinery", "coords": [72.8, 18.9]},
            {"name": "Mangalore Refinery", "coords": [74.8, 12.9]},
            {"name": "Kochi Refinery", "coords": [76.2, 9.9]}
        ]
    },
    "Bab-el-Mandeb": {
        "corridor_line": [[32.5, 29.9], [34.0, 27.5], [38.0, 20.0], [42.0, 14.0], [43.3, 12.6], [45.0, 12.0], [50.0, 11.8], [55.0, 12.5], [65.0, 11.5], [76.2, 9.9]], # To Kochi
        "destinations": [
            {"name": "Kochi Refinery", "coords": [76.2, 9.9]},
            {"name": "Mangalore Refinery", "coords": [74.8, 12.9]},
            {"name": "Mumbai Refinery", "coords": [72.8, 18.9]}
        ]
    },
    "Strait of Malacca": {
        "corridor_line": [[104.0, 1.3], [101.5, 2.5], [98.0, 5.5], [95.0, 6.0], [90.0, 8.0], [85.0, 11.0], [80.3, 13.1]], # To Chennai
        "destinations": [
            {"name": "Chennai Refinery", "coords": [80.3, 13.1]},
            {"name": "Visakhapatnam Refinery", "coords": [83.3, 17.7]},
            {"name": "Paradip Refinery", "coords": [86.7, 20.2]}
        ]
    },
    "Suez Canal": {
        "corridor_line": [[31.2, 32.2], [32.5, 30.0], [32.5, 29.9], [34.0, 27.5], [38.0, 20.0], [42.0, 14.0], [43.3, 12.6]], # Red Sea transit
        "destinations": [
            {"name": "Kochi Refinery", "coords": [76.2, 9.9]}
        ]
    },
    "Cape of Good Hope": {
        "corridor_line": [[-10.0, 35.0], [-18.0, 0.0], [-18.0, -25.0], [18.5, -34.4], [30.0, -32.0], [50.0, -15.0], [65.0, 0.0], [74.8, 12.9]], # To Mangalore
        "destinations": [
            {"name": "Mangalore Refinery", "coords": [74.8, 12.9]},
            {"name": "Kochi Refinery", "coords": [76.2, 9.9]},
            {"name": "Mumbai Refinery", "coords": [72.8, 18.9]}
        ]
    },
    "Panama Canal": {
        "corridor_line": [[-85.0, 5.0], [-79.7, 9.1], [-70.0, 15.0], [-50.0, 15.0], [-20.0, 15.0], [0.0, 15.0], [43.3, 12.6]], # Transatlantic bypass
        "destinations": [
            {"name": "Jamnagar Refinery", "coords": [69.8, 22.5]}
        ]
    }
}

TANKER_NAMES = [
    "Orion Leader", "Pacific Sun", "Algonquin Crude", "Ocean Sovereign", "Maran Apollo",
    "Euronav Explorer", "Nippon Maru", "Kriti Voyager", "Stena Supreme", "Front Polaris",
    "Baltic Horizon", "Nordic Breeze", "Aramco Glory", "Suez Titan", "Hormuz Sentinel",
    "Sinopec Giant", "DHT Redwood", "MOL Triumph", "Maersk Tanker", "Ever Green Oil"
]

CARGO_TYPES = ["Crude Oil", "LNG", "LPG", "Refined Products"]
FLAGS = ["Panama", "Liberia", "Marshall Islands", "Singapore", "Bahamas", "India", "Saudi Arabia"]

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AISService:
    def __init__(self):
        self.vessels: List[Dict[str, Any]] = []
        self.live_connected = False
        self.simulation_mode = True # Default fallback to simulation
        self.api_key = os.getenv("AISSTREAM_API_KEY")
        self._init_simulated_vessels()
        self.loop_task = None

    def _init_simulated_vessels(self):
        """Generate static initial vessels positioned along the corridors."""
        self.vessels = []
        mmsi_counter = 431000000
        
        for corridor_name, route_data in ROUTES.items():
            line = route_data["corridor_line"]
            # Create 4-7 ships per corridor
            num_ships = random.randint(4, 7)
            for i in range(num_ships):
                # Distribute ship along the corridor path
                progress = (i + random.random()) / num_ships
                current_pos, heading = self._interpolate_path(line, progress)
                
                # Pick destination
                dest = random.choice(route_data["destinations"])
                cargo = random.choice(CARGO_TYPES)
                speed = round(random.uniform(11.5, 16.0), 1)
                
                # Check for anomalies (loitering or dark vessels)
                is_anomaly = random.random() < 0.12 # 12% chance of AIS anomaly
                anomaly_type = None
                if is_anomaly:
                    anomaly_type = random.choice(["Loitering", "Spoofed Heading", "GPS Deviation"])
                    if anomaly_type == "Loitering":
                        speed = round(random.uniform(0.5, 2.0), 1)

                vessel = {
                    "mmsi": str(mmsi_counter),
                    "name": random.choice(TANKER_NAMES) + f" {random.randint(10, 99)}",
                    "cargo_type": cargo,
                    "lat": current_pos[1],
                    "lon": current_pos[0],
                    "heading": heading,
                    "speed": speed,
                    "destination": dest["name"],
                    "flag": random.choice(FLAGS),
                    "status": "Underway Using Engine" if speed > 3.0 else "Loitering/Anchored",
                    "corridor": corridor_name,
                    "progress": progress,
                    "is_anomaly": is_anomaly,
                    "anomaly_type": anomaly_type,
                    "capacity_kbd": random.randint(500, 2000), # 1000s of barrels capacity
                    "draft": round(random.uniform(8.5, 21.0), 1)
                }
                self.vessels.append(vessel)
                mmsi_counter += 1

    def _interpolate_path(self, path: List[List[float]], progress: float):
        """Interpolate point and compute heading along a MultiPoint route line."""
        if not path:
            return [0.0, 0.0], 0
        if len(path) == 1:
            return path[0], 0
            
        # Calculate total length approximation
        segments = []
        total_len = 0.0
        for i in range(len(path) - 1):
            p1, p2 = path[i], path[i+1]
            # Simple distance
            dist = math.sqrt((p2[0]-p1[0])**2 + (p2[1]-p1[1])**2)
            segments.append(dist)
            total_len += dist
            
        if total_len == 0:
            return path[0], 0
            
        target_dist = progress * total_len
        accum_dist = 0.0
        
        for i, seg_dist in enumerate(segments):
            if accum_dist + seg_dist >= target_dist or i == len(segments) - 1:
                # Interpolate inside this segment
                p1, p2 = path[i], path[i+1]
                seg_progress = 0.0
                if seg_dist > 0:
                    seg_progress = (target_dist - accum_dist) / seg_dist
                
                lon = p1[0] + (p2[0] - p1[0]) * seg_progress
                lat = p1[1] + (p2[1] - p1[1]) * seg_progress
                
                # Heading calculation
                dy = p2[1] - p1[1]
                dx = p2[0] - p1[0]
                angle = math.degrees(math.atan2(dx, dy)) # Lon is x, Lat is y
                heading = int((angle + 360) % 360)
                
                return [lon, lat], heading
                
            accum_dist += seg_dist
            
        return path[-1], 0

    def get_vessels(self) -> List[Dict[str, Any]]:
        """Return the current active vessels."""
        return self.vessels

    def update_simulation_step(self):
        """Simulate ship movements by progressing them along their routes."""
        for v in self.vessels:
            # Speeds: normal or loitering
            current_speed = v["speed"]
            # Move slightly forward
            # 1 degree of lat/lon is roughly 60 nm. At 15 knots, that is 0.25 degrees per hour.
            # If we update every 3 seconds, that simulates faster speed to show active movement.
            # Speed factor: speed * multiplier
            multiplier = 0.0005
            progress_step = (current_speed * multiplier)
            
            # Progress loop (0 to 1)
            new_progress = v["progress"] + progress_step
            if new_progress >= 1.0:
                # Reroll or reset to start of corridor
                new_progress = 0.0
                v["name"] = random.choice(TANKER_NAMES) + f" {random.randint(10, 99)}"
                v["cargo_type"] = random.choice(CARGO_TYPES)
                v["flag"] = random.choice(FLAGS)
                # Toggle anomalies
                v["is_anomaly"] = random.random() < 0.12
                v["anomaly_type"] = random.choice(["Loitering", "Spoofed Heading", "GPS Deviation"]) if v["is_anomaly"] else None
                v["speed"] = round(random.uniform(11.5, 16.0), 1) if not v["is_anomaly"] else round(random.uniform(0.5, 2.0), 1)
                
            v["progress"] = new_progress
            
            # Update coordinate and heading
            route_data = ROUTES[v["corridor"]]
            pos, heading = self._interpolate_path(route_data["corridor_line"], new_progress)
            
            # Add slight GPS noise if it's spoofed or GPS anomaly
            if v["is_anomaly"] and v["anomaly_type"] == "GPS Deviation":
                pos[0] += random.uniform(-0.15, 0.15)
                pos[1] += random.uniform(-0.15, 0.15)
                
            v["lon"] = round(pos[0], 5)
            v["lat"] = round(pos[1], 5)
            v["heading"] = heading if v["anomaly_type"] != "Spoofed Heading" else int((heading + 180) % 360)
            
            # Update status
            v["status"] = "Underway Using Engine" if v["speed"] > 3.0 else "Loitering/Anchored"

    async def start_sim_loop(self):
        """Continuous simulation loop."""
        while True:
            if self.simulation_mode:
                self.update_simulation_step()
            await asyncio.sleep(2.0)

    async def connect_live_ais(self):
        """
        Background task to connect to aisstream.io WebSockets.
        If it fails or is not configured, automatically switches simulation_mode to True.
        """
        if not self.api_key:
            logger.warning("AISSTREAM_API_KEY is not set. Live AIS stream is disabled; running in simulation mode.")
            self.live_connected = False
            self.simulation_mode = True
            return

        import websockets
        
        # Connect to stream
        uri = "wss://stream.aisstream.io/v1/stream"
        
        # Subscribe bounding box surrounding Arabia, India, and Hornuz/Red Sea/Malacca
        # Bounding box: [[lat_min, lon_min], [lat_max, lon_max]]
        # We can define a broad Indian Ocean / Arabian Sea box
        sub_msg = {
            "APIKey": self.api_key,
            "BoundingBoxes": [
                [[-10.0, 30.0], [35.0, 110.0]] # Cover Suez to Malacca
            ],
            "FiltersShipMMSI": [],
            "FilterMessageTypes": ["PositionReport"]
        }
        
        retry_delay = 5
        while True:
            try:
                logger.info("Attempting to connect to aisstream.io WebSocket...")
                async with websockets.connect(uri) as ws:
                    self.live_connected = True
                    self.simulation_mode = False # Turn off simulation while live works!
                    logger.info("Connected to aisstream.io! Sending subscription...")
                    await ws.send(json.dumps(sub_msg))
                    
                    while True:
                        msg_str = await ws.recv()
                        msg = json.loads(msg_str)
                        self._process_live_message(msg)
                        
            except Exception as e:
                logger.error(f"AIS Stream WebSocket error: {e}. Switching to simulation fallback.")
                self.live_connected = False
                self.simulation_mode = True
                await asyncio.sleep(retry_delay)
                # Double retry delay
                retry_delay = min(retry_delay * 2, 60)

    def _process_live_message(self, msg: Dict[str, Any]):
        """Parse live AIS reports and inject/update active tanker lists."""
        try:
            metadata = msg.get("MetaData", {})
            pos_report = msg.get("Message", {}).get("PositionReport", {})
            
            mmsi = str(metadata.get("MMSI"))
            ship_name = metadata.get("ShipName", "").strip()
            
            # Simple ship filtering: only track cargo ships/tankers
            ship_type = metadata.get("ShipType", 0)
            # ShipType 80-89 is Tankers in AIS coding
            is_tanker = (80 <= ship_type <= 89) or "tanker" in ship_name.lower() or "vessel" in ship_name.lower() or "maran" in ship_name.lower()
            
            if not is_tanker:
                return # Filter out passenger/fishing/tug boats
                
            lat = pos_report.get("Latitude")
            lon = pos_report.get("Longitude")
            heading = pos_report.get("TrueHeading", 0)
            speed = pos_report.get("Sog", 0.0)
            
            if lat is None or lon is None:
                return
                
            # Classify ship into nearest corridor based on proximity
            corridor = self._classify_corridor(lon, lat)
            if not corridor:
                return # Outside our areas of interest
                
            # Add or update
            existing = next((v for v in self.vessels if v["mmsi"] == mmsi), None)
            if existing:
                existing["lat"] = lat
                existing["lon"] = lon
                existing["heading"] = heading
                existing["speed"] = speed
                existing["status"] = "Underway Using Engine" if speed > 3.0 else "Loitering/Anchored"
            else:
                dest = random.choice(ROUTES[corridor]["destinations"])
                vessel = {
                    "mmsi": mmsi,
                    "name": ship_name if ship_name else f"Tanker {mmsi[-4:]}",
                    "cargo_type": random.choice(CARGO_TYPES),
                    "lat": lat,
                    "lon": lon,
                    "heading": heading,
                    "speed": speed,
                    "destination": dest["name"],
                    "flag": random.choice(FLAGS),
                    "status": "Underway Using Engine" if speed > 3.0 else "Loitering/Anchored",
                    "corridor": corridor,
                    "progress": 0.5, # Midpoint estimate
                    "is_anomaly": False,
                    "anomaly_type": None,
                    "capacity_kbd": random.randint(500, 2000),
                    "draft": round(random.uniform(9.0, 18.0), 1)
                }
                self.vessels.append(vessel)
                
            # Cap vessels array size
            if len(self.vessels) > 100:
                self.vessels = self.vessels[-100:]
                
        except Exception as e:
            logger.error(f"Error parsing live AIS message: {e}")

    def _classify_corridor(self, lon: float, lat: float) -> str:
        """Classify a location into a choke point corridor based on coordinate boxes."""
        # Strait of Hormuz box: lat [24, 28], lon [53, 60]
        if 24.0 <= lat <= 28.0 and 53.0 <= lon <= 60.0:
            return "Strait of Hormuz"
        # Bab-el-Mandeb / Red Sea box: lat [10, 20], lon [35, 45]
        elif 10.0 <= lat <= 20.0 and 35.0 <= lon <= 45.0:
            return "Bab-el-Mandeb"
        # Strait of Malacca box: lat [-2, 8], lon [95, 105]
        elif -2.0 <= lat <= 8.0 and 95.0 <= lon <= 105.0:
            return "Strait of Malacca"
        # Suez Canal box: lat [28, 32], lon [30, 35]
        elif 28.0 <= lat <= 32.0 and 30.0 <= lon <= 35.0:
            return "Suez Canal"
        # Cape of Good Hope box: lat [-40, -25], lon [10, 30]
        elif -40.0 <= lat <= -25.0 and 10.0 <= lon <= 30.0:
            return "Cape of Good Hope"
        # Otherwise outside
        return None

# Singleton instances
ais_service = AISService()
