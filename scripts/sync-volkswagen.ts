import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { z } from 'zod';
import { format, resolveConfig } from 'prettier';
import {
  vwSelectorUrl,
  vwOverviewUrl,
  vwGlobalUrl,
  vwLineup,
  vwCatalogueUrl,
  vwCatalogue,
  vwKey,
  vwMsrpDefinition,
  validateVwSnapshot,
} from '../packages/car-catalog/src/volkswagen-import.ts';
import type { VwSnapshot, VwReceipt } from '../packages/car-catalog/src/volkswagen-import.ts';

const directory = 'data/raw/volkswagen',
  target = 'packages/car-catalog/data/manufacturers/volkswagen.json';
const hash = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(z.object({ url: z.url(), sha256: z.string().regex(/^[a-f0-9]{64}$/) })),
});
const offline = process.argv.includes('--offline'),
  argument = process.argv.indexOf('--from-captures'),
  captured = offline || argument >= 0;
const manifestPath =
  argument >= 0 ? process.argv[argument + 1]! : `${directory}/capture-manifest.json`;
const manifest = captured
  ? manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')))
  : {
      retrievedAt: new Date().toISOString(),
      sources: [] as z.infer<typeof manifestSchema>['sources'],
    };
await mkdir(directory, { recursive: true });
const seen = new Map<string, { source: VwReceipt; text: string }>();
async function capture(url: string, headers: Record<string, string> = {}) {
  if (seen.has(url)) return seen.get(url)!;
  let bytes: Buffer;
  if (captured) {
    const source = manifest.sources.find((source) => source.url === url);
    if (!source) throw new Error(`Missing VW source capture: ${url}`);
    bytes = await readFile(`${directory}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error(`VW source checksum mismatch: ${url}`);
  } else {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`VW source returned HTTP ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = hash(bytes);
    await writeFile(`${directory}/${sha256}`, bytes);
    manifest.sources.push({ url, sha256 });
  }
  const value = { source: { url, sha256: hash(bytes) }, text: bytes.toString('utf8') };
  seen.set(url, value);
  return value;
}
const selector = await capture(vwSelectorUrl),
  overview = await capture(vwOverviewUrl),
  global = await capture(vwGlobalUrl);
// This identifier is shipped by VW's public configurator. It is used only by explicit refreshes,
// never stored in the normalized snapshot or used as a private/user credential.
let appKey: string | undefined;
if (!captured) {
  const config = z
    .object({
      spaAsyncConfig: z.object({
        featureHubModel: z.object({
          featureAppsForFeatureAppService: z.record(z.string(), z.unknown()),
        }),
      }),
    })
    .parse(JSON.parse(global.text));
  const app = Object.entries(
    config.spaAsyncConfig.featureHubModel.featureAppsForFeatureAppService,
  ).find(([key]) => key.endsWith('/configure-standalone'))?.[1];
  appKey = z
    .object({ oneApiKey: z.string().min(1) })
    .parse(
      JSON.parse(z.object({ instanceConfig: z.string() }).parse(app).instanceConfig),
    ).oneApiKey;
}
const active = vwLineup(selector.text),
  listed = vwLineup(overview.text);
for (const model of active)
  if (!listed.some((candidate) => candidate.nodeId === model.nodeId))
    throw new Error(`VW build selector reference is absent from the overview: ${model.nodeId}`);
const listedFactoryKeys = new Set(
  listed.flatMap((model) =>
    model.children.flatMap((group) =>
      group.children.flatMap((trim) =>
        trim.data.engines.map(
          (engine) => `${engine.category}/${vwKey(engine.key)}/${engine.key.trimId}`,
        ),
      ),
    ),
  ),
);
for (const model of active)
  for (const group of model.children)
    for (const trim of group.children)
      for (const engine of trim.data.engines)
        if (!listedFactoryKeys.has(`${engine.category}/${vwKey(engine.key)}/${engine.key.trimId}`))
          throw new Error(
            `VW build selector factory reference is absent from the overview: ${vwKey(engine.key)}`,
          );
const snapshot: VwSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  lineupSources: [selector.source, overview.source],
  globalSource: global.source,
  msrpDefinitionVerified: vwMsrpDefinition(selector.text),
  models: [],
  records: [],
  virtualVehicleReferences: [],
  nonVehicleReferences: [],
};
for (const model of listed) {
  const year = /^\/(20\d{2})-/.exec(model.nodeId)?.[1];
  if (model.data.referenceModel.virtual) {
    const reference = {
      nodeId: model.nodeId,
      name: model.data.name,
      year: year ? Number(year) : null,
      reason: year
        ? 'Listed model-year card has no exact factory trim/engine references and is excluded from online configuration. Retail trims, current new inventory and pricing require reconciliation; no default virtual model is invented.'
        : 'Navigation/family card rather than an exact vehicle model-year/trim.',
    };
    (year ? snapshot.virtualVehicleReferences : snapshot.nonVehicleReferences).push(reference);
    continue;
  }
  if (!year || !model.children.length)
    throw new Error(`VW physical model has no year/trim references: ${model.nodeId}`);
  const expectedKeys: string[] = [];
  for (const group of model.children)
    for (const trim of group.children) {
      const source = await capture(
          vwCatalogueUrl(trim.category, trim.data.key),
          appKey ? { 'x-api-key': appKey } : {},
        ),
        factories = vwCatalogue(JSON.parse(source.text), trim.data.engines);
      for (const engine of trim.data.engines) {
        const key = engine.key,
          factory = factories.find(
            (factory) =>
              factory.code === key.modelId &&
              factory.year === key.modelYear &&
              factory.version === key.modelVersion,
          )!;
        // Keep technical comparison fields; full original groups remain in checksum-verified raw data.
        const technicalData = factory.technicalData
          .map((group) => ({
            ...group,
            values: group.values.filter((field) =>
              /^(?:Seating Capacity|Headroom|Legroom|Length|Width|Height|Cargo Volume|Net Horsepower|Horsepower|Fuel (?:City|Highway|Combined|Requirement)|Combined \(kWh|Range \(km|Charging Time)/i.test(
                field.description,
              ),
            ),
          }))
          .filter((group) => group.values.length);
        snapshot.records.push({
          modelNode: model.nodeId,
          trimNode: trim.nodeId,
          category: trim.category,
          key,
          trimName: trim.data.name,
          modelName: model.data.name,
          engineTypes: engine.engineTypes,
          gearTypes: engine.gearTypes,
          bodyTypes: engine.bodyTypes,
          driveType: engine.driveType,
          allWheelDrive: engine.allWheelDrive,
          source: source.source,
          factory: { ...factory, technicalData },
        });
        expectedKeys.push(vwKey(key));
      }
    }
  snapshot.models.push({
    nodeId: model.nodeId,
    name: model.data.name,
    year: Number(year),
    expectedKeys,
    configureEnabled: active.some((candidate) => candidate.nodeId === model.nodeId),
  });
  console.log(`${year} ${model.data.name}: ${expectedKeys.length} exact factory configurations.`);
}
snapshot.models.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
snapshot.records.sort((a, b) => vwKey(a.key).localeCompare(vwKey(b.key)));
const valid = validateVwSnapshot(snapshot),
  output = await format(JSON.stringify(valid), {
    ...(await resolveConfig(target)),
    filepath: target,
  });
if (offline) {
  if (output !== (await readFile(target, 'utf8')))
    throw new Error('VW offline reconstruction differs from the tracked snapshot.');
  console.log(
    `Verified original hashes/date for ${valid.records.length} Canadian factory configurations.`,
  );
} else {
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  if (!captured) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
