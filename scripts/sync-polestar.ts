import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import { z } from 'zod';
import {
  polestarChoiceTypes,
  polestarConfiguration,
  polestarConfigurationKey,
  polestarFeatures,
  polestarInit,
  polestarInitUrl,
  polestarInventory,
  polestarInventoryRequest,
  polestarPartitionIdentities,
  polestarPartitionTypes,
  polestarStockIdentity,
  polestarLineup,
  polestarLineupUrl,
  polestarRetailers,
  polestarRetailersRequest,
  polestarSelectorUrl,
  polestarStockUrl,
  polestarTransitionUrl,
  validatePolestarSnapshot,
} from '../packages/car-catalog/src/polestar-import.ts';
import type {
  PolestarReceipt,
  PolestarSnapshot,
  PolestarPartition,
  PolestarFilter,
} from '../packages/car-catalog/src/polestar-import.ts';
import { addPolestarRetail } from '../packages/car-catalog/src/polestar.ts';

const directory = 'data/raw/polestar',
  target = 'packages/car-catalog/data/manufacturers/polestar.json';
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
        .optional(),
    }),
  ),
});
const offline = process.argv.includes('--offline'),
  argument = process.argv.indexOf('--from-captures'),
  captured = offline || argument >= 0;
const manifest = captured
  ? manifestSchema.parse(
      JSON.parse(
        await readFile(
          argument >= 0 ? process.argv[argument + 1]! : `${directory}/capture-manifest.json`,
          'utf8',
        ),
      ),
    )
  : { retrievedAt: new Date().toISOString(), sources: [] as PolestarReceipt[] };
await mkdir(directory, { recursive: true });
async function capture(url: string, request?: unknown) {
  const body = request ? JSON.stringify(request) : undefined,
    requestSha256 = body ? hash(body) : undefined;
  let bytes: Buffer;
  if (captured) {
    const source = manifest.sources.find(
      (source) => source.url === url && source.requestSha256 === requestSha256,
    );
    if (!source) throw new Error(`Missing Polestar capture: ${url} (${requestSha256 ?? 'GET'})`);
    bytes = await readFile(`${directory}/${source.sha256}`);
    if (hash(bytes) !== source.sha256) throw new Error('Polestar capture checksum mismatch.');
    if (body) {
      const saved = await readFile(`${directory}/${requestSha256}`);
      if (hash(saved) !== requestSha256 || saved.toString('utf8') !== body)
        throw new Error('Polestar request checksum mismatch.');
    }
  } else {
    const response = await fetch(url, {
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body } : {}),
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Polestar HTTP ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(`${directory}/${hash(bytes)}`, bytes);
    if (body) await writeFile(`${directory}/${requestSha256}`, body);
    manifest.sources.push({
      url,
      sha256: hash(bytes),
      ...(requestSha256 ? { requestSha256 } : {}),
    });
  }
  return {
    source: {
      url,
      sha256: hash(bytes),
      ...(requestSha256 ? { requestSha256 } : {}),
    } satisfies PolestarReceipt,
    text: bytes.toString('utf8'),
  };
}
const lineup = await capture(polestarLineupUrl),
  selector = await capture(polestarSelectorUrl);
const slugs = polestarLineup(lineup.text);
if (JSON.stringify(slugs) !== JSON.stringify(polestarLineup(selector.text)))
  throw new Error('Polestar Canadian lineup/configure links disagree.');
