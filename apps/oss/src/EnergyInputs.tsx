import { useEffect, useId, useRef } from 'react';
import type { EnergyInputs as Inputs } from './useEnergySettings';
import type { Car } from '@oss/car-catalog';
import { energyInputsUsed, fuelTypeForPricing } from './energy';
import type { FuelPriceKey } from './energy';

const fields: {
  key: Exclude<keyof Inputs, FuelPriceKey>;
  label: string;
  min: number;
  max: number;
  step: string;
  error: string;
}[] = [
  {
    key: 'kilometres',
    label: 'Annual kilometres',
    min: 0,
    max: 200000,
    step: '100',
    error: 'Enter annual kilometres from 0 to 200,000.',
  },
  {
    key: 'gas',
    label: 'Gas price / fuel price · CAD / litre',
    min: 0.01,
    max: 5,
    step: '0.01',
    error: 'Enter a fuel price from $0.01 to $5 per litre.',
  },
  {
    key: 'electricity',
    label: 'Electricity · CAD / kWh',
    min: 0,
    max: 2,
    step: '0.01',
    error: 'Enter an electricity price from $0 to $2 per kWh.',
  },
  {
    key: 'electricShare',
    label: 'Plug-in electric-mode driving · %',
    min: 0,
    max: 100,
    step: '1',
    error: 'Enter an electric-mode share from 0% to 100%.',
  },
];
const fuelFields: { key: FuelPriceKey; label: string }[] = [
  { key: 'premiumPrice', label: 'Premium gasoline' },
  { key: 'dieselPrice', label: 'Diesel' },
  { key: 'e85Price', label: 'E85' },
];

export function EnergyInputs({
  inputs,
  onInput,
  ranking = false,
  vehicles,
}: {
  inputs: Inputs;
  onInput: (key: keyof Inputs, value: string) => void;
  ranking?: boolean;
  vehicles?: Car[];
}) {
  const id = useId();
  const fuelOptions = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (fuelFields.some((field) => inputs[field.key].trim() !== '') && fuelOptions.current)
      fuelOptions.current.open = true;
  }, [inputs.premiumPrice, inputs.dieselPrice, inputs.e85Price]);
  const fraction = inputs.electricShare.trim() ? Number(inputs.electricShare) / 100 : NaN;
  return (
    <fieldset className="fuel-calculator">
      <legend>Make energy costs yours</legend>
      {fields.map((field) => {
        const value = inputs[field.key];
        const used =
          !vehicles?.length ||
          field.key === 'kilometres' ||
          vehicles.some((car) => {
            const use = energyInputsUsed(car, fraction);
            if (field.key === 'gas') {
              const override = fuelTypeForPricing(car).key;
              return use.fuel && (!override || inputs[override].trim() === '');
            }
            return use[field.key === 'electricShare' ? 'share' : 'electricity'];
          });
        const invalid =
          used &&
          (!value.trim() ||
            !Number.isFinite(Number(value)) ||
            Number(value) < field.min ||
            Number(value) > field.max);
        return (
          <div className="energy-field" key={field.key}>
            <label htmlFor={`${id}-${field.key}-input`}>
              {ranking
                ? {
                    kilometres: 'Annual distance for ranking · km',
                    gas: 'Fuel unit price for ranking · CAD / litre',
                    electricity: 'Electric unit price for ranking · CAD / kWh',
                    electricShare: 'Electric driving share for ranking · %',
                  }[field.key]
                : field.label}
            </label>
            <input
              id={`${id}-${field.key}-input`}
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              inputMode={field.step === '0.01' ? 'decimal' : 'numeric'}
              value={value}
              disabled={!used}
              onChange={(event) => onInput(field.key, event.target.value)}
              aria-invalid={invalid}
              aria-describedby={`${id}-${field.key} ${id}-note`}
            />
            <small id={`${id}-${field.key}`}>
              {!used ? 'Not used by the selected vehicles.' : invalid ? field.error : ''}
            </small>
          </div>
        );
      })}
      <details ref={fuelOptions} className="fuel-price-options">
        <summary>Fuel-specific prices</summary>
        <p id={`${id}-fuel-options-note`}>
          Leave blank to use the shared fuel price. Specific prices apply where the catalog verifies
          that fuel type; other vehicles use the shared price.
        </p>
        <div className="fuel-price-fields">
          {fuelFields.map((field) => {
            const value = inputs[field.key];
            const used =
              !vehicles?.length ||
              vehicles.some(
                (car) =>
                  energyInputsUsed(car, fraction).fuel && fuelTypeForPricing(car).key === field.key,
              );
            const invalid =
              used &&
              value.trim() !== '' &&
              (!Number.isFinite(Number(value)) || Number(value) < 0.01 || Number(value) > 5);
            return (
              <div className="energy-field" key={field.key}>
                <label htmlFor={`${id}-${field.key}-input`}>
                  {field.label}
                  {ranking ? ' price for ranking' : ''} · CAD / litre
                </label>
                <input
                  id={`${id}-${field.key}-input`}
                  type="number"
                  min="0.01"
                  max="5"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Shared price"
                  value={value}
                  disabled={!used}
                  onChange={(event) => onInput(field.key, event.target.value)}
                  aria-invalid={invalid}
                  aria-describedby={`${id}-${field.key} ${id}-fuel-options-note`}
                />
                <small id={`${id}-${field.key}`}>
                  {!used
                    ? 'Not used by the selected vehicles.'
                    : invalid
                      ? `Enter a ${field.label.toLowerCase()} price from $0.01 to $5 per litre.`
                      : ''}
                </small>
              </div>
            );
          })}
        </div>
      </details>
      <p id={`${id}-note`}>
        Estimates use published consumption and your energy prices. Plug-in hybrids use your
        electric-mode distance share, including any fuel burned in that mode. The default 50% share
        is an assumption. Fuel-specific prices are optional; blank fields share the main fuel price.
        Use your actual energy prices and charging rate. Charging session fees, maintenance,
        insurance and depreciation are excluded. Energy assumptions are included in comparison
        links. Annual distance changes the estimate; efficiency scores use cost per 100 km.
      </p>
    </fieldset>
  );
}
