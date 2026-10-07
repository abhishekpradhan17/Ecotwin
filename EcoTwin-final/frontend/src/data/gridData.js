// EcoTwin - City Grid & Simulation Configuration

const GRID_ROWS = 5;
const GRID_COLUMNS = 5;
const CELL_SIZE_METERS = 100;


export const gridConfig = {
  rows: GRID_ROWS,
  columns: GRID_COLUMNS,
  cellSizeMeters: CELL_SIZE_METERS,
  intersectionCount: GRID_ROWS * GRID_COLUMNS,
  coordinateSystem: "x_y",
  distanceUnit: "meters",
};


export const simulationConfig = {
  timestepSeconds: 1,
  durationSeconds: 3600,
  seed: 42,
};


export const vehicleConfig = {
  types: [
    "car",
    "bus",
    "truck",
  ],

  maxSpeedMps: 13.9,

  vehicleIdFormat: "veh_{id:04d}",
};


export const roadConfig = {
  roadIdFormat: "road_{id:04d}",

  lanesPerDirection: 1,

  speedLimitMps: 13.9,
};


export const trafficLightConfig = {
  idFormat: "tls_{id:04d}",

  phases: {
    phase0: {
      type: "green",
    },

    phase1: {
      type: "yellow",
    },

    phase2: {
      type: "green",
    },

    phase3: {
      type: "yellow",
    },
  },

  minGreenSeconds: 10,
  maxGreenSeconds: 60,
  yellowSeconds: 3,
};


export const observationVariables = [
  "queue_length",
  "waiting_time",
  "average_speed",
  "co2_emission",
  "current_phase",
  "phase_elapsed_time",
];


export const actionConfig = {
  type: "discrete",

  values: [
    "keep_phase",
    "switch_phase",
  ],
};


export const intersections = [];


for (
  let row = 0;
  row < GRID_ROWS;
  row++
) {

  for (
    let column = 0;
    column < GRID_COLUMNS;
    column++
  ) {

    const index =
      row * GRID_COLUMNS + column;

    intersections.push({

      id:
        `tls_${String(index).padStart(4, "0")}`,

      row,

      column,

      x:
        column * CELL_SIZE_METERS,

      y:
        row * CELL_SIZE_METERS,

      current_phase: 0,

      phase_type: "unknown",

      phase_direction: "unknown",

      phase_duration: 0,

      phase_elapsed_time: 0,

      queue_length: 0,

      waiting_time: 0,

      average_speed: 0,

      co2_emission: 0,
    });
  }
}