import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  mercedesBuilder,
  mercedesCarOrigin,
  mercedesVanOrigin,
  mercedesLineup,
  mercedesRollover,
  mercedesModelPage,
  mercedesMenuPlaceholders,
  mercedesReceiptSchema,
  mercedesRequireNoRegression,
  mercedesVanKinds,
  mercedesVanSelector,
  validateMercedesSnapshot,
} from '../packages/car-catalog/src/mercedes-import.ts';
import type {
  MercedesReceipt,
  MercedesReference,
  MercedesSnapshot,
} from '../packages/car-catalog/src/mercedes-import.ts';
import { addMercedesRetail } from '../packages/car-catalog/src/mercedes.ts';

const folder = 'data/raw/mercedes',
  target = 'packages/car-catalog/data/manufacturers/mercedes.json';
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(
    mercedesReceiptSchema
      .extend({ finalUrl: z.url().optional(), capturedAt: z.iso.datetime().optional() })
      .strip(),
  ),
});
const offline = process.argv.includes('--offline'),
  argument = process.argv.indexOf('--from-captures'),
  captured = offline || argument >= 0;
if (argument >= 0 && !process.argv[argument + 1])
  throw new Error('--from-captures needs a manifest path.');
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          argument >= 0 ? process.argv[argument + 1]! : `${folder}/capture-manifest.json`,
          'utf8',
        ),
      ),
    )
  : {
      retrievedAt: new Date().toISOString(),
      sources: [] as z.infer<typeof manifestSchema>['sources'],
    };
await mkdir(folder, { recursive: true });
const used = new Map<string, MercedesReceipt>();
async function capture(url: string) {
  let receipt: MercedesReceipt, bytes: Buffer;
  if (captured) {
    const raw = manifest.sources.findLast((s) => s.url === url);
    if (!raw) throw new Error(`Missing Mercedes source capture: ${url}`);
    if (
      (raw.finalUrl && raw.finalUrl !== url) ||
      (raw.capturedAt && raw.capturedAt.slice(0, 10) !== manifest.retrievedAt.slice(0, 10))
    )
      throw new Error('Mercedes capture redirect or review date mismatch.');
    receipt = mercedesReceiptSchema.parse({ url: raw.url, status: raw.status, sha256: raw.sha256 });
    bytes = await readFile(`${folder}/${receipt.sha256}`);
    if (sha256(bytes) !== receipt.sha256) throw new Error('Mercedes source checksum mismatch.');
  } else {
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    receipt = mercedesReceiptSchema.parse({ url, status: response.status, sha256: sha256(bytes) });
    await writeFile(`${folder}/${receipt.sha256}`, bytes);
    manifest.sources.push(receipt);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
  }
  if (receipt.status !== 200)
    throw new Error(`Mercedes required source HTTP ${receipt.status}: ${url}`);
  used.set(url, receipt);
  return { source: receipt, text: bytes.toString('utf8') };
}
const home = await capture(`${mercedesCarOrigin}/en/home`),
  menu: MercedesReference[] = [];
const cars: MercedesSnapshot['cars'] = [];
for (const listed of mercedesLineup(home.text)) {
  const page = await capture(listed.page),
    response = listed.builder ? await capture(listed.builder) : null,
    m = mercedesRollover(listed, page.text, response?.text ?? null);
  if (m.menuYear)
    console.log(
      `${listed.key}: model page states ${m.year}${m.staleBuilder ? '; builder still shows the menu year' : ''}. Imported as ${m.key}.`,
    );
  menu.push(m);
  let builder: MercedesSnapshot['cars'][number]['builder'] = null;
  if (response && m.builder) {
    builder = {
      source: response.source,
      data: mercedesBuilder(response.text, m.model, m.year, false),
    };
  }
  cars.push({
    key: m.key,
    source: page.source,
    ...mercedesModelPage(page.text, m.model, m.year),
    builder,
  });
}
const selectors: MercedesSnapshot['selectors'] = [],
  vans: MercedesSnapshot['vans'] = [];
for (const kind of mercedesVanKinds) {
  const selector = await capture(`${mercedesVanOrigin}/en/vehicles/build/sprinter/${kind}`),
    models = mercedesVanSelector(selector.text, kind);
  selectors.push({ kind, source: selector.source, models });
  for (const m of models) {
    const response = await capture(m.builder);
    vans.push({
      key: m.key,
      source: response.source,
      data: mercedesBuilder(response.text, m.model, m.year, true),
    });
  }
}
const snapshot = validateMercedesSnapshot({
  schemaVersion: 1,
  market: 'CA',
  currency: 'CAD',
  retrievedAt: manifest.retrievedAt,
  overviewSource: home.source,
  menu,
  expectedCarKeys: menu.map((m) => m.key),
  placeholders: mercedesMenuPlaceholders(home.text),
  selectors,
  cars,
  vans,
});
const catalog = addMercedesRetail(
  {
    schemaVersion: 1,
    reviewedAt: snapshot.retrievedAt.slice(0, 10),
    scope: 'Mercedes Canadian base model-year import validation',
    pricingNote: 'Factory base MSRP before options, fees, taxes and incentives.',
    cars: [],
    sources: [],
  },
  snapshot,
);
let previous: MercedesSnapshot | undefined;
try {
  previous = validateMercedesSnapshot(JSON.parse(await readFile(target, 'utf8')));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
if (previous) mercedesRequireNoRegression(previous, snapshot);
const serialized = await format(JSON.stringify(snapshot), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Mercedes offline reconstruction differs from the reviewed snapshot.');
  console.log('Mercedes source checksums and normalized offline reconstruction match.');
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(
    `${folder}/capture-manifest.json`,
    JSON.stringify({ retrievedAt: manifest.retrievedAt, sources: [...used.values()] }, null, 2) +
      '\n',
  );
}
console.log(
  JSON.stringify({
    currentCarModelYears: cars.length,
    carBuilders: cars.filter((c) => c.builder).length,
    vanModels: vans.length,
    baseProfiles: catalog.cars.length,
    sources: catalog.sources.length,
    packageAndInventoryCoverageComplete: false,
  }),
);
