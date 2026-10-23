import { describe, expect, it } from 'vitest';
import { catalog } from './index';
import { encodeRuntimeCatalog, decodeRuntimeCatalog } from './runtime';

const packed = encodeRuntimeCatalog(catalog);
describe('complete validated catalog delivery', () => {
  it('preserves every record, numeric fact, unknown qualifier, source and record order', () => {
    const decoded = decodeRuntimeCatalog(packed);
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(catalog));
    expect(decoded.cars).toHaveLength(catalog.cars.length);
    expect(decoded.sources).toHaveLength(catalog.sources.length);
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(catalog).length / 2);
  });
  it('keeps shared facts immutable so changing one profile cannot alter other vehicles', () => {
    const decoded = decodeRuntimeCatalog(packed);
    expect(Object.isFrozen(decoded.cars)).toBe(true);
    const first = decoded.cars[0]!;
    expect(() => {
      first.facts.msrpCad.value = 1;
    }).toThrow(TypeError);
    expect(() => decoded.cars.reverse()).toThrow(TypeError);
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(catalog));
  });
  it('rejects unsupported versions, cycles, forward references and missing table data', () => {
    expect(() => decodeRuntimeCatalog({ ...packed, version: 2 })).toThrow(/could not be loaded/);
    const invalid = structuredClone(packed),
      index = invalid.nodes.findIndex(Array.isArray);
    invalid.nodes[index] = [0, [index]];
    expect(() => decodeRuntimeCatalog(invalid)).toThrow(/could not be loaded/);
    expect(() => decodeRuntimeCatalog({ ...packed, root: -1 })).toThrow(/could not be loaded/);
    expect(() => decodeRuntimeCatalog({ ...packed, nodes: null })).toThrow(/could not be loaded/);
  });
  it('rejects ambiguous or unsafe field layouts and non-catalog roots', () => {
    const unsafe = structuredClone(packed);
    unsafe.shapes[0] = ['__proto__'];
    expect(() => decodeRuntimeCatalog(unsafe)).toThrow(/could not be loaded/);
    const duplicate = structuredClone(packed);
    duplicate.shapes[0] = ['value', 'value'];
    expect(() => decodeRuntimeCatalog(duplicate)).toThrow(/could not be loaded/);
    expect(() => decodeRuntimeCatalog({ version: 1, shapes: [], nodes: [1], root: 0 })).toThrow(
      /could not be loaded/,
    );
  });
});
