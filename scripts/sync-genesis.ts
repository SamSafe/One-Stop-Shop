import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  genesisHomeUrl,
  genesisBuilderUrl,
  genesisClientUrl,
  genesisModelsUrl,
  genesisTrimsUrl,
  genesisColoursUrl,
  genesisSpecSelectorUrl,
  genesisSpecUrl,
  genesisSpecsPage,
  genesisReceiptSchema,
  genesisModelsSchema,
  genesisTrimsSchema,
  genesisColours,
  genesisSpecSelectorSchema,
  genesisSpecDataSchema,
  genesisSelectorRequest,
  genesisSpecRequest,
  genesisMatchSpecification,
  validateGenesisSnapshot,
  genesisRequireNoRegression,
} from '../packages/car-catalog/src/genesis-import.ts';
import type {
  GenesisReceipt,
  GenesisSnapshot,
  GenesisSpecification,
} from '../packages/car-catalog/src/genesis-import.ts';
import { addGenesisRetail } from '../packages/car-catalog/src/genesis.ts';

const folder = 'data/raw/genesis',
  target = 'packages/car-catalog/data/manufacturers/genesis.json';
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const rawReceipt = z.object({
  url: z.url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  status: z.number().int().default(200),
  requestSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
const manifestSchema = z.object({ retrievedAt: z.iso.datetime(), sources: z.array(rawReceipt) });
const offline = process.argv.includes('--offline'),
  arg = process.argv.indexOf('--from-captures'),
  captured = offline || arg >= 0;
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          arg >= 0 ? process.argv[arg + 1]! : `${folder}/capture-manifest.json`,
          'utf8',
        ),
      ),
    )
  : { retrievedAt: new Date().toISOString(), sources: [] as z.infer<typeof rawReceipt>[] };
await mkdir(folder, { recursive: true });
const cache = new Map<string, { source: GenesisReceipt; text: string; json: () => unknown }>();
async function capture(url: string, body?: string) {
  const requestSha256 = body ? hash(body) : undefined,
    key = `${url}/${requestSha256 ?? 'GET'}`;
  if (cache.has(key)) return cache.get(key)!;
  let source: GenesisReceipt, bytes: Buffer;
  if (captured) {
    const saved = manifest.sources.find((s) => s.url === url && s.requestSha256 === requestSha256);
    if (!saved) throw new Error(`Missing Genesis capture: ${url} (${requestSha256 ?? 'GET'})`);
    source = genesisReceiptSchema.parse(saved);
    bytes = await readFile(`${folder}/${saved.sha256}`);
    if (hash(bytes) !== saved.sha256) throw new Error('Genesis response checksum mismatch.');
    if (body) {
      const savedBody = await readFile(`${folder}/${requestSha256}`);
      if (hash(savedBody) !== requestSha256 || savedBody.toString('utf8') !== body)
        throw new Error('Genesis request checksum mismatch.');
    }
  } else {
    const response = await fetch(url, {
      ...(body
        ? {
            method: 'POST',
            body,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
          }
        : {}),
      signal: AbortSignal.timeout(45000),
    });
    bytes = Buffer.from(await response.arrayBuffer());
    const raw = {
      url,
      status: response.status,
      sha256: hash(bytes),
      ...(requestSha256 ? { requestSha256 } : {}),
    };
    await writeFile(`${folder}/${raw.sha256}`, bytes);
    if (body) await writeFile(`${folder}/${requestSha256}`, body);
    manifest.sources.push(raw);
    await writeFile(
      `${folder}/review-capture-manifest.json`,
      JSON.stringify(manifest, null, 2) + '\n',
    );
    if (!response.ok) throw new Error(`Genesis required source HTTP ${response.status}: ${url}`);
    source = genesisReceiptSchema.parse(raw);
  }
  const text = bytes.toString('utf8'),
    result = { source, text, json: () => JSON.parse(text) as unknown };
  cache.set(key, result);
  return result;
}
const home = await capture(genesisHomeUrl),
  builder = await capture(genesisBuilderUrl),
  client = await capture(genesisClientUrl),
  modelsCapture = await capture(genesisModelsUrl),
  specPage = await capture(genesisSpecsPage);
if (
  !home.text.includes('acquisition.genesis.ca') ||
  !client.text.includes('GetLatestYearModelsJson') ||
  !client.text.includes('trimTaxes')
)
  throw new Error('Genesis published Canadian source contract is missing.');
const models = genesisModelsSchema.parse(modelsCapture.json()).models;
const overview = new Map<string, { modelName: string; year: number }>();
for (const match of home.text.matchAll(
  /href="(https:\/\/acquisition\.genesis\.ca\/en\/build-and-order\?[^\"]+)"/g,
)) {
  const url = new URL(match[1]!.replaceAll('&amp;', '&')),
    name = url.searchParams.get('model'),
    year = Number(url.searchParams.get('year'));
  if (name && year >= 2020) overview.set(`${name}/${year}`, { modelName: name, year });
}
const specModels = new Map<string, string>();
for (const tag of specPage.text.matchAll(/<a\b[^>]*class="[^"]*vehicle_cd[^"]*"[^>]*>/g)) {
  const code = /data-model-cd="([^"]+)"/.exec(tag[0])?.[1],
    name = /data-model-name="([^"]+)"/.exec(tag[0])?.[1];
  if (code && name) specModels.set(code, name);
}
if (!specModels.size) throw new Error('Genesis specification selector models are missing.');
const specificationSelectors: GenesisSnapshot['specificationSelectors'] = [],
  rejectedSpecifications: GenesisSnapshot['rejectedSpecifications'] = [],
  specifications: GenesisSpecification[] = [];
