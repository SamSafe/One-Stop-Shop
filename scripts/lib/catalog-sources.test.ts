import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changedFields, freshness, importers, liveArgs } from './catalog-sources.ts';

describe('importer registry', () => {
  it('covers every sync and capture script with an existing snapshot', () => {
    const registered = new Set(
      importers.flatMap((importer) => importer.steps.map((s) => s.script)),
    );
    const scripts = readdirSync('scripts')
      .filter((file) => /^(sync|capture)-/.test(file))
      .map((file) => `scripts/${file}`);
    expect(scripts.filter((script) => !registered.has(script))).toEqual([]);
    for (const importer of importers) {
      expect(existsSync(importer.snapshot), importer.snapshot).toBe(true);
      for (const step of importer.steps) expect(existsSync(step.script), step.script).toBe(true);
    }
  });

  it('marks replayable importers only where the sync step supports --offline', () => {
    for (const importer of importers) {
      const sync = readFileSync(importer.steps.at(-1)!.script, 'utf8');
      expect(sync.includes("'--offline'"), importer.name).toBe(importer.replay);
    }
  });

  it('passes the tracked NRCan model years to a live run', () => {
    const nrcan = importers.find((importer) => importer.name === 'nrcan')!;
    expect(liveArgs(nrcan, nrcan.steps[0]!, { modelYears: [2025, 2026, 2027] })).toEqual([
      '2025',
      '2026',
      '2027',
    ]);
  });
});

describe('freshness', () => {
  const now = new Date('2026-10-29T12:00:00Z');

  it('ages snapshots from retrievedAt or reviewedAt', () => {
    expect(freshness({ retrievedAt: '2026-10-20T12:00:00Z' }, now, 45)).toEqual({
      date: '2026-10-20T12:00:00Z',
      ageDays: 9,
      stale: false,
    });
    expect(freshness({ reviewedAt: '2026-08-01' }, now, 45).stale).toBe(true);
  });

  it('treats an undated snapshot as stale', () => {
    expect(freshness({ retrievedAt: 'soon' }, now, 45)).toEqual({
      date: null,
      ageDays: null,
      stale: true,
    });
  });
});

describe('changedFields', () => {
  it('ignores capture metadata', () => {
    expect(
      changedFields(
        { retrievedAt: 'a', source: { url: 'u', sha256: '1' }, records: [{ price: 1 }] },
        { retrievedAt: 'b', source: { url: 'u', sha256: '2' }, records: [{ price: 1 }] },
      ),
    ).toEqual({ count: 0, paths: [] });
  });

  it('reports changed values by path and array entries as additions and removals', () => {
    expect(
      changedFields(
        { total: 1, records: [{ price: 1, trim: 'A' }], extra: true },
        { total: 2, records: [{ price: 2, trim: 'A' }, { price: 3 }] },
      ),
    ).toEqual({ count: 5, paths: ['total', 'records (+2/−1)', 'extra'] });
  });

  it('does not report reordered or shifted array entries', () => {
    expect(
      changedFields(
        { records: [{ id: 'b', sha256: '1' }, { id: 'c' }] },
        { records: [{ id: 'a' }, { id: 'c' }, { id: 'b', sha256: '2' }] },
      ),
    ).toEqual({ count: 1, paths: ['records (+1/−0)'] });
  });
});
