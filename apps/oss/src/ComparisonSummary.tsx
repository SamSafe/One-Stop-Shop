import type { Car } from '@oss/car-catalog';
import type { SummaryMetric } from './domain';
import { fullName, configurationLabel, specificationDifference } from './domain';

const money = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });
const summaries: { metric: SummaryMetric; label: string; unit: string }[] = [
  { metric: 'msrpCad', label: 'Base price', unit: 'CAD' },
  { metric: 'seats', label: 'Seating', unit: 'seats' },
  { metric: 'cargoSeatsUpL', label: 'Cargo, seats up', unit: 'L' },
  { metric: 'rearLegroomMm', label: 'Rear legroom', unit: 'mm' },
];
function describe(reference: Car, other: Car, metric: SummaryMetric, unit: string) {
  const change = specificationDifference(reference, other, metric);
  const format = (n: number) =>
    metric === 'msrpCad' ? money.format(n) : `${number.format(n)} ${unit}`;
  if (change.kind === 'unknown') return change.reason;
  if (change.kind === 'context')
    return change.referenceValue === change.value
      ? `Both publish ${format(change.value!)}; ${change.reason.toLowerCase()}`
      : change.reason;
  if (change.kind === 'same') return `Same published figure (${format(change.value!)})`;
  return `${format(Math.abs(change.delta))} ${change.delta > 0 ? 'more' : metric === 'seats' ? 'fewer' : 'less'}`;
}
export function ComparisonSummary({
  selected,
  energyCost,
  referenceId,
  onReferenceChange,
}: {
  selected: Car[];
  energyCost: (car: Car) => number | null;
  referenceId: string;
  onReferenceChange: (id: string) => void;
}) {
  const reference = selected.find((car) => car.id === referenceId) ?? selected[0];
  if (!reference || selected.length < 2) return null;
  const referenceEnergy = energyCost(reference);
  return (
    <section className="comparison-summary" aria-labelledby="comparison-summary-title">
      <div className="comparison-summary-heading">
        <div>
          <h3 id="comparison-summary-title">Key differences</h3>
          <p>Published differences relative to your reference vehicle.</p>
        </div>
        <label>
          Reference vehicle
          <select
            aria-label="Reference vehicle"
            value={reference.id}
            onChange={(event) => onReferenceChange(event.target.value)}
          >
            {selected.map((car) => (
              <option key={car.id} value={car.id}>
                {fullName(car)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="comparison-summary-vehicles">
        {selected
          .filter((car) => car.id !== reference.id)
          .map((car) => {
            const cost = energyCost(car);
            const energyDelta =
              referenceEnergy === null || cost === null
                ? null
                : Math.round(cost) - Math.round(referenceEnergy);
            return (
              <article
                className="comparison-summary-vehicle"
                key={car.id}
                aria-label={`Differences for ${fullName(car)}`}
              >
                <h4>
                  {car.make} {car.model}
                </h4>
                <p>
                  {car.year ?? 'Year unverified'} · {configurationLabel(car)}
                </p>
                <dl>
                  {summaries.map(({ metric, label, unit }) => (
                    <div key={metric}>
                      <dt>{label}</dt>
                      <dd>{describe(reference, car, metric, unit)}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Energy estimate</dt>
                    <dd>
                      {energyDelta === null
                        ? 'Not available for both vehicles at these inputs'
                        : energyDelta === 0
                          ? 'Same estimated annual energy cost'
                          : `${money.format(Math.abs(energyDelta))}/year ${energyDelta > 0 ? 'more' : 'less'} at the current assumptions`}
                    </dd>
                  </div>
                </dl>
              </article>
            );
          })}
      </div>
      <p className="comparison-summary-note">
        Equipment, reliability and real-world comfort are not established by these figures.
        Measurement context and unverified values remain explicit; full specifications and sources
        follow.
      </p>
    </section>
  );
}
