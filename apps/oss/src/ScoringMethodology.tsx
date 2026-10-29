export function ScoringMethodology() {
  return (
    <section id="methodology" className="methodology-section" aria-labelledby="methodology-title">
      <div>
        <h2 id="methodology-title">How scoring works</h2>
        <p>Your priorities determine a score out of 100.</p>
      </div>
      <div className="methodology-content">
        <ol className="score-steps">
          <li>
            <h3>Choose your priorities</h3>
            <p>Set importance from 0 to 5. A zero leaves that priority out of the score.</p>
          </li>
          <li>
            <h3>Check the available facts</h3>
            <p>
              A vehicle needs verified data for every active priority to receive a score. Your
              buying brief also checks requirements before ranking.
            </p>
          </li>
          <li>
            <h3>Compare the trade-offs</h3>
            <p>
              Scores are weighted averages, rounded to a whole number. Equal scores sort by lower
              base MSRP, then vehicle ID. Search and filters keep the same scoring scales.
            </p>
          </li>
        </ol>
        <details className="methodology-details">
          <summary>Default score scales</summary>
          <dl className="score-scales">
            <div>
              <dt>Purchase price</dt>
              <dd>CAD $30,000–$60,000 · lower earns more points</dd>
            </div>
            <div>
              <dt>Energy cost</dt>
              <dd>CAD $0–$24 per 100 km · lower earns more points</dd>
            </div>
            <div>
              <dt>Cargo, seats up</dt>
              <dd>500–1,200 litres · more earns more points</dd>
            </div>
            <div>
              <dt>Rear legroom</dt>
              <dd>850–1,150 mm · more earns more points</dd>
            </div>
          </dl>
          <p>
            Values between the endpoints score proportionally. Values beyond an endpoint receive
            that endpoint's score. Price and energy are enabled initially; cargo and legroom can be
            added under Filters &amp; priorities.
          </p>
        </details>
        <details className="methodology-details">
          <summary>Scoring with a buying brief</summary>
          <p>
            Required price, seating, body style, drivetrain, power and legroom are checked first.
            Vehicles with unverified requirements can be included for checking and remain unscored.
          </p>
          <p>
            Price points measure headroom below your budget: full points at half the budget or less,
            zero at the budget. With no budget, the default price scale applies. Cargo, legroom and
            horsepower earn proportional points up to your targets. Body-style and drivetrain
            preferences receive points for a verified match. Energy keeps the default scale above.
          </p>
          <p>
            Your test-drive ratings appear alongside published facts. Enable Hide vehicles I ruled
            out to apply your latest dated verdict to the results.
          </p>
        </details>
        <details className="methodology-details">
          <summary>Energy estimates and source notes</summary>
          <p>
            Published consumption and your fuel/electricity prices determine energy cost. Plug-in
            hybrids use your electric-mode distance share, including fuel used in that mode. Annual
            distance changes the annual estimate; scoring uses cost per 100 km.
          </p>
          <p>
            Check source notes for cargo measurement methods and engine versus total-system power.
            Use a test drive to compare comfort and handling.
          </p>
        </details>
      </div>
    </section>
  );
}
