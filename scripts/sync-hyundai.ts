import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import {
  hyundaiClientUrl,
  hyundaiLineupUrl,
  hyundaiTrimsUrl,
  hyundaiPriceUrl,
  hyundaiFeaturesUrl,
  hyundaiTableUrl,
  hyundaiModels,
  hyundaiTrims,
  hyundaiExactPrice,
  hyundaiOptionEstimate,
  hyundaiFeaturesResponse,
  validateHyundaiSnapshot,
  hyundaiCaptureManifestSchema,
} from '../packages/car-catalog/src/hyundai-import.ts';
import type { HyundaiSnapshot } from '../packages/car-catalog/src/hyundai-import.ts';

const target = 'packages/car-catalog/data/manufacturers/hyundai.json',
  directory = 'data/raw/hyundai';
const offline = process.argv.includes('--offline');
const captureArgument = process.argv.indexOf('--from-captures');
if (offline && captureArgument >= 0)
  throw new Error('Choose offline reconstruction or captured-response import.');
const captures =
  captureArgument >= 0
    ? hyundaiCaptureManifestSchema.parse(
        JSON.parse(await readFile(process.argv[captureArgument + 1]!, 'utf8')),
      )
    : null;
const previous = offline
  ? validateHyundaiSnapshot(JSON.parse(await readFile(target, 'utf8')))
  : null;
const receipts = previous
  ? [
      previous.client,
      previous.lineup,
      ...previous.models.flatMap((model) => [model.source, model.specificationsReview.source]),
      ...previous.records.flatMap((record) => [record.priceSource, record.featuresSource]),
    ]
  : [];
await mkdir(directory, { recursive: true });
async function download(url: string, optional = false) {
  let bytes: Buffer | undefined,
    status = 200;
  if (offline || captures) {
    const source = (captures?.sources ?? receipts).find((source) => source.url === url);
    if (!source) throw new Error(`Missing offline Hyundai source: ${url}`);
    bytes = await readFile(`${directory}/${source.sha256}`);
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error('Offline Hyundai checksum mismatch.');
    status =
      captures?.sources.find((source) => source.url === url)?.status ??
      previous?.models.find((model) => model.specificationsReview.source.url === url)
        ?.specificationsReview.status ??
      200;
  } else {
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
      status = response.status;
      bytes = Buffer.from(await response.arrayBuffer());
      if (status < 500) break;
    }
  }
  if (!bytes || (status !== 200 && !optional))
    throw new Error(`Hyundai source HTTP ${status}: ${url}`);
  const source = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (!offline) await writeFile(`${directory}/${source.sha256}`, bytes);
  return { source, status, text: bytes.toString('utf8') };
}
const client = await download(hyundaiClientUrl);
for (const path of [
  'GetShowroomsModelJson',
  'getShowroomModelTrimsJson',
  'trimallpurchaseOptions',
  'getAllTrimFeatures',
])
  if (!client.text.includes(`/api/backendservice/buildandprice/${path}`))
    throw new Error('Hyundai public client contract changed; review source requests.');
const lineup = await download(hyundaiLineupUrl),
  models = hyundaiModels(JSON.parse(lineup.text));
const snapshot: HyundaiSnapshot = {
  schemaVersion: 1,
  retrievedAt: previous?.retrievedAt ?? captures?.retrievedAt ?? new Date().toISOString(),
  lineup: lineup.source,
  client: client.source,
  expectedModelIds: models.map((model) => model.modelId),
  models: [],
  trims: [],
  records: [],
};
let next = 0;
async function worker() {
  for (;;) {
    const model = models[next++];
    if (!model) return;
    const page = await download(hyundaiTrimsUrl(model.modelId)),
      trims = hyundaiTrims(JSON.parse(page.text), model);
    // This source uses presentation columns rather than factory trim IDs. Retain
    // the response/status for review; never guess a cross-powertrain column join.
    const table = await download(hyundaiTableUrl(model.modelId), true);
    snapshot.models.push({
      id: model.modelId,
      year: Number(model.vehicleYear),
      slug: model.modelNameCMS,
      name: model.vehicleName,
      source: page.source,
      expectedParentTrimIds: trims.map((trim) => trim.trimId),
      expectedTrimIds: trims.flatMap((trim) => trim.subTrims.map((sub) => sub.trimID)),
      specificationsReview: {
        source: table.source,
        status: table.status,
        reason:
          table.status === 200
            ? 'Model table uses presentation columns, including shared optional powertrains. Exact trim/column and measurement-mode reconciliation remains required; values are not guessed.'
            : `Official model specification endpoint returned HTTP ${table.status} after bounded retries. Dimensions, cargo, power and energy facts require exact-trim source review.`,
      },
    });
    for (const parent of trims) {
      snapshot.trims.push({
        modelId: model.modelId,
        id: parent.trimId,
        name: parent.trimName,
        expectedSubtrimIds: parent.subTrims.map((sub) => sub.trimID),
      });
      for (const sub of parent.subTrims) {
        const pricePage = await download(hyundaiPriceUrl(sub.trimID)),
          price = hyundaiExactPrice(JSON.parse(pricePage.text), sub.trimID);
        const featuresPage = await download(hyundaiFeaturesUrl(sub.trimID)),
          featureData = hyundaiFeaturesResponse.parse(JSON.parse(featuresPage.text)).data[0]!;
        if (featureData.trimName !== sub.trimName)
          throw new Error('Hyundai feature trim name mismatch.');
        const features = featureData.categories.flatMap((category) =>
          category.features
            .filter(
              (feature) =>
                /Performance/i.test(category.name) ||
                /\d[ -]*(?:passenger|seat(?:ing)? capacity)/i.test(feature.name),
            )
            .map((feature) => ({ section: category.name, name: feature.name.trim() })),
        );
        snapshot.records.push({
          modelId: model.modelId,
          year: Number(model.vehicleYear),
          modelSlug: model.modelNameCMS,
          modelName: model.vehicleName,
          parentTrimId: parent.trimId,
          trimId: sub.trimID,
          trimName: sub.trimName,
          trimSlug: sub.trimNameCMS,
          selectedOptions: sub.trimConfiguration.map((choice) => ({
            key: String(choice.key),
            name: choice.value,
          })),
          soldOut: parent.soldOut,
          msrpCad: price.msrp,
          optionEstimateCad: hyundaiOptionEstimate(parent, sub),
          priceTrimName: price.trimName,
          featuresTrimName: featureData.trimName,
          priceSource: pricePage.source,
          featuresSource: featuresPage.source,
          features,
        });
      }
    }
    console.log(
      `${model.modelNameCMS}: ${trims.flatMap((trim) => trim.subTrims).length} exact trims/packages; specification table HTTP ${table.status}, join review pending.`,
    );
  }
}
await Promise.all([worker(), worker(), worker()]);
snapshot.models.sort((a, b) => a.slug.localeCompare(b.slug));
snapshot.trims.sort((a, b) => a.id.localeCompare(b.id));
snapshot.records.sort((a, b) =>
  `${a.modelSlug}/${a.trimSlug}`.localeCompare(`${b.modelSlug}/${b.trimSlug}`),
);
const valid = validateHyundaiSnapshot(snapshot);
const output = await format(JSON.stringify(valid), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (output !== (await readFile(target, 'utf8')))
    throw new Error('Offline Hyundai reconstruction differs from the tracked snapshot.');
  console.log(
    `Offline reconstruction verified ${valid.records.length} configurations with original source hashes/date.`,
  );
} else {
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  console.log(`Saved ${valid.records.length} Hyundai Canadian configurations.`);
}
