function MapLegend() {
  return (
    <div className="map-legend">

      <div className="legend-header">
        <div>
          <h3>Map Legend</h3>

          <p>
            Traffic and environmental simulation indicators
          </p>
        </div>
      </div>


      <div className="legend-items">

        {/* North-South Green */}

        <div className="legend-item">

          <span className="legend-signal ns"></span>

          <div>
            <strong>
              North-South Green
            </strong>

            <span>
              Active traffic phase
            </span>
          </div>

        </div>


        {/* East-West Green */}

        <div className="legend-item">

          <span className="legend-signal ew"></span>

          <div>
            <strong>
              East-West Green
            </strong>

            <span>
              Active traffic phase
            </span>
          </div>

        </div>


        {/* Yellow Transition */}

        <div className="legend-item">

          <span
            className="legend-signal yellow"
          ></span>

          <div>
            <strong>
              Yellow Transition
            </strong>

            <span>
              Traffic phase change
            </span>
          </div>

        </div>


        {/* Stopped Vehicle */}

        <div className="legend-item">

          <span
            className="legend-vehicle stopped"
          ></span>

          <div>
            <strong>
              Stopped Vehicle
            </strong>

            <span>
              Speed &lt; 0.1 m/s
            </span>
          </div>

        </div>


        {/* Slow Vehicle */}

        <div className="legend-item">

          <span
            className="legend-vehicle slow"
          ></span>

          <div>
            <strong>
              Slow Vehicle
            </strong>

            <span>
              Speed 0.1–5 m/s
            </span>
          </div>

        </div>


        {/* Moving Vehicle */}

        <div className="legend-item">

          <span
            className="legend-vehicle moving"
          ></span>

          <div>
            <strong>
              Moving Vehicle
            </strong>

            <span>
              Speed ≥ 5 m/s
            </span>
          </div>

        </div>


        {/* Road Network */}

        <div className="legend-item">

          <span className="legend-road"></span>

          <div>
            <strong>
              Road Network
            </strong>

            <span>
              100 m simulation grid
            </span>
          </div>

        </div>


        {/* CO2 */}

        <div className="legend-item">

          <span className="legend-environment"></span>

          <div>
            <strong>
              CO₂ / Environmental Zone
            </strong>

            <span>
              Emission intensity
            </span>
          </div>

        </div>

      </div>

    </div>
  );
}

export default MapLegend;
