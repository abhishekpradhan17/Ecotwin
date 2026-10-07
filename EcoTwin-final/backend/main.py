from __future__ import annotations

import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    from .simulation import EcoTwinSimulation
except ImportError:
    from simulation import EcoTwinSimulation

app = FastAPI(title="EcoTwin Traffic & Carbon API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulation = EcoTwinSimulation()


@app.get("/")
def root():
    return {"name": "EcoTwin", "status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "simulation_connected": simulation.connected,
        "mode": simulation.mode,
        "rl": simulation.rl.__dict__,
    }


@app.post("/simulation/start")
def start():
    simulation.start()
    return simulation.snapshot(step=False)


@app.post("/simulation/reset")
def reset():
    return simulation.reset()


@app.post("/simulation/stop")
def stop():
    simulation.stop()
    return {"status": "stopped"}


@app.get("/simulation/state")
def state():
    return simulation.step()


@app.websocket("/ws/simulation")
async def simulation_ws(websocket: WebSocket):
    await websocket.accept()
    try:
        simulation.start()
        while True:
            payload = simulation.step()
            await websocket.send_json(payload)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        try:
            await websocket.send_json({"error": str(exc)})
        except Exception:
            pass
    finally:
        # Do not stop globally: another dashboard client may be connected.
        pass
