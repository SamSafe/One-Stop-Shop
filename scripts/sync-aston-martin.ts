import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  astonUrls,
  astonClientHashes,
  astonStockOnly,
  astonConfigUrl,
  astonMenu,
  astonProduct,
  astonConfiguration,
  astonReceiptSchema,
  validateAstonSnapshot,
  astonSnapshotSchema,
  astonNoRegression,
} from '../packages/car-catalog/src/aston-martin-import.ts';
import type { AstonSnapshot } from '../packages/car-catalog/src/aston-martin-import.ts';
import { addAstonOffers } from '../packages/car-catalog/src/aston-martin.ts';

const folder = 'data/raw/aston-martin',
  target = 'packages/car-catalog/data/manufacturers/aston-martin.json';
const offline = process.argv.includes('--offline'),
  at = process.argv.indexOf('--from-captures');
if (at >= 0 && !process.argv[at + 1]) throw new Error('--from-captures requires a manifest path.');
const captured = offline || at >= 0;
const manifestSchema = z.object({
  sources: z.array(
    astonReceiptSchema.extend({ status: z.number(), finalUrl: z.url().optional() }).strip(),
  ),
});
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(at >= 0 ? process.argv[at + 1]! : `${folder}/capture-manifest.json`, 'utf8'),
      ),
    )
  : { sources: [] as z.infer<typeof manifestSchema>['sources'] };
await mkdir(folder, { recursive: true });
const used: z.infer<typeof astonReceiptSchema>[] = [];
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
async function capture(url: string) {
  let source: z.infer<typeof astonReceiptSchema>, bytes: Buffer;
  if (captured) {
    const r = manifest.sources.findLast((s) => s.url === url);
    if (!r || (r.finalUrl && r.finalUrl !== url))
      throw new Error(`Missing or redirected Aston Martin source: ${url}`);
    source = astonReceiptSchema.parse({
      url: r.url,
      status: r.status,
      sha256: r.sha256,
      capturedAt: r.capturedAt,
    });
    bytes = await readFile(`${folder}/${source.sha256}`);
    if (hash(bytes) !== source.sha256)
      throw new Error(`Aston Martin source checksum mismatch: ${url}`);
  } else {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    const r = {
      url,
      status: response.status,
      sha256: hash(bytes),
      capturedAt: new Date().toISOString(),
    };
    await writeFile(`${folder}/${r.sha256}`, bytes);
    manifest.sources.push(r);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
    source = astonReceiptSchema.parse(r);
  }
  used.push(source);
  return { source, text: bytes.toString('utf8') };
}
const sources = {} as AstonSnapshot['sources'],
  bodies = {} as Record<keyof typeof astonUrls, string>;
for (const [key, url] of Object.entries(astonUrls)) {
  const page = await capture(url);
  sources[key as keyof typeof astonUrls] = page.source;
  bodies[key as keyof typeof astonUrls] = page.text;
}
for (const [key, expected] of Object.entries(astonClientHashes))
  if (sources[key as keyof typeof astonClientHashes].sha256 !== expected)
    throw new Error('Aston Martin public client changed; review before refreshing.');
if (!bodies.bootstrap.includes(`src="${new URL(astonUrls.entryClient).pathname.slice(1)}"`))
  throw new Error('Aston Martin production bootstrap changed; review its current public client.');
const plain = (s: string) =>
  s
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
if (!/first deliveries scheduled for Q2 2027/i.test(plain(bodies.valen)))
  throw new Error('Valen first-delivery qualification changed.');
if (!/plug-in hybrid/i.test(plain(bodies.valhalla)))
  throw new Error('Valhalla powertrain qualification changed.');
// The Spider's own page describes a hybrid powertrain but not plug-in charging.
if (!/Hybrid Powertrain/i.test(plain(bodies.valhallaSpider)))
  throw new Error('Valhalla Spider powertrain qualification changed.');
const countries = z.array(z.string()).parse(JSON.parse(bodies.countries));
if (!countries.includes('CA')) throw new Error('Canada is not offered in the public country menu.');
const menu = astonMenu(JSON.parse(bodies.menu)),
  translations: unknown = JSON.parse(bodies.translations);
const products: AstonSnapshot['products'] = [];
for (const p of menu) {
  let configuration: AstonSnapshot['products'][number]['configuration'] = null;
  if (!astonStockOnly.includes(p.id)) {
    const page = await capture(astonConfigUrl(p.id));
    configuration = astonConfiguration(JSON.parse(page.text), page.source);
  }
  products.push(astonProduct(p, translations, configuration));
}
const retrievedAt = used
  .map((r) => r.capturedAt)
  .sort()
  .at(-1)!;
const snapshot = validateAstonSnapshot({
  schemaVersion: 1,
  market: 'CA',
  retrievedAt,
  sources,
  menuIds: menu.map((p) => p.id),
  countries,
  products,
  valenFirstDeliveryQuarter: '2027-Q2',
});
try {
  // The baseline was reviewed against the clients pinned at its own date, so only
  // its shape is checked before comparing offerings. It may lack sources added since.
  const baseline = astonSnapshotSchema
    .extend({ sources: z.record(z.string(), astonReceiptSchema) })
    .parse(JSON.parse(await readFile(target, 'utf8')));
  astonNoRegression(baseline as AstonSnapshot, snapshot);
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
const catalog = addAstonOffers(
  {
    schemaVersion: 1,
    reviewedAt: retrievedAt.slice(0, 10),
    scope: 'Canadian Aston Martin listing validation',
    pricingNote: 'Prices and model years remain unverified.',
    sources: [],
    cars: [],
  },
  snapshot,
);
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Aston Martin offline reconstruction differs from reviewed snapshot.');
  console.log('Aston Martin source checksums and exact offline reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(
    `${folder}/capture-manifest.json`,
    JSON.stringify({ sources: used }, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    menuProducts: products.length,
    manufacturerOffers: catalog.cars.length,
    stockOnly: products.filter((p) => p.role === 'stock-only').length,
    announcedOnly: products.filter((p) => p.role === 'announced-only').length,
    retrievedAt,
  }),
);
