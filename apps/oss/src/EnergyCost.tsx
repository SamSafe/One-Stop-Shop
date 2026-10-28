import type { EnergyEstimate } from './energy';

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });
const quantity = (value: number) => value.toLocaleString('en-CA', { maximumFractionDigits: 2 });

export function EnergyCost({
  estimate,
  compact = false,
}: {
  estimate: EnergyEstimate;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'card-energy-cost' : 'energy-cost-breakdown'}>
      {compact && <span>Estimated energy · CAD /100 km</span>}
      <strong>{estimate.available ? money.format(estimate.total) : 'Not available'}</strong>
      {estimate.available && estimate.fuelPrice && (
        <small className="fuel-price-basis">
          {estimate.fuelPrice.label} · {money.format(estimate.fuelPrice.price)}/L ·{' '}
          {estimate.fuelPrice.basis} price
        </small>
      )}
      {estimate.available ? (
        !compact && (
          <>
            {estimate.usesFuel && (
              <small>
                Fuel: {quantity(estimate.fuelLitres)} L · {money.format(estimate.fuelCost)}
              </small>
            )}
            {estimate.usesElectricity && (
              <small>
                Electricity: {quantity(estimate.electricityKwh)} kWh ·{' '}
                {money.format(estimate.electricityCost)}
              </small>
            )}
          </>
        )
      ) : compact ? (
        <small>{estimate.reasons[0]}</small>
      ) : (
        <ul>
          {estimate.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
