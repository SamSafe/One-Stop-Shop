import { createHash } from 'node:crypto';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import {
  nrcanEndpoint,
  nrcanPageSchema,
  nrcanSearchUrl,
  ratingType,
  searchParameters,
  validateNrcanSnapshot,
} from '../packages/car-catalog/src/nrcan-schema.ts';
import type { NrcanRecord, NrcanSnapshot } from '../packages/car-catalog/src/nrcan-schema.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const currentYear = new Date().getUTCFullYear();
const years = process.argv.slice(2).map(Number);
if (!years.length) years.push(currentYear - 1, currentYear, currentYear + 1);
if (
  years.some((year) => !Number.isInteger(year) || year < 1990 || year > 2100) ||
  new Set(years).size !== years.length
)
  throw new Error('Pass unique model years, for example: npm run catalog:sync -- 2025 2026 2027');
years.sort();

const records: NrcanRecord[] = [];
const totals = { ICE: 0, BEV: 0, PHEV: 0 };
const responses: NrcanSnapshot['responses'] = [];
const rawDirectory = path.join(root, 'data/raw/nrcan');
await mkdir(rawDirectory, { recursive: true });
for (const type of ['ICE', 'BEV', 'PHEV'] as const) {
  let pages = 1;
  const countKey = { ICE: 'TotalCountIce', BEV: 'TotalCountBev', PHEV: 'TotalCountPhev' } as const;
  const pagesKey = {
    ICE: 'NumberOfPagesIce',
    BEV: 'NumberOfPagesBev',
    PHEV: 'NumberOfPagesPhev',
  } as const;
  for (let page = 1; page <= pages; page++) {
    const response = await fetch(nrcanEndpoint, {
      method: 'POST',
      body: searchParameters(years, type, page),
      headers: {
        'User-Agent': 'OSS Canadian vehicle catalog research (local development)',
        Referer: nrcanSearchUrl,
      },
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok)
      throw new Error(
        `NRCan ${type} page ${page}: HTTP ${response.status}. Snapshot not replaced.`,
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    const data = nrcanPageSchema.parse(JSON.parse(bytes.toString('utf8')));
    if (page === 1) {
      totals[type] = data[countKey[type]];
      pages = data[pagesKey[type]];
    }
    if (pages > 1000 || data[countKey[type]] !== totals[type] || data[pagesKey[type]] !== pages)
      throw new Error(`NRCan ${type} totals changed while importing. Retry the entire snapshot.`);
    if (data.VehiclesList.some((record) => ratingType(record) !== type))
      throw new Error(`NRCan returned a different powertrain on ${type} page ${page}.`);
    await writeFile(path.join(rawDirectory, `${type}-${page}.json`), bytes);
    responses.push({
      vehicleType: type,
      page,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      records: data.VehiclesList.length,
    });
    records.push(...data.VehiclesList);
    console.log(
      `${type} ${page}/${pages}: ${data.VehiclesList.length} records (${totals[type]} expected)`,
    );
  }
}
records.sort((a, b) => a.RecordId - b.RecordId);
const snapshot = validateNrcanSnapshot({
  schemaVersion: 1,
  retrievedAt: new Date().toISOString(),
  modelYears: years,
  source: nrcanEndpoint,
  attribution: 'Natural Resources Canada',
  license: 'https://open.canada.ca/en/open-government-licence-canada',
  totals,
  responses,
  records,
});
const target = path.join(root, 'packages/car-catalog/data/nrcan.json');
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(snapshot), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved complete snapshot: ${records.length} unique ratings across ${years.join(', ')}.`,
);
