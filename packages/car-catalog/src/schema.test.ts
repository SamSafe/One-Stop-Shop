import { describe, expect, it } from 'vitest';
import data from '../data/catalog.json';
import { validateCatalog } from './schema';

describe('catalog quality gates', () => {
  it('validates the release catalog', () => {
    expect(validateCatalog(data, '2026-10-20').cars).toHaveLength(5);
  });
  it('rejects a known fact without a source', () => {
    const copy = structuredClone(data);
    copy.cars[0]!.facts.msrpCad.source = null as unknown as string;
    expect(() => validateCatalog(copy)).toThrow('Known facts require a source');
  });
  it('requires an explanation for unknown data', () => {
    const copy = structuredClone(data);
    copy.cars[0]!.facts.fuelCombinedL100km.value = null as unknown as number;
    Reflect.deleteProperty(copy.cars[0]!.facts.fuelCombinedL100km, 'note');
    expect(() => validateCatalog(copy)).toThrow('Unknown facts require an explanation');
  });
  it('rejects duplicate configurations even with different IDs', () => {
    const copy = structuredClone(data);
    copy.cars.push({ ...copy.cars[0]!, id: 'another-id' });
    expect(() => validateCatalog(copy)).toThrow('Duplicate configuration');
  });
  it('rejects missing and unrelated source references', () => {
    const copy = structuredClone(data);
    copy.cars[0]!.sourceIds.push('nonexistent');
    expect(() => validateCatalog(copy)).toThrow('Unknown source');
    copy.cars[0]!.sourceIds = [];
    expect(() => validateCatalog(copy)).toThrow();
  });
  it('rejects nonmanufacturer and executable source URLs', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://unverified.example/specs',
      'http://www.subaru.com/specs',
    ]) {
      const copy = structuredClone(data);
      copy.sources[0]!.url = url;
      expect(() => validateCatalog(copy)).toThrow('reviewed official');
    }
  });
  it('rejects impossible dimensions and reversed cargo volumes', () => {
    const copy = structuredClone(data);
    copy.cars[0]!.facts.lengthMm.value = -10;
    expect(() => validateCatalog(copy)).toThrow();
    copy.cars[0]!.facts.lengthMm.value = 4500;
    copy.cars[0]!.facts.cargoSeatsDownL.value = 5;
    expect(() => validateCatalog(copy)).toThrow('Cargo volume decreases');
  });
  it('rejects future verification and publication dates', () => {
    expect(() => validateCatalog(data, '2026-10-19')).toThrow('future');
    const copy = structuredClone(data);
    copy.sources[0]!.publishedAt = '2099-01-01';
    expect(() => validateCatalog(copy)).toThrow('Invalid source dates');
  });
  it('rejects schema drift and duplicate source IDs', () => {
    expect(() => validateCatalog({ ...data, unexpected: true })).toThrow();
    expect(() => validateCatalog({ ...data, sources: [...data.sources, data.sources[0]] })).toThrow(
      'Duplicate source',
    );
  });
  it('requires a sourced CAD amount and regional basis for a published all-inclusive price', () => {
    const copy = validateCatalog(structuredClone(data));
    copy.cars[0]!.publishedPrice = {
      value: 57131.88,
      currency: 'CAD',
      basis: 'all-inclusive-before-sales-tax',
      province: 'AB',
      source: copy.cars[0]!.sourceIds[0]!,
      note: 'Published vehicle price and itemized Alberta fees; sales taxes excluded.',
    };
    expect(validateCatalog(copy).cars[0]!.publishedPrice!.value).toBe(57131.88);
    copy.cars[0]!.publishedPrice!.source = 'missing-source';
    expect(() => validateCatalog(copy)).toThrow(/published price/);
    copy.cars[0]!.publishedPrice!.source = copy.cars[0]!.sourceIds[0]!;
    expect(() =>
      validateCatalog({
        ...copy,
        cars: [
          { ...copy.cars[0], publishedPrice: { ...copy.cars[0]!.publishedPrice, currency: 'USD' } },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateCatalog({
        ...copy,
        cars: [{ ...copy.cars[0], publishedPrice: { ...copy.cars[0]!.publishedPrice, value: 0 } }],
      }),
    ).toThrow();
  });
});
