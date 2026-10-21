import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import {
  fordShop,
  fordSelectionUrl,
  fordShowroom,
  fordSelection,
  fordBuildUrl,
  fordBuild,
  validateFordSnapshot,
} from '../packages/car-catalog/src/ford-import.ts';
import type { FordBrand, FordSnapshot } from '../packages/car-catalog/src/ford-import.ts';

const target = 'packages/car-catalog/data/manufacturers/ford.json',
  directory = 'data/raw/ford';
const offline = process.argv.includes('--offline');
const previous = offline ? validateFordSnapshot(JSON.parse(await readFile(target, 'utf8'))) : null;
const receipts = previous
  ? [
      ...previous.brands.map((brand) => brand.source),
      ...previous.models.map((model) => model.selectionSource),
      ...previous.records.map((record) => record.source),
    ]
  : [];
await mkdir(directory, { recursive: true });
async function download(url: string) {
  let bytes: Buffer;
  if (offline) {
    const receipt = receipts.find((receipt) => receipt.url === url);
    if (!receipt) throw new Error(`Missing offline Ford source: ${url}`);
    bytes = await readFile(`${directory}/${receipt.sha256}`);
    if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256)
      throw new Error('Offline Ford source checksum mismatch.');
  } else {
    let failure: unknown;
    bytes = Buffer.alloc(0);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw new Error(`Ford source HTTP ${response.status}: ${url}`);
        bytes = Buffer.from(await response.arrayBuffer());
        failure = null;
        break;
      } catch (error) {
        failure = error;
      }
    }
    if (failure) throw failure;
  }
  const source = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (!offline) await writeFile(`${directory}/${source.sha256}`, bytes);
  return { source, html: bytes.toString('utf8') };
}
const snapshot: FordSnapshot = {
  schemaVersion: 1,
  retrievedAt: previous?.retrievedAt ?? new Date().toISOString(),
  brands: [],
  models: [],
  records: [],
};
const jobs: {
  brand: FordBrand;
  key: string;
  year: number;
  name: string;
  showroomId: string;
  segment: string;
}[] = [];
for (const brand of ['Ford', 'Lincoln'] as FordBrand[]) {
  const page = await download(`${fordShop(brand)}/showroom/`),
    lineup = fordShowroom(page.html, brand);
  snapshot.brands.push({
    brand,
    source: page.source,
    expectedModelKeys: lineup.models.map((model) => `${model.key}/${model.year}`),
    excludedShowroomEntries: lineup.excluded,
  });
  jobs.push(...lineup.models);
}
let next = 0;
async function worker() {
  for (;;) {
    const job = jobs[next++];
    if (!job) return;
    const selection = await download(fordSelectionUrl(job.brand, job.key, job.year));
    const { metadata, variants } = fordSelection(selection.html, job);
    snapshot.models.push({
      ...job,
      electric: metadata.electric,
      selectionSource: selection.source,
      variants,
    });
    let count = 0;
    for (const variant of variants) {
      if (variant.excludedReason !== null) continue;
      const page = await download(fordBuildUrl(job.brand, job.key, job.year, variant));
      snapshot.records.push({
        brand: job.brand,
        key: job.key,
        year: job.year,
        variantKey: variant.key,
        source: page.source,
        build: fordBuild(page.html, job, variant),
      });
      count++;
    }
    console.log(
      `${job.brand} ${job.name} ${job.year}: ${count} default factory configurations; ${variants.length - count} cargo-only variants excluded.`,
    );
  }
}
await Promise.all([worker(), worker(), worker()]);
// Stable serialization independent of response timing.
snapshot.models.sort((a, b) =>
  `${a.brand}/${a.key}/${a.year}`.localeCompare(`${b.brand}/${b.key}/${b.year}`),
);
snapshot.records.sort((a, b) =>
  `${a.brand}/${a.key}/${a.year}/${a.variantKey}`.localeCompare(
    `${b.brand}/${b.key}/${b.year}/${b.variantKey}`,
  ),
);
if (!offline)
  for (const brand of snapshot.brands) {
    const recheck = fordShowroom((await download(brand.source.url)).html, brand.brand);
    if (
      JSON.stringify(recheck.models.map((model) => `${model.key}/${model.year}`).sort()) !==
      JSON.stringify([...brand.expectedModelKeys].sort())
    )
      throw new Error('Ford showroom changed during capture.');
  }
const validated = validateFordSnapshot(snapshot);
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(validated), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved ${validated.records.length} Ford/Lincoln default factory configurations. Additional engine/drive/equipment selections and older inventory remain in scope.`,
);