const retailerResponse = await capture(polestarStockUrl, polestarRetailersRequest());
const snapshot: PolestarSnapshot = {
  schemaVersion: 2,
  retrievedAt: manifest.retrievedAt,
  lineupSources: [lineup.source, selector.source],
  currentModelSlugs: slugs,
  models: [],
  factoryRecords: [],
  transitions: [],
  retailersSource: retailerResponse.source,
  retailers: polestarRetailers(JSON.parse(retailerResponse.text)),
  inventories: [],
  stockVehicles: [],
};
for (const slug of slugs) {
  const response = await capture(polestarInitUrl(slug)),
    initial = polestarInit(JSON.parse(response.text), slug);
  snapshot.models.push({ slug, source: response.source, initial });
  const queue = [{ configuration: initial.configuration, source: response.source }],
    seen = new Set<string>(),
    responses = new Map<string, Awaited<ReturnType<typeof capture>>>();
  while (queue.length) {
    const row = queue.shift()!,
      key = polestarConfigurationKey(row.configuration);
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > 200)
      throw new Error(
        'Polestar feature expansion exceeded the reviewed bound; review new ordering combinations.',
      );
    snapshot.factoryRecords.push({ modelSlug: slug, ...row });
    for (const choice of polestarFeatures(row.configuration).filter(
      (choice) => polestarChoiceTypes.includes(choice.type) && choice.transitionState,
    )) {
      const url = polestarTransitionUrl(row.configuration, choice.transitionState!);
      let response = responses.get(url);
      if (!response) {
        response = await capture(url);
        responses.set(url, response);
      }
      const payload = JSON.parse(response.text);
      if (payload.errors?.length) throw new Error('Polestar configuration returned errors.');
      const configuration = polestarConfiguration(
        payload.configuration,
        initial.configuration.model,
      );
      const next = polestarConfigurationKey(configuration);
      snapshot.transitions.push({
        modelSlug: slug,
        from: key,
        feature: `${choice.type}/${choice.code}`,
        to: next,
        source: response.source,
      });
      if (!seen.has(next)) queue.push({ configuration, source: response.source });
    }
  }
  console.log(`${slug}: ${seen.size} motor/pack/single-option configurations`);
}
const sharedVehicles = new Map<string, PolestarSnapshot['stockVehicles'][number]>();
for (const retailer of snapshot.retailers) {
  for (const model of snapshot.models) {
    const modelCode = model.initial.configuration.model.pno3;
    let filterGroups: PolestarSnapshot['inventories'][number]['filterGroups'] = [];
    const bindings: PolestarSnapshot['inventories'][number]['records'] = [];
    let calls = 0;
    async function partition(
      filters: PolestarFilter[] = [],
      depth = 0,
    ): Promise<PolestarPartition> {
      if (++calls > 500) throw new Error('Polestar partition count exceeds the reviewed bound.');
      const response = await capture(
        polestarStockUrl,
        polestarInventoryRequest(retailer.partnerId, modelCode, 1, filters, depth === 0),
      );
      const data = polestarInventory(JSON.parse(response.text), { modelCode, pageNo: 1 });
      if (depth === 0)
        filterGroups = (data.validFilters ?? []).filter((group) =>
          polestarPartitionTypes.includes(group.featureType),
        );
      const result: PolestarPartition = {
        filters,
        total: data.pagination.totalRecords,
        observed: data.filterResults.map(polestarStockIdentity),
        source: response.source,
        splitFilterId: null,
        children: [],
      };
      if (result.total <= 10) {
        polestarPartitionIdentities(result, filterGroups, filters);
        for (const vehicle of data.filterResults) {
          const identity = polestarStockIdentity(vehicle),
            normalized = {
              ...vehicle,
              earliestDeliveryDateLabel: null,
              content: vehicle.content.filter((field) => field.featureType !== 'DeliveryDate'),
            };
          const existing = sharedVehicles.get(identity);
          if (existing && JSON.stringify(existing) !== JSON.stringify(normalized))
            throw new Error('Polestar shared stock evidence conflicts across retailers.');
          if (!existing) sharedVehicles.set(identity, normalized);
          bindings.push({
            identity,
            source: response.source,
            deliveryLabel: vehicle.earliestDeliveryDateLabel,
          });
        }
      } else {
        const group = filterGroups.find(
          (group) => group.featureType === polestarPartitionTypes[depth],
        );
        if (!group?.filterValues.length)
          throw new Error('Polestar inventory needs additional disjoint filter partitions.');
        result.splitFilterId = group.filterTypeId;
        for (const value of group.filterValues)
          result.children.push(
            await partition(
              [...filters, { filterTypeId: group.filterTypeId, code: value.featureCode }],
              depth + 1,
            ),
          );
        polestarPartitionIdentities(result, filterGroups, filters);
      }
      return result;
    }
    const tree = await partition();
    const inventory: PolestarSnapshot['inventories'][number] = {
      retailerId: retailer.partnerId,
      modelCode,
      total: tree.total,
      filterGroups,
      partition: tree,
      records: bindings,
    };
    snapshot.inventories.push(inventory);
    console.log(
      `${retailer.name} / ${modelCode}: ${inventory.total} distinct configurations in ${calls} source partitions`,
    );
  }
}
snapshot.stockVehicles = [...sharedVehicles.values()];
if (!captured)
  await writeFile(
    `${directory}/review-capture-manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
const valid = validatePolestarSnapshot(snapshot);
addPolestarRetail(
  {
    schemaVersion: 1,
    reviewedAt: valid.retrievedAt.slice(0, 10),
    scope: 'Canadian Polestar source validation',
    pricingNote: 'Exact equipped factory MSRP before delivery, taxes and incentives.',
    sources: [],
    cars: [],
  },
  valid,
);
const serialized = await format(JSON.stringify(valid), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (serialized !== (await readFile(target, 'utf8')))
    throw new Error('Offline Polestar snapshot differs; inspect captures before replacement.');
  console.log(
    `Verified offline Polestar reconstruction: ${valid.factoryRecords.length} factory configurations.`,
  );
} else {
  await writeFile(`${target}.tmp`, serialized);
  await rename(`${target}.tmp`, target);
  if (!captured)
    await writeFile(`${directory}/capture-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${target}`);
}
