"""EcoTwin simulation engine.

Uses SUMO/TraCI when available and falls back to a deterministic demo simulator
so the dashboard remains runnable without a local SUMO installation.
"""
from __future__ import annotations

import math
import os
import random
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import traci
except Exception:  # pragma: no cover - optional until live mode is used
    traci = None


ROOT = Path(__file__).resolve().parents[1]
SUMO_CONFIG = ROOT / "sumo" / "config" / "simulation.sumocfg"


@dataclass
class RLState:
    enabled: bool = False
    algorithm: str = "PPO"
    current_action: int | None = None
    reward: float = 0.0
    waiting_penalty: float = 0.0
    co2_penalty: float = 0.0
    queue_penalty: float = 0.0
    status: str = "STANDBY"
    source: str = "heuristic"


class PPOController:
    """Optional RLlib PPO inference adapter.

    The supplied checkpoint is loaded only when Ray/PyTorch are installed. The
    controller is deliberately optional so the SUMO dashboard can still run in
    a clean environment.
    """

    def __init__(self, checkpoint: Path):
        self.module = None
        self.available = False
        self.error = None
        if not checkpoint.exists():
            self.error = "PPO checkpoint not found"
            return
        try:
            import numpy as np
            import torch
            import ray
            from ray.rllib.core.rl_module.rl_module import RLModule

            ray.init(ignore_reinit_error=True, include_dashboard=False)
            self.module = RLModule.from_checkpoint(str(checkpoint))
            self.torch = torch
            self.np = np
            self.available = True
        except Exception as exc:  # pragma: no cover - depends on local RL stack
            self.error = str(exc)

    def action(self, observation: list[float]) -> int:
        if not self.available:
            return 0
        obs = self.torch.from_numpy(
            self.np.asarray(observation, dtype=self.np.float32)
        ).unsqueeze(0)
        output = self.module.forward_inference({"obs": obs})
        if "actions" in output:
            return int(output["actions"][0].item())
        if "action_dist_inputs" in output:
            return int(self.torch.argmax(output["action_dist_inputs"], dim=-1).item())
        return 0


