import {
  CircleMarker,
  Tooltip,
} from "react-leaflet";

function IntersectionMarker({
  intersection,
}) {
  const phaseType =
    intersection.phase_type || "green";

  const phaseDirection =
    intersection.phase_direction || "unknown";

  let markerColor = "#2563eb";
  let markerFill = "#3b82f6";

  if (phaseType === "green") {
    markerColor = "#16a34a";
    markerFill = "#22c55e";
  }

  if (phaseType === "yellow") {
    markerColor = "#d97706";
    markerFill = "#f59e0b";
  }

  let phaseLabel = "Unknown";

  if (phaseType === "green") {
    if (phaseDirection === "north_south") {
      phaseLabel = "North-South Green";
    } else if (phaseDirection === "east_west") {
      phaseLabel = "East-West Green";
    } else {
      phaseLabel = "Green";
    }
  } else if (phaseType === "yellow") {
    phaseLabel = "Yellow Transition";
  }

  return (
    <CircleMarker
      center={[
        intersection.y,
        intersection.x,
      ]}
      radius={10}
      pathOptions={{
        color: markerColor,
        fillColor: markerFill,
        fillOpacity: 1,
        weight: 2,
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -10]}
        opacity={1}
        className="intersection-tooltip"
      >
        <div className="intersection-tooltip-content">

          <div className="tooltip-title">
            {intersection.id}
          </div>

          <div className="tooltip-section">
            <div className="tooltip-heading">
              Coordinates
            </div>

            <div>
              X: {intersection.x} m
            </div>

            <div>
              Y: {intersection.y} m
            </div>
          </div>

          <div className="tooltip-section">
            <div className="tooltip-heading">
              Traffic Phase
            </div>

            <div>
              Phase: {intersection.current_phase}
            </div>

            <div>
              Type: {phaseType}
            </div>

            <div>
              {phaseLabel}
            </div>

            <div>
              Duration: {intersection.phase_duration} s
            </div>

            <div>
              Elapsed: {intersection.phase_elapsed_time} s
            </div>
          </div>

          <div className="tooltip-section">
            <div className="tooltip-heading">
              Simulation Data
            </div>

            <div>
              Queue: {intersection.queue_length}
            </div>

            <div>
              Waiting: {intersection.waiting_time} s
            </div>

            <div>
              Speed: {intersection.average_speed} m/s
            </div>

            <div>
              CO₂: {intersection.co2_emission}
            </div>
          </div>

        </div>
      </Tooltip>
    </CircleMarker>
  );
}

export default IntersectionMarker;