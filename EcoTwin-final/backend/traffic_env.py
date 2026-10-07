"""Gymnasium environment used to train a shared PPO signal policy."""
from __future__ import annotations
import os
from pathlib import Path
import gymnasium as gym
import numpy as np
import traci
from gymnasium import spaces

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "sumo" / "config" / "simulation.sumocfg"

class TrafficEnv(gym.Env):
    metadata = {"render_modes": []}
    def __init__(self, tls_id: str = "J12", max_simulation_time: int = 3600):
        super().__init__()
        self.tls_id = tls_id
        self.max_simulation_time = max_simulation_time
        self.action_space = spaces.Discrete(2)
        self.observation_space = spaces.Box(low=0, high=np.inf, shape=(6,), dtype=np.float32)
        self.waiting_weight, self.co2_weight, self.queue_weight = 0.5, 0.3, 0.2
        self.time = 0.0
        self.throughput = 0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if traci.isLoaded(): traci.close()
        traci.start([os.getenv("SUMO_BINARY", "sumo"), "-c", str(CONFIG), "--seed", "42"])
        traci.simulationStep(); self.time = traci.simulation.getTime(); self.throughput = 0
        return self._obs(), {"throughput": 0}

    def step(self, action):
        action = int(action)
        phase = traci.trafficlight.getPhase(self.tls_id)
        if action == 1:
            phases = traci.trafficlight.getAllProgramLogics(self.tls_id)[0].getPhases()
            if len(phases) > 1:
                traci.trafficlight.setPhase(self.tls_id, (phase + 1) % len(phases))
        traci.simulationStep(); self.time = traci.simulation.getTime()
        self.throughput += traci.simulation.getArrivedNumber()
        obs = self._obs()
        q, w, c = float(obs[0]), float(obs[1]), float(obs[3])
        wp, cp, qp = 0.5*min(w/1000,1), 0.3*min(c/50000,1), 0.2*min(q/25,1)
        reward = -(wp+cp+qp)
        terminated = traci.simulation.getMinExpectedNumber() == 0
        truncated = self.time >= self.max_simulation_time
        info = {"waiting_penalty": wp, "co2_penalty": cp, "queue_penalty": qp, "throughput": self.throughput}
        return obs, float(reward), terminated, truncated, info

    def _obs(self):
        ids = traci.vehicle.getIDList(); speeds=[]; waiting=0.0; queue=0
        for vid in ids:
            s=traci.vehicle.getSpeed(vid); speeds.append(s); waiting += traci.vehicle.getAccumulatedWaitingTime(vid)
            queue += int(s < 0.1)
        avg=sum(speeds)/len(speeds) if speeds else 0.0
        x,y=traci.junction.getPosition(self.tls_id); co2=0.0
        for vid in ids:
            vx,vy=traci.vehicle.getPosition(vid)
            if (vx-x)**2+(vy-y)**2 <= 100**2: co2 += traci.vehicle.getCO2Emission(vid)
        phase=traci.trafficlight.getPhase(self.tls_id); dur=traci.trafficlight.getPhaseDuration(self.tls_id); nxt=traci.trafficlight.getNextSwitch(self.tls_id)
        elapsed=max(0.0,self.time-(nxt-dur))
        return np.asarray([queue,waiting,avg,co2,phase,elapsed],dtype=np.float32)

    def close(self):
        if traci.isLoaded(): traci.close()
