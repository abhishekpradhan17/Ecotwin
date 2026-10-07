import { useEffect, useMemo, useState } from "react";
import { intersections as initialIntersections } from "../data/gridData";
import { connectSimulationSocket, disconnectSimulationSocket, getSimulationMode } from "../services/simulationService";

function mockPayload(time) {
  const vehicles = Array.from({ length: 32 }, (_, i) => {
    const lane = i % 10;
    const t = (time * (4 + (i % 3)) + i * 37) % 400;
    const vertical = lane >= 5;
    const roadIndex = vertical ? lane - 5 : lane;
    const x = vertical ? roadIndex * 100 : t;
    const y = vertical ? t : roadIndex * 100;
    const speed = 4 + 5 * (0.5 + 0.5 * Math.sin((time + i) / 8));
    return {
      vehicle_id: `demo_${String(i).padStart(4, "0")}`,
      x: Number(x.toFixed(1)), y: Number(y.toFixed(1)),
      speed: Number(speed.toFixed(2)), type: i % 3 === 0 ? "bus" : i % 5 === 0 ? "truck" : "car",
      co2: Number((60 + (13.9 - speed) * 35).toFixed(1)), waiting_time: Number(Math.max(0, 5 - speed).toFixed(1)),
    };
  });
  const traffic_lights = initialIntersections.map((_, i) => {
    const phase = Math.floor(time / 33) % 2 === 0 ? 0 : 2;
    const local = vehicles.filter(v => (v.x - (i % 5) * 100) ** 2 + (v.y - Math.floor(i / 5) * 100) ** 2 < 10000);
    return {
      id: `J${i}`, x: (i % 5) * 100, y: Math.floor(i / 5) * 100,
      current_phase: phase, phase_type: "green", phase_direction: phase === 0 ? "north_south" : "east_west",
      phase_duration: 30, phase_elapsed_time: time % 33,
      queue_length: local.filter(v => v.speed < 4).length,
      waiting_time: local.reduce((s, v) => s + v.waiting_time, 0),
      average_speed: local.length ? local.reduce((s, v) => s + v.speed, 0) / local.length : 0,
      co2_emission: local.reduce((s, v) => s + v.co2, 0),
    };
  });
  return { simulation_time: time, mode: "mock", vehicles, traffic_lights, metrics: {}, rl: { enabled: false, algorithm: "PPO", status: "DEMO", source: "mock", reward: 0 } };
}

function normalize(data) {
  const vehicles = Array.isArray(data.vehicles) ? data.vehicles.map(v => ({
    vehicle_id: v.vehicle_id ?? v.id ?? "unknown",
    x: Number(v.x ?? v.position?.x ?? 0), y: Number(v.y ?? v.position?.y ?? 0),
    speed: Number(v.speed ?? 0), type: v.type ?? "car", co2: Number(v.co2 ?? v.co2_emission ?? 0),
    waiting_time: Number(v.waiting_time ?? 0),
  })) : [];
  const lights = Array.isArray(data.traffic_lights) ? data.traffic_lights : [];
  const intersections = initialIntersections.map(base => {
    const index = Number(base.id.slice(-4));
    const light = lights.find(l => l.id === `J${index}`) || lights.find(l => Number(String(l.id).replace(/\D/g, "")) === index);
    if (!light) return base;
    return { ...base, ...light, id: base.id };
  });
  const heatmapData = vehicles.filter(v => Number.isFinite(v.x) && Number.isFinite(v.y) && v.co2 > 0).map(v => ({ vehicle_id: v.vehicle_id, x: v.x, y: v.y, co2: v.co2 }));
  const metrics = data.metrics || {};
  return {
    intersections, vehicles, heatmapData,
    simulationTime: Number(data.simulation_time) || 0,
    metrics: {
      vehicleCount: Number(metrics.vehicle_count ?? vehicles.length),
      avgSpeed: Number(metrics.average_speed ?? (vehicles.length ? vehicles.reduce((s,v)=>s+v.speed,0)/vehicles.length : 0)),
      queue: Number(metrics.queue_length ?? intersections.reduce((s,i)=>s+(Number(i.queue_length)||0),0)),
      co2: Number(metrics.total_co2 ?? vehicles.reduce((s,v)=>s+v.co2,0)),
      waiting: Number(metrics.total_waiting_time ?? vehicles.reduce((s,v)=>s+v.waiting_time,0)),
      throughput: Number(metrics.throughput ?? 0),
    },
    rl: data.rl || { enabled: false, algorithm: "PPO", status: "STANDBY", source: "environment", reward: 0 },
    mode: data.mode || "live",
  };
}

function emptyState() {
  return normalize({
    simulation_time: 0,
    mode: "offline",
    vehicles: [],
    traffic_lights: [],
    metrics: {},
  });
}

export default function useSimulation() {
  const [state, setState] = useState(emptyState);
  const [status, setStatus] = useState("connecting");
  const [lastUpdate, setLastUpdate] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (getSimulationMode() === "mock") {
      setStatus("connected");
      let t = 0;
      const tick = () => {
        const next = normalize(mockPayload(t++));
        setState(next); setLastUpdate(new Date());
        setHistory(h => [...h.slice(-29), { time: next.simulationTime, co2: next.metrics.co2, waiting: next.metrics.waiting, queue: next.metrics.queue }]);
      };
      tick(); const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
    let socket;
    let reconnect;
    const connect = () => {
      setStatus("connecting");
      socket = connectSimulationSocket({
        onOpen: () => setStatus("connected"),
        onMessage: data => {
          const next = normalize(data);
          setState(next); setLastUpdate(new Date());
          setHistory(h => [...h.slice(-29), { time: next.simulationTime, co2: next.metrics.co2, waiting: next.metrics.waiting, queue: next.metrics.queue }]);
        },
        onError: () => setStatus("error"),
        onClose: () => {
          setStatus("offline");
          setState(emptyState());
          setLastUpdate(null);
          setHistory([]);
          reconnect = setTimeout(connect, 2000);
        },
      });
    };
    connect();
    return () => { clearTimeout(reconnect); disconnectSimulationSocket(socket); };
  }, []);

  const streamHealthy = status === "connected" && !!lastUpdate;
  return useMemo(() => ({ ...state, connectionStatus: status, streamHealthy, lastUpdateTime: lastUpdate, history }), [state, status, streamHealthy, lastUpdate, history]);
}
