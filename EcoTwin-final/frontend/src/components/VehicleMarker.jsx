import {
  CircleMarker,
  Tooltip,
} from "react-leaflet";


function getVehicleStyle(speed) {
  const currentSpeed =
    Number(speed) || 0;

  if (currentSpeed < 0.1) {
    return {
      color: "#991b1b",
      fillColor: "#ef4444",
    };
  }

  if (currentSpeed < 5) {
    return {
      color: "#a16207",
      fillColor: "#facc15",
    };
  }

  return {
    color: "#166534",
    fillColor: "#22c55e",
  };
}


function VehicleMarker({
  vehicle,
}) {
  const vehicleStyle =
    getVehicleStyle(vehicle.speed);

  const speed =
    Number(vehicle.speed) || 0;

  const status =
    speed < 0.1
      ? "Stopped"
      : speed < 5
        ? "Slow"
        : "Moving";

  return (
    <CircleMarker
      center={[
        vehicle.y,
        vehicle.x,
      ]}
      radius={7}
      pathOptions={{
        color: vehicleStyle.color,
        fillColor: vehicleStyle.fillColor,
        fillOpacity: 1,
        weight: 2,
      }}
    >
   <Tooltip
  direction="top"
  offset={[0, -18]}
  opacity={1}
  sticky={true}
  pane="vehicleTooltips"
  className="vehicle-tooltip"
>
        <div
          style={{
            minWidth: "170px",
            lineHeight: "1.5",
          }}
        >
          <strong>
            {vehicle.vehicle_id}
          </strong>

          <br />

          Position:{" "}
          {vehicle.x}, {vehicle.y} m

          <br />

          Speed:{" "}
          {vehicle.speed} m/s

          <br />

          Type:{" "}
          {vehicle.type}

          <br />

          CO2:{" "}
          {vehicle.co2} mg/s

          <br />

          Status:{" "}
          {status}
        </div>
      </Tooltip>
    </CircleMarker>
  );
}


export default VehicleMarker;