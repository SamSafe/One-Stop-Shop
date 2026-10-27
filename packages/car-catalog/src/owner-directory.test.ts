import { describe, it, expect } from 'vitest';
import data from '../data/owner-directory.json';
import {
  decodeOwnerDirectory,
  unpackOwnerDirectory,
  ownerYears,
  ownerMakes,
  ownerModels,
} from './owner-directory';
import {
  validateOwnerDirectory,
  packOwnerDirectory,
  parseOwnerCsv,
  transmissionLabel,
} from './owner-directory-import';
const directory = validateOwnerDirectory(data);
describe('Canadian owner vehicle directory', () => {
  it('covers older years and lets an owner find the Canadian 2016 Elantra without inventing a trim', () => {
    expect(ownerYears(directory)).toContain(1995);
    expect(ownerYears(directory)).toContain(2016);
    expect(ownerYears(directory)).toContain(2027);
    expect(ownerMakes(directory, 2016)).toContain('Hyundai');
    const elantra = ownerModels(directory, 2016, 'Hyundai').find((m) => m.model === 'Elantra')!;
    expect(
      elantra.choices.some((c) => c.label.startsWith('1.8 L') && c.label.includes('Automatic')),
    ).toBe(true);
    expect(
      elantra.choices.some((c) => c.label.startsWith('1.8 L') && c.label.includes('Manual')),
    ).toBe(true);
    expect(elantra.choices.every((c) => !c.catalogId && !c.label.includes('GL'))).toBe(true);
    expect(elantra.sourceIds).toEqual(['c98b9dc8-b23f-4cd8-8b19-e892da1e4688']);
  });
  it('includes historic electric and plug-in vehicles and only matching years/makes', () => {
    expect(ownerMakes(directory, 2016)).toContain('Tesla');
    expect(ownerModels(directory, 2016, 'Chevrolet').some((m) => m.model.includes('Volt'))).toBe(
      true,
    );
    expect(
      ownerModels(directory, 2016, 'Hyundai').every((m) => m.year === 2016 && m.make === 'Hyundai'),
    ).toBe(true);
  });
  it('packs the complete directory losslessly for a separate deferred download', () => {
    const packet = packOwnerDirectory(directory);
    expect(JSON.stringify(unpackOwnerDirectory(packet)) === JSON.stringify(directory)).toBe(true);
    expect(JSON.stringify(packet).length).toBeLessThan(JSON.stringify(directory).length / 2);
  });
  it('rejects malformed model identities and packet references rather than presenting an empty lookup', () => {
    expect(() => decodeOwnerDirectory({ ...directory, models: [] })).toThrow();
    const packet = packOwnerDirectory(directory);
    packet.rows[0]![1] = packet.strings.length;
    expect(() => unpackOwnerDirectory(packet)).toThrow(/reference/);
  });
  it('rejects missing provenance and duplicate model identities', () => {
    const d = structuredClone(directory);
    d.models[0]!.sourceIds = ['unknown-source'];
    expect(() => validateOwnerDirectory(d)).toThrow(/unknown source/);
    const duplicate = structuredClone(directory);
    duplicate.models.push(duplicate.models[0]!);
    expect(() => validateOwnerDirectory(duplicate)).toThrow(/Duplicate/);
  });
  it('parses quoted source fields and preserves CVT simulated-gear terminology', () => {
    expect(parseOwnerCsv('year,model\r\n2016,"Model, with ""quotes"""\r\n')).toEqual([
      ['year', 'model'],
      ['2016', 'Model, with "quotes"'],
    ]);
    expect(() => parseOwnerCsv('2016,"unclosed')).toThrow(/Unterminated/);
    expect(transmissionLabel('M6')).toBe('Manual (6-speed)');
    expect(transmissionLabel('AV7')).toBe('CVT (7 simulated gears)');
  });
});
