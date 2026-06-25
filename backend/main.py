import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from ais_client import stream_manager
from choke_points import CHOKE_POINTS

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("Main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the AIS client background task
    logger.info("Starting up FastAPI application...")
    await stream_manager.start()
    yield
    # Shutdown: Stop the AIS client background task
    logger.info("Shutting down FastAPI application...")
    await stream_manager.stop()

app = FastAPI(
    title="Energy Supply Chain Resilience API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In development, allow all. Change for production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Energy Supply Chain Resilience API"}

@app.get("/api/chokepoints")
def get_chokepoints():
    """Returns the configuration of all maritime choke points."""
    return CHOKE_POINTS

@app.websocket("/ws/ais")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("Frontend WebSocket client connected.")
    
    # Create an asyncio queue for this connection
    queue = asyncio.Queue(maxsize=1000)
    stream_manager.register_queue(queue)

    try:
        # Keep sending messages from the queue to the client
        while True:
            # We use wait_for to check if client is still alive
            try:
                # Retrieve from queue and send
                ship_data = await asyncio.wait_for(queue.get(), timeout=1.0)
                await websocket.send_json(ship_data)
                queue.task_done()
            except asyncio.TimeoutError:
                # Just loop and check if connection is still active
                # We send a ping or just let uvicorn handle it
                pass
    except WebSocketDisconnect:
        logger.info("Frontend WebSocket client disconnected.")
    except Exception as e:
        logger.error(f"Error in websocket loop: {e}", exc_info=True)
    finally:
        stream_manager.unregister_queue(queue)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
