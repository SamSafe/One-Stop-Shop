import { useState } from 'react';
import type { Car } from '@oss/car-catalog';
import type { EnergySettings, Weights } from './domain';
import type { BuyingBrief } from './buying';
import { SourcedFact } from './catalogView';
import { explainFit, fitNumber, requirementDescription, requirementValue } from './fit';

export function FitBreakdown({
  car,
  weights,
  energy,
  brief,
}: {
  car: Car;
  weights: Weights;
  energy: EnergySettings;
  brief?: BuyingBrief | null;
}) {
  const [open, setOpen] = useState(false);
  const fit = open ? explainFit(car, weights, energy, brief) : null;
  const included = fit?.criteria.filter((row) => row.active) ?? [];
  const excluded = fit?.criteria.filter((row) => !row.active) ?? [];
  return (
    <details className="fit-breakdown" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Why this fits</summary>
      {fit && (
        <div className="fit-breakdown-content">
          <p className="fit-breakdown-total">
            <strong>{fit.score === null ? 'Unscored' : `${fit.score} / 100`}</strong> ·{' '}
            {fit.mode === 'brief' ? 'Your buying brief' : 'Filters & priorities'}
          </p>
          {fit.reason && <p className="fit-breakdown-notice">{fit.reason}</p>}
          {fit.mode === 'brief' && (
            <>
              <p className="fit-section-title">Your requirements</p>
              {fit.requirements.length ? (
                <ul className="fit-requirements" aria-label="Requirements">
                  {fit.requirements.map((check) => (
                    <li key={check.key}>
                      <span>
                        <strong>{requirementDescription(check)}</strong>
                        <small>{requirementValue(check)}</small>
                      </span>
                      <span className="fit-status" data-state={check.status}>
                        {check.status === 'met'
                          ? 'Met'
                          : check.status === 'unknown'
                            ? 'Needs checking'
                            : 'Does not meet'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No must-haves set.</p>
              )}
            </>
          )}
          {!!included.length && (
            <>
              <p className="fit-section-title">Score breakdown</p>
              <p>Importance sets each priority’s share of the 100 available points.</p>
              <ul className="fit-criteria" aria-label="Active priorities">
                {included.map((row) => (
                  <li key={row.priority} data-priority={row.priority}>
                    <div className="fit-criterion-heading">
                      <strong>{row.label}</strong>
                      <span>Importance {row.weight} / 5</span>
                    </div>
                    <p className="fit-criterion-value">
                      {row.metric ? (
                        <SourcedFact
                          car={car}
                          metric={row.metric}
                          showNotes={false}
                          showUnknownNotes={false}
                        />
                      ) : typeof row.value === 'number' ? (
                        `$${fitNumber(row.value, 2)} CAD / 100 km`
                      ) : (
                        (row.value ?? 'Not verified')
                      )}
                    </p>
                    <p>{row.target}</p>
                    {row.points !== null ? (
                      <>
                        <div className="fit-points">
                          <strong>
                            {fitNumber(row.points)} of {fitNumber(row.maximumPoints)} points
                          </strong>
                        </div>
                        <span className="fit-points-track" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.max(0, Math.min(100, (row.points / row.maximumPoints) * 100))}%`,
                            }}
                          />
                        </span>
                      </>
                    ) : (
                      <p className="fit-breakdown-notice">
                        {row.missingReason ??
                          'Points are unavailable while this vehicle is unscored.'}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {fit.score !== null && (
                <p className="fit-rounding-note">
                  The total uses unrounded contributions, then rounds to a whole number. Individual
                  point values are rounded here for readability.
                </p>
              )}
            </>
          )}
          {!!excluded.length && (
            <>
              <p className="fit-section-title">Not included in this score</p>
              <ul className="fit-excluded" aria-label="Excluded priorities">
                {excluded.map((row) => (
                  <li key={row.priority}>
                    <strong>{row.label}</strong> · {row.excludedReason}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="fit-rounding-note">
            Your test-drive ratings are shown separately. Published horsepower describes output; use
            your test drives to assess driving enjoyment.
          </p>
        </div>
      )}
    </details>
  );
}
