import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  vinfastOrigin,
  vinfastProvinces,
  vinfastPricingClient,
  vinfastPageUrl,
  vinfastReceiptSchema,
  vinfastLineup,
  vinfastPricePage,
  vinfastProfiles,
  validateVinfastSnapshot,
  vinfastNoRegression,
} from '../packages/car-catalog/src/vinfast-import.ts';
import type { VinfastSnapshot } from '../packages/car-catalog/src/vinfast-import.ts';
import { addVinfastOffers } from '../packages/car-catalog/src/vinfast.ts';

const folder = 'data/raw/vinfast',
  target = 'packages/car-catalog/data/manufacturers/vinfast.json';
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const offline = process.argv.includes('--offline'),
  arg = process.argv.indexOf('--from-captures'),
  captured = offline || arg >= 0;
if (arg >= 0 && !process.argv[arg + 1]) throw new Error('--from-captures needs a manifest path.');
const rawReceipt = vinfastReceiptSchema
  .omit({ province: true })
  .extend({
    url: z.url(),
    finalUrl: z.url().optional(),
    publicProvincePreference: z.enum(vinfastProvinces).optional(),
    province: z.enum(vinfastProvinces).nullable().optional(),
  })
  .strip();
const manifest = captured
  ? z
      .object({ sources: z.array(rawReceipt) })
      .parse(
        JSON.parse(
          await readFile(
            arg >= 0 ? process.argv[arg + 1]! : `${folder}/capture-manifest.json`,
            'utf8',
          ),
        ),
      )
  : { sources: [] as z.infer<typeof rawReceipt>[] };
await mkdir(folder, { recursive: true });
const used: z.infer<typeof vinfastReceiptSchema>[] = [];
async function capture(url: string, province: (typeof vinfastProvinces)[number] | null) {
  let source: z.infer<typeof vinfastReceiptSchema>, bytes: Buffer;
  if (captured) {
    const r = manifest.sources.findLast(
      (s) => s.url === url && (s.province ?? s.publicProvincePreference ?? null) === province,
    );
    if (!r || (r.finalUrl && r.finalUrl !== url))
      throw new Error(`Missing or redirected VinFast public source: ${url}/${province}`);
    source = vinfastReceiptSchema.parse({
      url: r.url,
      status: r.status,
      sha256: r.sha256,
      capturedAt: r.capturedAt,
      province,
    });
    bytes = await readFile(`${folder}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error('VinFast source checksum mismatch.');
  } else {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(45000),
      ...(province ? { headers: { Cookie: `province=${province}` } } : {}),
    });
    bytes = Buffer.from(await response.arrayBuffer());
    source = vinfastReceiptSchema.parse({
      url,
      status: response.status,
      sha256: hash(bytes),
      capturedAt: new Date().toISOString(),
      province,
    });
    await writeFile(`${folder}/${source.sha256}`, bytes);
    manifest.sources.push(source);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  if (source.status !== 200)
    throw new Error(`VinFast required source HTTP ${source.status}: ${url}`);
  used.push(source);
  return { source, text: bytes.toString('utf8') };
}
const home = await capture(`${vinfastOrigin}/en`, null),
  models = vinfastLineup(home.text),
  client = await capture(vinfastPricingClient.url, null);
if (client.source.sha256 !== vinfastPricingClient.sha256)
  throw new Error('VinFast public province client changed; review before refresh.');
const pages: VinfastSnapshot['pages'] = [];
for (const model of models)
  for (const province of vinfastProvinces) {
    const page = await capture(vinfastPageUrl(model), province);
    pages.push({
      model,
      province,
      source: page.source,
      cards: vinfastPricePage(page.text, model, province),
    });
  }
const retrievedAt = used
  .map((s) => s.capturedAt)
  .sort()
  .at(-1)!;
const snapshot = validateVinfastSnapshot({
  schemaVersion: 1,
  market: 'CA',
  currency: 'CAD',
  retrievedAt,
  overviewSource: home.source,
  pricingClient: client.source,
  models,
  pages,
});
let previous: VinfastSnapshot | undefined;
try {
  previous = validateVinfastSnapshot(JSON.parse(await readFile(target, 'utf8')));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (previous) vinfastNoRegression(previous, snapshot);
const catalog = addVinfastOffers(
  {
    schemaVersion: 1,
    reviewedAt: retrievedAt.slice(0, 10),
    scope: 'VinFast current Canadian price-card validation',
    pricingNote:
      'Bare MSRP before fees, taxes and incentives; unverified model years remain explicit.',
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
    throw new Error('VinFast offline reconstruction differs from reviewed snapshot.');
  console.log('VinFast source checksums and exact offline reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(
    `${folder}/capture-manifest.json`,
    JSON.stringify({ retrievedAt, sources: used }, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    models,
    provinceViews: pages.length,
    publishedTrimOffers: vinfastProfiles(snapshot).length,
    yearQualifiedRetailProfiles: catalog.cars.filter((c) => c.recordKind === 'retail-trim').length,
    yearUnverifiedManufacturerOffers: catalog.cars.filter(
      (c) => c.recordKind === 'manufacturer-offer',
    ).length,
    fullMarketCoverageVerified: false,
  }),
);