for (const [code, name] of specModels) {
  const selector = await capture(genesisSpecSelectorUrl, genesisSelectorRequest(code, name));
  const parsed = genesisSpecSelectorSchema.parse(selector.json());
  specificationSelectors.push({
    source: selector.source,
    modelCode: code,
    modelName: name,
    labels: parsed.data.vehiclesList.map((v) => v.viewName),
  });
  for (const trim of parsed.data.vehiclesList) {
    const body = genesisSpecRequest(trim.mdelCd, trim.carnNm, trim.dtlCd, trim.viewName),
      response = await capture(genesisSpecUrl, body),
      parsed = genesisSpecDataSchema.parse(response.json());
    const rows = parsed.data.specList;
    if (!rows.length)
      throw new Error(`Genesis required specification table is empty: ${trim.viewName}`);
    const year = Number(rows[0]!.prdnMyer),
      modelTrim = rows[0]!.modelTrim;
    if (
      modelTrim.trim() !== (trim.mdelCd + trim.dtlCd).trim() ||
      !trim.viewName.trim().startsWith(String(year)) ||
      rows.some((r) => Number(r.prdnMyer) !== year)
    ) {
      rejectedSpecifications.push({
        source: response.source,
        modelCode: trim.mdelCd,
        label: trim.viewName,
        requestedYear: Number(/^\s*(\d{4})/.exec(trim.viewName)![1]),
        publishedYears: [...new Set(rows.map((r) => Number(r.prdnMyer)))],
        reason:
          'The public selector label and returned production-year metadata do not agree. The table is quarantined rather than copied into this model year.',
      });
      continue;
    }
    specifications.push({
      source: response.source,
      modelCode: trim.mdelCd,
      modelTrim,
      label: trim.viewName,
      year,
      rows,
    });
  }
}
const snapshot: GenesisSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  context: { country: 'CA', currency: 'CAD', province: 'AB', language: 'en' },
  homeSource: home.source,
  builderSource: builder.source,
  clientSource: client.source,
  modelsSource: modelsCapture.source,
  specsPageSource: specPage.source,
  overviewReferences: [...overview.values()],
  selectorModelGuids: models.map((m) => m.modelGuid),
  families: [],
  specificationSelectors,
  rejectedSpecifications,
  records: [],
};
for (const model of models) {
  const response = await capture(genesisTrimsUrl(model.modelNameEn, model.modelYear)),
    data = genesisTrimsSchema.parse(response.json()),
    years = data.modelYears.map((y) => y.year);
  if (
    Object.keys(data.trims).some((y) => !years.includes(Number(y))) ||
    data.modelYears.some((y) => y.id !== y.year)
  )
    throw new Error('Genesis explicit year selectors do not reconcile.');
  const trims = Object.values(data.trims).flat();
  snapshot.families.push({
    model,
    source: response.source,
    years,
    expectedTrimGuids: trims.map((t) => t.guid),
  });
  for (const trim of trims) {
    const colours = await capture(genesisColoursUrl(trim.extTrimId)),
      choices = genesisColours(colours.json());
    const specification = genesisMatchSpecification(trim, specifications);
    for (const colour of choices.length ? choices : [null])
      snapshot.records.push({
        familyKey: model.modelGuid,
        trim,
        colourSource: colours.source,
        expectedHscs: choices.map((c) => c.hsc),
        colour,
        specification,
        specificationGap: specification
          ? null
          : trim.isPreOrder
            ? 'This preorder has no exact Canadian specification-selector identity. No base model, boost headline or zero-price placeholder is substituted.'
            : 'No exact Canadian specification table for this model year/trim was joined. The latest year and its older brochure attachment are not substituted; exact-year factory features are retained where explicit.',
      });
  }
}
const valid = validateGenesisSnapshot(snapshot),
  catalog = addGenesisRetail(
    {
      schemaVersion: 1,
      reviewedAt: valid.retrievedAt.slice(0, 10),
      scope: 'Genesis import validation',
      pricingNote:
        'Base MSRP and separately labeled provincial published prices retain their own basis.',
      sources: [],
      cars: [],
    },
    valid,
  );
if (!captured) {
  let previous: GenesisSnapshot | undefined;
  try {
    previous = validateGenesisSnapshot(JSON.parse(await readFile(target, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (previous) genesisRequireNoRegression(previous, valid);
}
const serialized = await format(JSON.stringify(valid), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Genesis offline reconstruction differs.');
  console.log(`Verified Genesis offline reconstruction: ${catalog.cars.length} retail profiles.`);
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  await writeFile(`${folder}/capture-manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
  console.log(
    `Wrote ${catalog.cars.length} Genesis profiles, ${catalog.cars.filter((c) => c.publishedPrice).length} published regional prices, ${valid.records.filter((r) => r.specification).length} exact technical joins.`,
  );
}
