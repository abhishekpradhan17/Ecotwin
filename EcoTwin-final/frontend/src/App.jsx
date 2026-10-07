import CityMap from "./components/CityMap";
import MapLegend from "./components/MapLegend";
import useSimulation from "./hooks/useSimulation";

function fmtTime(seconds) {
  const s = Math.floor(seconds || 0);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(v => String(v).padStart(2, "0")).join(":");
}

function Metric({ label, value, unit }) {
  return <div className="stat-card"><div><span className="stat-label">{label}</span><strong>{value}</strong><small>{unit}</small></div></div>;
}

function MiniChart({ title, values, field, suffix = "" }) {
  const width = 700, height = 170, pad = 22;
  const points = values.length ? values : [{ [field]: 0 }];
  const max = Math.max(...points.map(v => Number(v[field]) || 0), 1);
  const coords = points.map((v, i) => {
    const x = pad + (i / Math.max(points.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((Number(v[field]) || 0) / max) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return <div className="chart-card"><div className="chart-title"><strong>{title}</strong><span>max {max.toFixed(0)}{suffix}</span></div><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><polyline fill="none" stroke="currentColor" strokeWidth="3" points={coords}/></svg></div>;
}

export default function App() {
  const { intersections, vehicles, heatmapData, simulationTime, connectionStatus, streamHealthy, lastUpdateTime, metrics, rl, history, mode } = useSimulation();
  const statusText = connectionStatus === "connected" ? "Simulation Connected" : connectionStatus === "connecting" ? "Connecting" : connectionStatus === "error" ? "Connection Error" : "Simulation Offline";
  return <div className="app">
    <header className="topbar"><div className="brand"><div className="brand-icon">E</div><div><h1>EcoTwin</h1><p>Reinforcement Learning for Urban Carbon Dispersal</p></div></div><div className="live-status"><span className={`status-dot ${connectionStatus === "connected" ? "connected" : ""}`}/>{statusText}</div></header>
    <main className="dashboard">
      <section className="hero"><div><span className="eyebrow">CITY SIMULATION</span><h2>Intelligent Traffic & <span>Environmental Optimization</span></h2><p>SUMO traffic simulation, PPO control, live vehicle telemetry, traffic-light state and carbon concentration on a 5 × 5 city grid.</p></div><div className="hero-badge"><strong>5 × 5</strong><span>25 intersections</span></div></section>
      <section className="stats-grid">
        <Metric label="SIMULATION TIME" value={fmtTime(simulationTime)} unit="HH : MM : SS" />
        <Metric label="ACTIVE VEHICLES" value={metrics.vehicleCount} unit="live vehicles" />
        <Metric label="AVG SPEED" value={metrics.avgSpeed.toFixed(2)} unit="m/s" />
        <Metric label="TOTAL QUEUE" value={metrics.queue} unit="waiting vehicles" />
        <Metric label="TOTAL CO₂" value={metrics.co2.toFixed(0)} unit="mg/s" />
        <Metric label="WAITING TIME" value={metrics.waiting.toFixed(0)} unit="vehicle-seconds" />
        <Metric label="THROUGHPUT" value={metrics.throughput} unit="arrived vehicles" />
        <Metric label="RL REWARD" value={Number(rl.reward || 0).toFixed(3)} unit={`${rl.algorithm || "PPO"} · ${rl.status || "STANDBY"}`} />
      </section>
      <section className="simulation-card"><div className="section-heading"><div><h3>Live City Simulation</h3><p className="section-subtitle">Mode: <b>{mode}</b> · RL source: <b>{rl.source || "environment"}</b></p></div><div className="simulation-chip"><span className="status-dot"/> {streamHealthy ? "LIVE DATA STREAM" : "WAITING FOR DATA"}</div></div><div className="map-wrapper"><CityMap intersections={intersections} vehicles={vehicles} heatmapData={heatmapData}/></div><MapLegend/></section>
      <section className="charts-grid"><MiniChart title="CO₂ Emissions" values={history} field="co2" suffix=" mg/s"/><MiniChart title="Total Waiting Time" values={history} field="waiting" suffix=" s"/><MiniChart title="Queue Length" values={history} field="queue" suffix=" vehicles"/></section>
      <section className="simulation-monitor"><div className="monitor-header"><div><h3>Simulation Stream Monitor</h3><p className="section-subtitle">Last update: {lastUpdateTime ? new Date(lastUpdateTime).toLocaleTimeString() : "waiting"}</p></div></div><div className="monitor-grid"><div className="monitor-item"><span>CONNECTION</span><strong>{connectionStatus.toUpperCase()}</strong></div><div className="monitor-item"><span>INTERSECTIONS</span><strong>{intersections.length} / 25</strong></div><div className="monitor-item"><span>RL CONTROL</span><strong>{rl.status || "STANDBY"}</strong></div><div className="monitor-item"><span>ACTIVE ACTION</span><strong>{rl.current_action == null ? "—" : rl.current_action === 1 ? "SWITCH" : "KEEP"}</strong></div></div></section>
    </main>
  </div>;
}
