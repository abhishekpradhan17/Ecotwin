# EcoTwin — Working Integrated Project

EcoTwin is a SUMO + TraCI + FastAPI/WebSocket + React/Leaflet dashboard for multi-objective urban traffic and carbon monitoring. It follows the supplied project brief: a 5×5 city grid, live traffic/emission data, RL traffic-light control, WebSocket streaming, carbon heatmap, and live metrics.

## What is integrated

- **SUMO simulation:** 5×5 grid, 25 signalized intersections, 100 m cells, 1 s timestep, 3600 s simulation, seed 42.
- **Traffic demand:** car, bus and truck flows distributed across all five rows and columns, with staggered departures and a steady arrival rate.
- **Observations:** queue length, waiting time, average speed, localized CO₂, current phase, phase elapsed time.
- **Actions:** keep phase / switch phase.
- **Reward:** waiting 0.5, CO₂ 0.3, queue 0.2, normalized.
- **Backend:** FastAPI REST + WebSocket.
- **Frontend:** React + React-Leaflet map, moving vehicles, traffic-light markers, CO₂ heatmap and live metric charts.
- **RL:** optional RLlib/PyTorch PPO checkpoint adapter. If the RL stack/checkpoint is unavailable, the server uses a clearly reported heuristic fallback rather than pretending PPO is active.
- **Demo fallback:** if SUMO is not installed, the backend automatically runs a deterministic 5×5 demo simulation so the complete dashboard still works. The frontend remains empty until it receives simulation data (unless mock mode is explicitly selected).

## Run on Windows

### 1. Backend

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` to check the API.

### 2. Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

### 3. Real SUMO mode

Install SUMO separately and make the `sumo` executable available on PATH, then restart the backend. With `ECOTWIN_MODE=auto`, EcoTwin will automatically use SUMO. If SUMO cannot be started, it falls back to demo mode.

For an explicit live-only run:

```powershell
$env:ECOTWIN_MODE="sumo"
uvicorn backend.main:app --reload --port 8000
```

### 4. PPO inference

The supplied checkpoint is under `training/checkpoint/`. Install the optional RL dependencies:

```powershell
pip install -r backend/requirements-rl.txt
```

Then keep `ECOTWIN_RL=true`. The API reports `rl.status=ACTIVE` and `rl.source=PPO` only if the checkpoint actually loads. Otherwise it reports `FALLBACK` / `heuristic`.

## API

- `GET /health`
- `POST /simulation/start`
- `POST /simulation/reset`
- `POST /simulation/stop`
- `GET /simulation/state`
- `WS /ws/simulation`

## Architecture

```text
SUMO
  │ TraCI
  ▼
Simulation Engine ──► PPO / heuristic controller
  │
  ▼
FastAPI REST + WebSocket
  │
  ▼
React + React-Leaflet
  ├── 5×5 city grid
  ├── traffic-light state
  ├── moving vehicles
  ├── CO₂ heatmap
  └── live metrics
```

## Source integration notes

The project combines the supplied team artifacts rather than discarding them: the 25-intersection SUMO network and React dashboard were used as the base, while the supplied Gymnasium/RLlib environment, PPO checkpoint and API/WebSocket design were integrated into one runnable backend. The provided project brief calls for SUMO, PPO/RLlib, FastAPI/WebSockets and a React map dashboard, with a final goal of an RL agent balancing traffic flow and environmental impact.
