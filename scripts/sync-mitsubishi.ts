import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { z } from 'zod';
import { format, resolveConfig } from 'prettier';
import {
  mitsubishiSelectorUrl,
  mitsubishiStartUrl,
  mitsubishiGraphqlUrl,
  mitsubishiInventoryUrl,
  mitsubishiOrigin,
  mitsubishiApollo,
  mitsubishiLineup,
  mitsubishiRequest,
  mitsubishiModels,
  mitsubishiInventory,
  mitsubishiModelKey,
  mitsubishiSpecifications,
  validateMitsubishiSnapshot,
} from '../packages/car-catalog/src/mitsubishi-import.ts';
import type {
  MitsubishiSnapshot,
  MitsubishiReceipt,
} from '../packages/car-catalog/src/mitsubishi-import.ts';

const directory = 'data/raw/mitsubishi',
  target = 'packages/car-catalog/data/manufacturers/mitsubishi.json';
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(
    z.object({
      url: z.url(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      requestSha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .nullable(),
    }),
  ),
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
async function capture(url: string, request: unknown = null) {
  const body = request ? JSON.stringify(request) : null,
    requestSha256 = body ? hash(body) : null;
  let bytes: Buffer;
  if (captured) {
    const source = manifest.sources.find(
      (source) => source.url === url && source.requestSha256 === requestSha256,
    );
    if (!source) throw new Error(`Missing Mitsubishi capture: ${url} (${requestSha256 ?? 'GET'})`);
    bytes = await readFile(`${directory}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error('Mitsubishi capture checksum mismatch.');
  } else {
    const response = await fetch(url, {
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body } : {}),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Mitsubishi source HTTP ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    const sha256 = hash(bytes);
    await writeFile(`${directory}/${sha256}`, bytes);
    manifest.sources.push({ url, sha256, requestSha256 });
  }
  return {
    source: { url, sha256: hash(bytes), requestSha256 } satisfies MitsubishiReceipt,
    text: bytes.toString('utf8'),
  };
}
const selector = await capture(mitsubishiSelectorUrl),
  start = await capture(mitsubishiStartUrl),
  families = mitsubishiLineup(selector.text, start.text);
const nav = mitsubishiApollo(selector.text)
  .byType('Vehicle')
  .filter((value): value is { code: string; name: string; cta: { url: string } } =>
    Boolean(
      value &&
      typeof value === 'object' &&
      typeof (value as Record<string, unknown>).code === 'string' &&
      /^20\d{2} /.test(String((value as Record<string, unknown>).name)),
    ),
  );
const snapshot: MitsubishiSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  selectorSource: selector.source,
  startSource: start.source,
  inventorySources: [],
  inventoryReferences: [],
  currentModelKeys: families.flatMap((family) =>
    family.yearList.map((year) => mitsubishiModelKey(family.vehicleCode, year)),
  ),
  models: [],
  records: [],
  inventoryGaps: [],
};
const inventory = [];
let last = 1,
  count = 0;
for (let page = 1; page <= last; page++) {
  const url = new URL(mitsubishiInventoryUrl);
  url.searchParams.set('page', String(page));
  const source = await capture(url.href),
    parsed = mitsubishiInventory(JSON.parse(source.text));
  if (parsed.current !== page || (page > 1 && parsed.count !== count))
    throw new Error('Mitsubishi inventory pagination mismatch.');
  last = parsed.last;
  count = parsed.count;
  inventory.push(...parsed.results);
  snapshot.inventorySources.push(source.source);
}
if (
  inventory.length !== count ||
  new Set(inventory.map((row) => `${row.model}/${row.year}`)).size !== count
)
  throw new Error('Mitsubishi inventory model-year count mismatch.');
snapshot.inventoryReferences = inventory;
const work = families.flatMap((family) =>
  family.vehicleInfo.map((info) => ({
    family,
    year: info.year,
    expectedCodes: info.activeModelCodes,
    current: true,
  })),
);
const nameByCode = new Map<string, string>();
for (const row of work) {
  const vehicle = nav.find(
    (vehicle) => vehicle.code === row.family.vehicleCode && vehicle.name.startsWith(`${row.year} `),
  );
  if (!vehicle)
    throw new Error('Mitsubishi current vehicle has no matching Canadian navigation reference.');
  nameByCode.set(row.family.vehicleCode, vehicle.name.replace(/^20\d{2}\s+/, ''));
}
for (const reference of inventory) {
  const family = families.find(
    (family) => nameByCode.get(family.vehicleCode)?.toLowerCase() === reference.model.toLowerCase(),
  );
  if (!family)
    throw new Error(
      `Additional Mitsubishi inventory family needs identity review: ${reference.model}`,
    );
  if (!work.some((row) => row.family === family && row.year === reference.year))
    work.push({ family, year: reference.year, expectedCodes: [], current: false });
}
for (const row of work) {
  const { family, year, current } = row,
    key = mitsubishiModelKey(family.vehicleCode, year),
    inventoryReference =
      inventory.find(
        (reference) =>
          reference.year === year &&
          reference.model.toLowerCase() === nameByCode.get(family.vehicleCode)?.toLowerCase(),
      ) ?? null;
  const response = await capture(mitsubishiGraphqlUrl, mitsubishiRequest(family.vehicleGuid, year));
  let data: ReturnType<typeof mitsubishiModels>;
  try {
    data = mitsubishiModels(JSON.parse(response.text), {
      vehicleCode: family.vehicleCode,
      year,
      ...(current ? { expectedCodes: row.expectedCodes } : {}),
    });
  } catch (error) {
    if (
      current ||
      !inventoryReference ||
      !(error instanceof Error) ||
      !error.message.startsWith('Mitsubishi model query failed:')
    )
      throw error;
    snapshot.inventoryGaps.push({
      reference: inventoryReference,
      source: response.source,
      reason: `The new-inventory feed lists this model year, but the exact Canadian factory query failed: ${error.message}. Retail identities/prices/stock require reconciliation; no other year is substituted.`,
    });
    continue;
  }
  const navReference = nav.find(
    (vehicle) => vehicle.code === family.vehicleCode && vehicle.name.startsWith(`${year} `),
  );
  const canonicalName =
    data.vehicleInfo.name.toLowerCase() === 'outlander' ? 'Outlander' : data.vehicleInfo.name;
  let specifications: ReturnType<typeof mitsubishiSpecifications> = [],
    specSource: MitsubishiReceipt | null = null;
  if (current) {
    if (!navReference) throw new Error('Missing required Mitsubishi specification link.');
    const url = new URL(navReference.cta.url, mitsubishiOrigin);
    if (url.origin !== mitsubishiOrigin || !url.pathname.startsWith('/en/vehicles/'))
      throw new Error('Mitsubishi specification source origin/path mismatch.');
    url.pathname += '/specs';
    const source = await capture(url.href);
    specSource = source.source;
    specifications = mitsubishiSpecifications(source.text, {
      name: canonicalName,
      year,
      models: data.models,
    });
  }
  snapshot.models.push({
    key,
    vehicleCode: family.vehicleCode,
    vehicleGuid: family.vehicleGuid,
    name: canonicalName,
    year,
    currentBuildListing: current,
    expectedCodes: data.models.map((model) => model.code),
    priceSource: response.source,
    specificationsSource: specSource,
    inventoryReference,
  });
  for (const model of data.models) {
    const spec = specifications.find((spec) => spec.code === model.code);
    snapshot.records.push({
      modelKey: key,
      model,
      specification:
        spec && specSource
          ? {
              source: specSource,
              name: spec.name,
              priceCad: spec.price.value,
              fields: spec.specifications.filter((field) =>
                /^(?:Horsepower|Motor Power Output|Estimated Consumption|EV Range|Total Driving Range|Combined \(Gas|City\/Highway|Charging time|240V|Length|Width|Height|Cargo volume|Head.?room|Leg.?room)/i.test(
                  field.label,
                ),
              ),
            }
          : null,
      specificationGap: spec
        ? null
        : 'This model year appears in the new-inventory feed but is absent from the current build selector/specification routes. Exact historical technical fields and individual trim stock need review; another model year is not copied.',
    });
  }
  console.log(
    `${year} ${canonicalName}: ${data.models.length} exact factory trims, ${current ? 'current build listing' : 'inventory family only; trim availability unchecked'}.`,
  );
}
snapshot.models.sort((a, b) => a.key.localeCompare(b.key));
snapshot.records.sort((a, b) =>
  `${a.modelKey}/${a.model.code}`.localeCompare(`${b.modelKey}/${b.model.code}`),
);
const valid = validateMitsubishiSnapshot(snapshot),
  output = await format(JSON.stringify(valid), {
    ...(await resolveConfig(target)),
    filepath: target,
  });
if (offline) {
  if (output !== (await readFile(target, 'utf8')))
    throw new Error('Mitsubishi offline reconstruction differs from the tracked snapshot.');
  console.log(`Verified original hashes/date for ${valid.records.length} Canadian factory trims.`);
} else {
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  if (!captured) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
