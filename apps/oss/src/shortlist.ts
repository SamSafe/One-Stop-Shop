import type { Car } from '@oss/car-catalog';

export const shortlistFileLimit = 2_000_000;
const maximumEntries = 20000;

export function shortlistBackup(ids: string[]) {
  return JSON.stringify({ version: 1, ids }, null, 2);
}

export function readShortlistBackup(raw: string, cars: Pick<Car, 'id'>[]) {
  if (new TextEncoder().encode(raw).byteLength > shortlistFileLimit)
    throw new Error('Choose a shortlist JSON backup smaller than 2 MB.');
  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    throw new Error('That file is not valid shortlist JSON.');
  }
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => key !== 'version' && key !== 'ids') ||
    !('version' in input) ||
    input.version !== 1 ||
    !('ids' in input) ||
    !Array.isArray(input.ids) ||
    input.ids.length > maximumEntries ||
    input.ids.some((id) => typeof id !== 'string' || !id.trim() || id.length > 256)
  )
    throw new Error('This file is not a supported version 1 shortlist backup.');
  const ids = [...new Set(input.ids as string[])];
  const known = new Set(cars.map((car) => car.id));
  return {
    recognized: ids.filter((id) => known.has(id)),
    unavailable: ids.filter((id) => !known.has(id)),
  };
}

export type ShortlistImport = ReturnType<typeof readShortlistBackup>;
