const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const WS_URL = import.meta.env.VITE_WEBSOCKET_URL || "ws://localhost:8000/ws/simulation";

export const SIMULATION_MODE = import.meta.env.VITE_ECOTWIN_MODE || "live";
export const getSimulationMode = () => SIMULATION_MODE;

export async function startSimulation() {
  const res = await fetch(`${API_BASE_URL}/simulation/start`, { method: "POST" });
  if (!res.ok) throw new Error(`Start failed: ${res.status}`);
  return res.json();
}

export async function resetSimulation() {
  const res = await fetch(`${API_BASE_URL}/simulation/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`Reset failed: ${res.status}`);
  return res.json();
}

export function connectSimulationSocket({ onMessage, onOpen, onError, onClose }) {
  const socket = new WebSocket(WS_URL);
  socket.onopen = onOpen;
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.error) throw new Error(data.error);
      onMessage(data);
    } catch (error) {
      onError?.(error);
    }
  };
  socket.onerror = onError;
  socket.onclose = onClose;
  return socket;
}

export function disconnectSimulationSocket(socket) {
  if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) {
    socket.close();
  }
}
