import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  mclarenReceiptSchema,
  mclarenProfiles,
  mclarenClientHash,
  mclarenNavigation,
  mclarenLanding,
  mclarenFactory,
  validateMclarenSnapshot,
  mclarenSnapshotSchema,
  mclarenNoRegression,
} from '../packages/car-catalog/src/mclaren-import.ts';
import type { MclarenSnapshot } from '../packages/car-catalog/src/mclaren-import.ts';
import { addMclarenRetail } from '../packages/car-catalog/src/mclaren.ts';

const folder = 'data/raw/mclaren',
  target = 'packages/car-catalog/data/manufacturers/mclaren.json';
const offline = process.argv.includes('--offline'),
  at = process.argv.indexOf('--from-captures');
if (at >= 0 && !process.argv[at + 1]) throw new Error('--from-captures needs a manifest path.');
if (!offline && at < 0)
  await new Promise<void>((resolve, reject) => {
    const p = spawn(process.execPath, ['scripts/capture-mclaren.mjs'], { stdio: 'inherit' });
    p.once('error', reject);
    p.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`McLaren capture failed: ${code}`)),
    );
  });
const receipt = mclarenReceiptSchema;
const manifest = z
  .object({
    sources: z.object({ bootstrap: receipt, client: receipt, menu: receipt }),
    profiles: z
      .array(
        z.object({
          id: z.enum(mclarenProfiles),
          landing: receipt,
          initial: receipt,
          general: receipt,
        }),
      )
      .length(5),
  })
  .parse(
    JSON.parse(
      await readFile(
        at >= 0
          ? process.argv[at + 1]!
          : `${folder}/${offline ? 'capture-manifest' : 'review-capture-manifest'}.json`,
        'utf8',
      ),
    ),
  );
const used: z.infer<typeof receipt>[] = [];
async function body(r: z.infer<typeof receipt>) {
  const bytes = await readFile(`${folder}/${r.sha256}`);
  if (createHash('sha256').update(bytes).digest('hex') !== r.sha256)
    throw new Error(`McLaren source checksum mismatch: ${r.url}`);
  used.push(r);
  return bytes.toString('utf8');
}
const bootstrap = await body(manifest.sources.bootstrap);
if (
  !bootstrap.includes('src="./assets/index-BNg9rp8r.js"') ||
  manifest.sources.client.sha256 !== mclarenClientHash
)
  throw new Error('McLaren current production bootstrap/client changed; review before importing.');
await body(manifest.sources.client);
const navigation = mclarenNavigation(JSON.parse(await body(manifest.sources.menu)));
const profiles: MclarenSnapshot['profiles'] = [];
for (const p of manifest.profiles) {
  mclarenLanding(JSON.parse(await body(p.landing)), p.id);
  profiles.push(
    mclarenFactory(p.id, JSON.parse(await body(p.initial)), JSON.parse(await body(p.general)), {
      landing: p.landing,
      initial: p.initial,
      general: p.general,
    }),
  );
}
const retrievedAt = used
  .map((r) => r.capturedAt)
  .sort()
  .at(-1)!;
const snapshot = validateMclarenSnapshot({
  schemaVersion: 1,
  market: 'CA',
  retrievedAt,
  sources: manifest.sources,
  navigation,
  profiles,
});
try {
  // The baseline was reviewed against the client pinned at its own date, so only
  // its shape is checked before comparing offerings.
  mclarenNoRegression(
    mclarenSnapshotSchema.parse(JSON.parse(await readFile(target, 'utf8'))),
    snapshot,
  );
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const catalog = addMclarenRetail(
  {
    schemaVersion: 1,
    reviewedAt: retrievedAt.slice(0, 10),
    scope: 'Canadian McLaren identity validation',
    pricingNote: 'Base prices unverified; Canadian factory price display is disabled.',
    cars: [],
    sources: [],
  },
  snapshot,
);
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('McLaren offline reconstruction differs from the reviewed snapshot.');
  console.log('McLaren original source checksums and exact offline reconstruction match.');
} else {
  await mkdir('packages/car-catalog/data/manufacturers', { recursive: true });
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(`${folder}/capture-manifest.json.tmp`, JSON.stringify(manifest, null, 2) + '\n');
  await rename(`${folder}/capture-manifest.json.tmp`, `${folder}/capture-manifest.json`);
}
console.log(
  JSON.stringify({
    profiles: catalog.cars.length,
    years: [...new Set(catalog.cars.map((c) => c.year))],
    menuOnlyRoadModels: navigation
      .filter((n) => !n.profile && n.category !== 'Motorsport')
      .map((n) => n.name),
    retrievedAt,
  }),
);
