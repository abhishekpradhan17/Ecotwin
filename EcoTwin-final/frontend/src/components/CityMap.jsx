import {
  MapContainer,
  Polyline,
  Circle,
  Pane,
  useMap,
} from "react-leaflet";

import { CRS } from "leaflet";
import "leaflet/dist/leaflet.css";

import { gridConfig } from "../data/gridData";
import IntersectionMarker from "./IntersectionMarker";
import VehicleMarker from "./VehicleMarker";


// ==================================================
// FIT CITY BOUNDS
// ==================================================

function FitCityBounds({ cityWidth, cityHeight }) {
  const map = useMap();

  const bounds = [
    [-100, -100],
    [cityHeight + 100, cityWidth + 100],
  ];

  map.fitBounds(bounds, {
    padding: [30, 30],
  });

  return null;
}


// ==================================================
// OLD INTERSECTION CO2 STYLE
// ==================================================

function getEnvironmentalStyle(co2Emission) {
  const value = Number(co2Emission) || 0;

  if (value <= 0) {
    return {
      radius: 0,
      opacity: 0,
    };
  }

  const intensity = Math.min(value / 100, 1);

  return {
    radius: 25 + intensity * 45,
    opacity: 0.12 + intensity * 0.28,
  };
}


// ==================================================
// LIVE VEHICLE CO2 HEATMAP STYLE
// ==================================================

function getHeatmapStyle(co2) {
  const value = Number(co2) || 0;

  if (value <= 0) {
    return {
      radius: 0,
      opacity: 0,
    };
  }

  /*
    SUMO CO2 values can be much larger than 100.

    We use a logarithmic scale so that:
    - low emissions remain visible
    - high emissions create stronger hotspots
    - one large value does not hide all other vehicles
  */

  const intensity =
    Math.min(
      Math.log10(value + 1) / 4,
      1
    );

  return {
    radius:
      18 + intensity * 42,

    opacity:
      0.15 + intensity * 0.35,
  };
}


// ==================================================
// CITY MAP
// ==================================================

function CityMap({
  intersections: simulationIntersections = [],
  vehicles = [],

  // Week 3:
  // live vehicle emission points
  heatmapData = [],
}) {

  const {
    rows,
    columns,
    cellSizeMeters,
  } = gridConfig;


  const cityWidth =
    (columns - 1) * cellSizeMeters;


  const cityHeight =
    (rows - 1) * cellSizeMeters;


  const mapPadding = 100;


  const roads = [];


  // ==================================================
  // HORIZONTAL ROADS
  // ==================================================

  for (
    let row = 0;
    row < rows;
    row++
  ) {

    const y =
      row * cellSizeMeters;


    roads.push(
      <Polyline
        key={`horizontal-road-${row}`}
        positions={[
          [y, 0],
          [y, cityWidth],
        ]}
        pathOptions={{
          weight: 7,
          color: "#344a44",
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    );
  }


  // ==================================================
  // VERTICAL ROADS
  // ==================================================

  for (
    let column = 0;
    column < columns;
    column++
  ) {

    const x =
      column * cellSizeMeters;


    roads.push(
      <Polyline
        key={`vertical-road-${column}`}
        positions={[
          [0, x],
          [cityHeight, x],
        ]}
        pathOptions={{
          weight: 7,
          color: "#344a44",
          opacity: 0.9,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    );
  }


  // ==================================================
  // MAP
  // ==================================================

  return (
    <MapContainer
      crs={CRS.Simple}

      center={[
        cityHeight / 2,
        cityWidth / 2,
      ]}

      zoom={1}

      minZoom={0}

      maxZoom={3}

      maxBounds={[
        [-mapPadding, -mapPadding],
        [
          cityHeight + mapPadding,
          cityWidth + mapPadding,
        ],
      ]}

      maxBoundsViscosity={1.0}

      style={{
        width: "100%",
        height: "620px",
        background: "#e8eef0",
      }}
    >

      {/* ==========================================
          VEHICLE TOOLTIP PANE
      ========================================== */}

      <Pane
        name="vehicleTooltips"
        style={{
          zIndex: 1000,
        }}
      />


      {/* ==========================================
          FIT CITY BOUNDS
      ========================================== */}

      <FitCityBounds
        cityWidth={cityWidth}
        cityHeight={cityHeight}
      />


      {/* ==========================================
          ROAD NETWORK
      ========================================== */}

      {roads}


      {/* ==========================================
          OLD INTERSECTION CO2 OVERLAY
      ========================================== */}

      {simulationIntersections.map(
        (intersection) => {

          const environmentalStyle =
            getEnvironmentalStyle(
              intersection.co2_emission
            );


          if (
            environmentalStyle.radius === 0
          ) {
            return null;
          }


          return (
            <Circle
              key={`co2-${intersection.id}`}

              center={[
                intersection.y,
                intersection.x,
              ]}

              radius={
                environmentalStyle.radius
              }

              pathOptions={{
                color: "#dc6b32",

                fillColor:
                  "#ef8a45",

                fillOpacity:
                  environmentalStyle.opacity,

                weight: 1,

                opacity: 0.35,
              }}
            />
          );
        }
      )}


      {/* ==========================================
          WEEK 3 LIVE CARBON HEATMAP
          ==========================================

          Data flow:

          SUMO
             ↓
          vehicle x/y/co2
             ↓
          WebSocket
             ↓
          useSimulation
             ↓
          heatmapData
             ↓
          this layer
      ========================================== */}

      <Pane
        name="carbonHeatmap"
        style={{
          zIndex: 500,
        }}
      >

        {heatmapData.map(
          (point, index) => {

            const x =
              Number(point.x);

            const y =
              Number(point.y);

            const co2 =
              Number(point.co2);


            if (
              !Number.isFinite(x) ||
              !Number.isFinite(y) ||
              !Number.isFinite(co2) ||
              co2 <= 0
            ) {
              return null;
            }


            const heatmapStyle =
              getHeatmapStyle(co2);


            if (
              heatmapStyle.radius === 0
            ) {
              return null;
            }


            return (
              <Circle

                key={
                  `heatmap-${point.vehicle_id || index}`
                }

                center={[
                  y,
                  x,
                ]}

                radius={
                  heatmapStyle.radius
                }

                pathOptions={{

                  color:
                    "#d94b3d",

                  fillColor:
                    "#ff7043",

                  fillOpacity:
                    heatmapStyle.opacity,

                  weight: 1,

                  opacity: 0.25,
                }}

              />
            );
          }
        )}

      </Pane>


      {/* ==========================================
          TRAFFIC LIGHT / INTERSECTION LAYER
      ========================================== */}

      <Pane
        name="intersections"
        style={{
          zIndex: 650,
        }}
      >

        {simulationIntersections.map(
          (intersection) => (

            <IntersectionMarker
              key={intersection.id}
              intersection={intersection}
            />

          )
        )}

      </Pane>


      {/* ==========================================
          MOVING VEHICLE LAYER
      ========================================== */}

      <Pane
        name="vehicles"
        style={{
          zIndex: 600,
        }}
      >

        {vehicles.map(
          (vehicle) => (

            <VehicleMarker
              key={vehicle.vehicle_id}
              vehicle={vehicle}
            />

          )
        )}

      </Pane>

    </MapContainer>
  );
}


export default CityMap;