import { describe, expect, it } from 'vitest';
import snapshot from '../data/nrcan.json';
import { searchParameters, validateNrcanSnapshot } from './nrcan-schema';

describe('Canadian government baseline import', () => {
  it('reconciles every captured record against the public search totals', () => {
    const data = validateNrcanSnapshot(snapshot);
    expect(data.records.length).toBe(
      Object.values(data.totals).reduce((sum, count) => sum + count, 0),
    );
    for (const year of data.modelYears)
      expect(data.records.some((record) => record.Year === year)).toBe(true);
    for (const type of ['ICE', 'BEV', 'PHEV'] as const)
      expect(data.totals[type]).toBeGreaterThan(0);
  });
  it('rejects dropped pages or rows instead of reporting a complete import', () => {
    const missingRow = structuredClone(snapshot);
    missingRow.records.pop();
    expect(() => validateNrcanSnapshot(missingRow)).toThrow('Incomplete NRCan');
    const missingPage = structuredClone(snapshot);
    missingPage.responses = missingPage.responses.filter(
      (page) => page.vehicleType !== 'BEV' || page.page !== 2,
    );
    expect(() => validateNrcanSnapshot(missingPage)).toThrow('response receipts');
  });
  it('rejects duplicate records and records outside the requested model years', () => {
    const duplicate = structuredClone(snapshot);
    duplicate.records.push(duplicate.records[0]!);
    expect(() => validateNrcanSnapshot(duplicate)).toThrow('Duplicate NRCan');
    const wrongYear = structuredClone(snapshot);
    wrongYear.records[0]!.Year = 1999;
    expect(() => validateNrcanSnapshot(wrongYear)).toThrow('Unexpected model year');
  });
  it('never requests personalized costs or nonmetric ratings', () => {
    const query = searchParameters([2025, 2026, 2027], 'BEV', 3);
    expect(query.get('SelectedModelYears')).toBe('2025,2026,2027');
    expect(query.get('VehicleType')).toBe('BEV');
    expect(query.get('Units')).toBe('Metric');
    expect(query.get('UsePersonalizeValues')).toBe('false');
    expect(query.get('PageIndexBev')).toBe('3');
  });
});
