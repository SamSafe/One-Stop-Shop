import { useState } from 'react';
import { defaultEnergy } from './domain';
import type { EnergySettings } from './domain';

export interface EnergyInputs {
  kilometres: string;
  gas: string;
  electricity: string;
  electricShare: string;
  premiumPrice: string;
  dieselPrice: string;
  e85Price: string;
}
const toInputs = (energy: EnergySettings): EnergyInputs => ({
  kilometres: String(energy.kilometres),
  gas: String(energy.fuelPrice),
  electricity: String(energy.electricityPrice),
  electricShare: String(energy.electricFraction * 100),
  premiumPrice: energy.premiumPrice === undefined ? '' : String(energy.premiumPrice),
  dieselPrice: energy.dieselPrice === undefined ? '' : String(energy.dieselPrice),
  e85Price: energy.e85Price === undefined ? '' : String(energy.e85Price),
});
const numeric = (input: string) => (input.trim() === '' ? NaN : Number(input));

export function useEnergySettings(initial = defaultEnergy) {
  const [inputs, setInputs] = useState(() => toInputs(initial));
  const energy: EnergySettings = {
    kilometres: numeric(inputs.kilometres),
    fuelPrice: numeric(inputs.gas),
    electricityPrice: numeric(inputs.electricity),
    electricFraction: numeric(inputs.electricShare) / 100,
    ...Object.fromEntries(
      (['premiumPrice', 'dieselPrice', 'e85Price'] as const)
        .filter((key) => inputs[key].trim() !== '')
        .map((key) => [key, numeric(inputs[key])]),
    ),
  };
  return {
    inputs,
    energy,
    setEnergy: (next: EnergySettings) => setInputs(toInputs(next)),
    onInput: (key: keyof EnergyInputs, value: string) =>
      setInputs((current) => ({ ...current, [key]: value })),
  };
}
