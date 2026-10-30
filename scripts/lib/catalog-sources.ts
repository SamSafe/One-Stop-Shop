// Registry of every source importer and the snapshot it maintains. The health
// check reads this to report snapshot age, replay offline reconstructions and
// run live imports in an isolated sandbox.

export type ImporterStep = { script: string; args?: string[] };

export type Importer = {
  name: string;
  snapshot: string;
  steps: ImporterStep[];
  // The sync step accepts --offline and reconstructs the tracked snapshot from
  // checksum-verified local captures without writing it.
  replay: boolean;
  // A capture step drives a real browser and needs Playwright's Chromium.
  browser?: boolean;
  // Why the importer cannot run unattended against live sources, if it cannot.
  manualRefresh?: string;
};

const manufacturers = 'packages/car-catalog/data/manufacturers';

function sync(name: string, replay = true): Importer {
  return {
    name,
    snapshot: `${manufacturers}/${name}.json`,
    steps: [{ script: `scripts/sync-${name}.ts` }],
    replay,
  };
}

function captured(name: string, capture: string): Importer {
  return {
    ...sync(name),
    steps: [{ script: `scripts/${capture}.mjs` }, { script: `scripts/sync-${name}.ts` }],
    browser: true,
  };
}

// Order matters for live runs: Subaru specifications join the Subaru lineup.
export const importers: Importer[] = [
  {
    name: 'nrcan',
    snapshot: 'packages/car-catalog/data/nrcan.json',
    steps: [{ script: 'scripts/sync-nrcan.ts' }],
    replay: false,
  },
  sync('aston-martin'),
  captured('bmw', 'capture-bmw-stock'),
  sync('ford'),
  sync('genesis'),
  {
    ...sync('gm'),
    manualRefresh:
      'GM imports only reviewed capture manifests; see docs/GM-CONFIGURATOR.md and scripts/retry-gm-calculations.ts.',
  },
  sync('honda'),
  sync('hyundai'),
  sync('kia'),
  {
    ...sync('landrover'),
    manualRefresh:
      'Land Rover imports only reviewed builder captures; see docs/LAND-ROVER-SOURCES.md.',
  },
  sync('lucid'),
  sync('mazda'),
  captured('mclaren', 'capture-mclaren'),
  sync('mercedes'),
  sync('mercedes-vans'),
  captured('mini', 'capture-mini-stock'),
  sync('mitsubishi'),
  sync('nissan'),
  sync('polestar'),
  sync('porsche'),
  sync('rivian'),
  sync('subaru', false),
  sync('subaru-specifications', false),
  sync('tci'),
  sync('vinfast'),
  sync('volkswagen'),
  {
    name: 'owner-directory',
    snapshot: 'packages/car-catalog/data/owner-directory.json',
    steps: [
      { script: 'scripts/capture-owner-directory.mjs' },
      { script: 'scripts/sync-owner-directory.ts' },
    ],
    replay: true,
  },
];

// NRCan imports the model years named on its command line; reuse the tracked
// snapshot's years so a live run compares like with like.
export function liveArgs(importer: Importer, step: ImporterStep, snapshot: unknown): string[] {
  if (importer.name === 'nrcan' && isRecord(snapshot) && Array.isArray(snapshot.modelYears))
    return snapshot.modelYears.map(String);
  return step.args ?? [];
}

export function snapshotDate(snapshot: unknown): string | null {
  if (!isRecord(snapshot)) return null;
  const value = snapshot.retrievedAt ?? snapshot.reviewedAt;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null;
}

export type Freshness = { date: string | null; ageDays: number | null; stale: boolean };

export function freshness(snapshot: unknown, now: Date, maxAgeDays: number): Freshness {
  const date = snapshotDate(snapshot);
  if (!date) return { date: null, ageDays: null, stale: true };
  const ageDays = Math.floor((now.getTime() - Date.parse(date)) / 86_400_000);
  return { date, ageDays, stale: ageDays > maxAgeDays };
}

// Capture metadata changes on every fetch; only differences outside it signal
// that a source's content changed.
const volatileKeys = new Set([
  'retrievedAt',
  'reviewedAt',
  'capturedAt',
  'date',
  'sha256',
  'requestSha256',
]);

// Objects are compared key by key. Arrays are compared as multisets of their
// entries, so an inserted record reports one addition rather than shifting
// every later index into a difference.
export function changedFields(before: unknown, after: unknown, limit = 20) {
  const paths: string[] = [];
  let count = 0;
  function note(path: string, changes: number, label = path) {
    count += changes;
    if (paths.length < limit) paths.push(label || '(root)');
  }
  function walk(a: unknown, b: unknown, path: string) {
    if (Object.is(a, b)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      const remaining = new Map<string, number>();
      for (const entry of a.map(canonical)) remaining.set(entry, (remaining.get(entry) ?? 0) + 1);
      let added = 0;
      for (const entry of b.map(canonical)) {
        const left = remaining.get(entry) ?? 0;
        if (left) remaining.set(entry, left - 1);
        else added++;
      }
      const removed = [...remaining.values()].reduce((sum, n) => sum + n, 0);
      if (added || removed)
        note(path, added + removed, `${path || '(root)'} (+${added}/−${removed})`);
      return;
    }
    if (isRecord(a) && isRecord(b)) {
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
        if (!volatileKeys.has(key)) walk(a[key], b[key], path ? `${path}.${key}` : key);
      return;
    }
    note(path, 1);
  }
  walk(before, after, '');
  return { count, paths };
}

// Stable JSON without capture metadata, for comparing array entries.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isRecord(value))
    return `{${Object.keys(value)
      .filter((key) => !volatileKeys.has(key))
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
