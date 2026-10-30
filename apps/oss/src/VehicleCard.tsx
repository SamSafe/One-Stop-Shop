import { useState } from 'react';
import { catalog, metricDefinitions, ratingUrl } from '@oss/car-catalog';
import type { Car } from '@oss/car-catalog';
import { scoreCar, fullName, modelYearLabel } from './domain';
import type { TestDriveReview } from './buying';
import { TestDriveSummary } from './TestDriveJournal';
import type { Weights, EnergySettings } from './domain';
import { estimateEnergy } from './energy';
import { EnergyCost } from './EnergyCost';
import { FitBreakdown } from './FitBreakdown';
import {
  Icon,
  SourcedFact,
  PublishedPrice,
  currency,
  publishedCurrency,
  metricKeys,
} from './catalogView';
export function Card({
  car,
  index,
  weights,
  energy,
  selected,
  saved,
  atLimit,
  onCompare,
  onSave,
  unchecked,
  review,
  onTestDrive,
}: {
  car: Car;
  index: number;
  weights: Weights;
  energy: EnergySettings;
  selected: boolean;
  saved: boolean;
  atLimit: boolean;
  onCompare: () => void;
  onSave: () => void;
  // Filter limits this vehicle passes only because the figure is unverified.
  unchecked: string[];
  review: TestDriveReview | undefined;
  onTestDrive: () => void;
}) {
  const ranking = scoreCar(car, weights, energy);
  const [expanded, setExpanded] = useState(false);
  return (
    <article
      className={`car-card ${selected ? 'is-selected' : ''}`}
      aria-labelledby={`title-${car.id}`}
    >
      <div className="card-top">
        <span className="card-index">{String(index + 1).padStart(2, '0')}</span>
        <span className={`fuel-tag ${car.fuel === 'Hybrid' ? 'hybrid' : ''}`}>
          {car.fuel} {car.drivetrain !== 'Not verified' && `· ${car.drivetrain}`}
        </span>
        <button
          type="button"
          className={`icon-button save-button ${saved ? 'is-saved' : ''}`}
          aria-label={`Save ${fullName(car)} to shortlist`}
          aria-pressed={saved}
          onClick={onSave}
        >
          <Icon name="save" />
        </button>
      </div>
      <div className="card-content">
        <div className="vehicle-description">
          <p className="car-make">
            {modelYearLabel(car)} {car.make}
          </p>
          <h3 id={`title-${car.id}`}>{car.model}</h3>
          <p className="car-trim">
            {car.recordKind === 'government-rating'
              ? `${car.governmentRating?.engineLitres ? `${car.governmentRating.engineLitres} L · ` : ''}${car.governmentRating?.transmission}`
              : `${car.trim} · ${car.drivetrain}`}
            {car.variant && ` · ${car.variant}`}
          </p>
          <p className="record-status">
            {car.recordKind === 'government-rating'
              ? 'NRCan rating · retail trim not checked'
              : car.recordKind === 'manufacturer-offer'
                ? 'Manufacturer offer · model year unverified'
                : 'Retail configuration'}
            {car.availability.status === 'manufacturer-listed' && ' · manufacturer-listed'}
            {car.availability.status === 'not-checked' && ' · current availability not checked'}
            {car.availability.status === 'announced' &&
              ' · coming-soon source flag · availability needs review'}
            {car.availability.status === 'discontinued' && ' · manufacturer discontinued'}
          </p>
          {car.modelYearNote && <p className="record-status">{car.modelYearNote}</p>}
        </div>
        <div className="price-row">
          <div>
            <strong>
              {car.facts.msrpCad.value === null
                ? 'Not verified'
                : currency.format(car.facts.msrpCad.value)}
            </strong>
            <span>base MSRP · CAD</span>
          </div>
          <div className="fit-score">
            <strong>
              {ranking.score === null ? '—' : ranking.score}
              <span>/100</span>
            </strong>
            <span>fit score</span>
          </div>
        </div>
        {car.publishedPrice && (
          <p className="published-price">
            <strong>{publishedCurrency.format(car.publishedPrice.value)}</strong> all-inclusive ·{' '}
            {car.publishedPrice.province} · before sales tax
          </p>
        )}
        <dl className="quick-specs">
          <div>
            <dt>
              {car.fuel === 'Hydrogen'
                ? 'Energy use'
                : car.fuel === 'Electric' || car.fuel === 'Plug-in hybrid'
                  ? 'Electric mode'
                  : 'Combined fuel'}
            </dt>
            <dd>
              {car.fuel === 'Hydrogen' ? (
                'Not supported'
              ) : car.fuel === 'Electric' || car.fuel === 'Plug-in hybrid' ? (
                <>
                  <QuickValue value={car.facts.electricCombinedKwh100km.value} unit="kWh/100 km" />
                </>
              ) : (
                <>
                  <QuickValue value={car.facts.fuelCombinedL100km.value} unit="L/100 km" />
                </>
              )}
            </dd>
          </div>
          <div>
            <dt>Cargo, seats up</dt>
            <dd>
              <QuickValue value={car.facts.cargoSeatsUpL.value} unit="L" />
            </dd>
          </div>
          <div>
            <dt>Rear legroom</dt>
            <dd>
              <QuickValue value={car.facts.rearLegroomMm.value} unit="mm" />
            </dd>
          </div>
        </dl>

        <EnergyCost estimate={estimateEnergy(car, energy)} compact />
        {unchecked.length > 0 && (
          <div className="unchecked-limits">
            <strong>Check before buying</strong>
            <p>Your {unchecked.join(', ')} limit could not be verified for this vehicle.</p>
          </div>
        )}
        <div className="card-test-drive">
          {review && (
            <p>
              <TestDriveSummary review={review} />
            </p>
          )}
          <button
            type="button"
            className="text-button"
            onClick={onTestDrive}
            aria-label={`Test-drive notes for ${fullName(car)}`}
          >
            Test-drive notes{review ? ' · saved' : ''}
          </button>
        </div>

        <FitBreakdown car={car} weights={weights} energy={energy} />
        <div className="card-actions">
          <label className={`compare-checkbox ${atLimit && !selected ? 'is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={selected}
              disabled={atLimit && !selected}
              onChange={onCompare}
              aria-label={`Compare ${fullName(car)}`}
            />
            <span>Compare</span>
          </label>
          <button
            type="button"
            className="text-button"
            aria-expanded={expanded}
            aria-controls={`specs-${car.id}`}
            onClick={() => setExpanded(!expanded)}
          >
            Specs & sources <span aria-hidden="true">{expanded ? '−' : '+'}</span>
          </button>
        </div>
        {expanded && (
          <div id={`specs-${car.id}`} className="expanded-specs">
            <h4>Published specifications</h4>
            {car.manufacturerConfiguration && (
              <p>
                Manufacturer code: {car.manufacturerConfiguration.code}.{' '}
                {car.manufacturerConfiguration.transmission}.{' '}
                {car.manufacturerConfiguration.specificationsUrl && (
                  <a
                    href={car.manufacturerConfiguration.specificationsUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manufacturer specifications ↗
                  </a>
                )}
              </p>
            )}
            {car.governmentRating && (
              <p>
                NRCan class: {car.governmentRating.vehicleClass}. Fuel:{' '}
                {car.governmentRating.fuelType}.{' '}
                <a href={ratingUrl(car.governmentRating.recordId)} target="_blank" rel="noreferrer">
                  Exact NRCan vehicle report ↗
                </a>
              </p>
            )}
            <p>{car.availability.note}</p>
            <dl>
              {car.publishedPrice && (
                <div>
                  <dt>Published all-inclusive price</dt>
                  <dd>
                    <PublishedPrice car={car} />
                  </dd>
                </div>
              )}
              {metricKeys.map((metric) => (
                <div key={metric}>
                  <dt>{metricDefinitions[metric].label}</dt>
                  <dd>
                    <SourcedFact metric={metric} car={car} />
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Review dates appear on each linked source. Cargo measurement methods can differ.
              Published width may use different mirror conventions. {catalog.pricingNote}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

const quickNumber = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 1 });
// Unknown figures say so, as they do everywhere else, rather than showing a bare dash.
function QuickValue({ value, unit }: { value: number | null; unit: string }) {
  return value === null ? (
    <span className="quick-unknown">Not verified</span>
  ) : (
    <>
      {quickNumber.format(value)} <small>{unit}</small>
    </>
  );
}