class DemoSimulator:
    """Deterministic 5x5 grid used when SUMO is unavailable."""

    GRID_SIZE = 5
    CELL_SIZE = 100

    def __init__(self):
        self.time = 0
        self.random = random.Random(42)
        self.vehicles = []
        self.routes = self._build_routes()
        self._seed_vehicles()

    @classmethod
    def _build_routes(cls):
        horizontal = []
        for row in range(cls.GRID_SIZE):
            columns = range(cls.GRID_SIZE)
            if row % 2:
                columns = reversed(columns)
            horizontal.extend(
                (column * cls.CELL_SIZE, row * cls.CELL_SIZE)
                for column in columns
            )

        vertical = []
        for column in range(cls.GRID_SIZE):
            rows = range(cls.GRID_SIZE)
            if column % 2:
                rows = reversed(rows)
            vertical.extend(
                (column * cls.CELL_SIZE, row * cls.CELL_SIZE)
                for row in rows
            )

        return [
            points + points[-2::-1]
            for points in (horizontal, vertical)
        ]

    @classmethod
    def _route_length(cls, route):
        return (len(route) - 1) * cls.CELL_SIZE

    @classmethod
    def _position_at(cls, route, offset):
        remaining = offset % cls._route_length(route)
        for start, end in zip(route, route[1:]):
            segment_length = math.hypot(end[0] - start[0], end[1] - start[1])
            if remaining <= segment_length:
                fraction = remaining / segment_length
                return (
                    start[0] + (end[0] - start[0]) * fraction,
                    start[1] + (end[1] - start[1]) * fraction,
                )
            remaining -= segment_length
        return route[0]

    def _seed_vehicles(self):
        types = ["car", "bus", "truck"]
        for i in range(48):
            route_index = i % len(self.routes)
            direction = 1 if (i // len(self.routes)) % 2 == 0 else -1
            self.vehicles.append({
                "vehicle_id": f"veh_{i:04d}",
                "type": types[i % 3],
                "route_index": route_index,
                "direction": direction,
                "offset": (i * 37) % self._route_length(self.routes[route_index]),
            })

    def step(self):
        self.time += 1
        vehicles = []
        for v in self.vehicles:
            route = self.routes[v["route_index"]]
            route_length = self._route_length(route)
            speed = 3.5 + 5.5 * (
                0.5 + 0.5 * math.sin((self.time + v["offset"]) / 20)
            )
            distance_to_intersection = v["offset"] % self.CELL_SIZE
            if min(
                distance_to_intersection,
                self.CELL_SIZE - distance_to_intersection,
            ) < 12:
                speed *= 0.35
            v["offset"] = (
                v["offset"] + v["direction"] * speed
            ) % route_length
            x, y = self._position_at(route, v["offset"])
            co2 = 55 + (13.9 - speed) * 32 + (18 if v["type"] == "truck" else 8 if v["type"] == "bus" else 0)
            vehicles.append({
                "vehicle_id": v["vehicle_id"],
                "x": round(x, 2),
                "y": round(y, 2),
                "speed": round(speed, 2),
                "type": v["type"],
                "co2": round(max(co2, 20), 2),
                "waiting_time": round(max(0, 5 - speed) * 0.8, 2),
            })
        return vehicles


class EcoTwinSimulation:
    def __init__(self):
        self.lock = threading.RLock()
        self.mode = os.getenv("ECOTWIN_MODE", "auto").lower()
        self.connected = False
        self.time = 0.0
        self.throughput = 0
        self.last_vehicles: list[dict[str, Any]] = []
        self.phase_started: dict[str, float] = {}
        self.demo = DemoSimulator()
        self.rl = RLState()
        self.ppo = None
        self.switch_cooldown: dict[str, float] = {}

    @property
    def live_available(self) -> bool:
        return traci is not None and os.getenv("SUMO_BINARY", "sumo") is not None

    def start(self):
        with self.lock:
            if self.connected:
                return
            use_live = self.mode in {"auto", "sumo", "live"}
            if use_live and traci is not None:
                try:
                    binary = os.getenv("SUMO_BINARY", "sumo")
                    traci.start([binary, "-c", str(SUMO_CONFIG), "--seed", "42"])
                    self.connected = True
                    self.mode = "sumo"
                    self.time = 0.0
                    self.throughput = 0
                    self._load_ppo()
                    return
                except Exception:
                    if self.mode in {"sumo", "live"}:
                        raise
            self.connected = True
            self.mode = "demo"
            self.time = 0.0
            self.throughput = 0
            self.rl = RLState(enabled=False, status="DEMO", source="demo")

    def _load_ppo(self):
        enabled = os.getenv("ECOTWIN_RL", "true").lower() not in {"0", "false", "no"}
        if not enabled:
            self.rl = RLState(enabled=False, status="DISABLED", source="environment")
            return
        checkpoint = ROOT / "training" / "checkpoint" / "learner_group" / "learner" / "rl_module" / "default_policy"
        self.ppo = PPOController(checkpoint)
        if self.ppo.available:
            self.rl = RLState(enabled=True, status="ACTIVE", source="PPO")
        else:
            self.rl = RLState(enabled=False, status="FALLBACK", source="heuristic")

    def stop(self):
        with self.lock:
            if self.mode == "sumo" and traci is not None:
                try:
                    if traci.isLoaded():
                        traci.close()
                except Exception:
                    pass
            self.connected = False
            self.phase_started.clear()
            self.switch_cooldown.clear()

    def reset(self):
        self.stop()
        self.demo = DemoSimulator()
        self.start()
        return self.snapshot(step=False)

    def step(self):
        with self.lock:
            if not self.connected:
                self.start()
            if self.mode == "sumo":
                return self._step_sumo()
            return self._step_demo()

    def snapshot(self, step: bool = True):
        return self.step() if step else self._build_payload(self.last_vehicles, [])

    def _step_demo(self):
        self.time = float(self.demo.time + 1)
        vehicles = self.demo.step()
        self.last_vehicles = vehicles
        lights = []
        for idx in range(25):
            x = (idx % 5) * 100
            y = (idx // 5) * 100
            phase_block = int(self.time // 33) % 2
            phase = phase_block * 2
            elapsed = self.time % 33
            local = [v for v in vehicles if (v["x"]-x) ** 2 + (v["y"]-y) ** 2 <= 100 ** 2]
            queue = sum(v["speed"] < 2 for v in local)
            waiting = sum(v["waiting_time"] for v in local)
            co2 = sum(v["co2"] for v in local)
            avg = sum(v["speed"] for v in local) / len(local) if local else 0
            lights.append(self._light_payload(f"J{idx}", x, y, phase, elapsed, 30 if phase in (0,2) else 3, queue, waiting, avg, co2))
        self.rl.current_action = None
        self.rl.reward = round(-(sum(l["queue_length"] for l in lights) * .2 + sum(l["waiting_time"] for l in lights) * .02 + sum(l["co2_emission"] for l in lights) * .001), 3)
        return self._build_payload(vehicles, lights)

    def _step_sumo(self):
        try:
            traci.simulationStep()
        except Exception:
            self.connected = False
            raise
        self.time = float(traci.simulation.getTime())
        self.throughput += int(traci.simulation.getArrivedNumber())
        vehicles = []
        for vid in traci.vehicle.getIDList():
            x, y = traci.vehicle.getPosition(vid)
            speed = float(traci.vehicle.getSpeed(vid))
            co2 = float(traci.vehicle.getCO2Emission(vid))
            vehicles.append({
                "vehicle_id": vid,
                "x": round(float(x), 2),
                "y": round(float(y), 2),
                "speed": round(speed, 2),
                "type": traci.vehicle.getTypeID(vid),
                "co2": round(co2, 2),
                "waiting_time": round(float(traci.vehicle.getWaitingTime(vid)), 2),
                "road_id": traci.vehicle.getRoadID(vid),
                "lane_id": traci.vehicle.getLaneID(vid),
            })
        self.last_vehicles = vehicles

        lights = []
        for tls_id in traci.trafficlight.getIDList():
            try:
                x, y = traci.junction.getPosition(tls_id)
            except Exception:
                x, y = 0.0, 0.0
            phase = int(traci.trafficlight.getPhase(tls_id))
            duration = float(traci.trafficlight.getPhaseDuration(tls_id))
            next_switch = float(traci.trafficlight.getNextSwitch(tls_id))
            elapsed = max(0.0, self.time - (next_switch - duration))
            local = [v for v in vehicles if (v["x"]-x) ** 2 + (v["y"]-y) ** 2 <= 100 ** 2]
            queue = sum(v["speed"] < 0.1 for v in local)
            waiting = sum(v["waiting_time"] for v in local)
            co2 = sum(v["co2"] for v in local)
            avg = sum(v["speed"] for v in local) / len(local) if local else 0.0
            lights.append(self._light_payload(tls_id, x, y, phase, elapsed, duration, queue, waiting, avg, co2))

        self._apply_controller(lights)
        return self._build_payload(vehicles, lights)

    def _apply_controller(self, lights):
        total_reward = 0.0
        action_count = 0
        for light in lights:
            tls_id = light["id"]
            observation = [
                light["queue_length"], light["waiting_time"], light["average_speed"],
                light["co2_emission"], light["current_phase"], light["phase_elapsed_time"]
            ]
            action = self.ppo.action(observation) if self.ppo and self.ppo.available else self._heuristic_action(light)
            self.rl.current_action = action
            if action == 1 and light["phase_elapsed_time"] >= 10 and self.switch_cooldown.get(tls_id, -999) + 10 <= self.time:
                try:
                    phases = traci.trafficlight.getAllProgramLogics(tls_id)[0].getPhases()
                    if len(phases) > 1 and light["phase_type"] != "yellow":
                        next_phase = (light["current_phase"] + 1) % len(phases)
                        traci.trafficlight.setPhase(tls_id, next_phase)
                        self.switch_cooldown[tls_id] = self.time
                        action_count += 1
                except Exception:
                    pass
            total_reward += -(0.5 * min(light["waiting_time"] / 1000, 1) + 0.3 * min(light["co2_emission"] / 50000, 1) + 0.2 * min(light["queue_length"] / 25, 1))
        self.rl.reward = round(total_reward / max(len(lights), 1), 4)
        self.rl.status = "ACTIVE" if self.ppo and self.ppo.available else "FALLBACK"
        self.rl.source = "PPO" if self.ppo and self.ppo.available else "heuristic"

    @staticmethod
    def _heuristic_action(light):
        if light["phase_type"] == "yellow":
            return 0
        if light["phase_elapsed_time"] >= 30 and (light["queue_length"] >= 3 or light["co2_emission"] >= 500):
            return 1
        return 0

    @staticmethod
    def _light_payload(tls_id, x, y, phase, elapsed, duration, queue, waiting, avg, co2):
        phase_type = "yellow" if phase % 2 == 1 else "green"
        direction = "north_south" if phase % 4 == 0 else "east_west" if phase % 4 == 2 else "transition"
        return {
            "id": tls_id,
            "x": round(float(x), 2),
            "y": round(float(y), 2),
            "current_phase": int(phase),
            "phase_type": phase_type,
            "phase_direction": direction,
            "phase_duration": round(float(duration), 2),
            "phase_elapsed_time": round(float(elapsed), 2),
            "queue_length": int(queue),
            "waiting_time": round(float(waiting), 2),
            "average_speed": round(float(avg), 2),
            "co2_emission": round(float(co2), 2),
        }

    def _build_payload(self, vehicles, lights):
        total_co2 = sum(v["co2"] for v in vehicles)
        total_wait = sum(v["waiting_time"] for v in vehicles)
        avg_speed = sum(v["speed"] for v in vehicles) / len(vehicles) if vehicles else 0
        queue = sum(l["queue_length"] for l in lights)
        return {
            "simulation_time": round(self.time, 2),
            "simulation_status": "running" if self.connected else "offline",
            "mode": self.mode,
            "vehicles": vehicles,
            "traffic_lights": lights,
            "metrics": {
                "vehicle_count": len(vehicles),
                "total_waiting_time": round(total_wait, 2),
                "avg_waiting_time": round(total_wait / len(vehicles), 2) if vehicles else 0,
                "average_speed": round(avg_speed, 2),
                "queue_length": queue,
                "total_co2": round(total_co2, 2),
                "throughput": self.throughput,
                "rl_reward": self.rl.reward,
            },
            "rl": self.rl.__dict__.copy(),
        }
