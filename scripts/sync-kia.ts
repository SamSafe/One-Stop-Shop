import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import {
  kiaBuildPage,
  kiaLineupPage,
  kiaCommercialEvidence,
  kiaModels,
  kiaCanonical,
  kiaModelEvidence,
  kiaPublicPage,
  kiaUnitLabels,
  kiaRecords,
  kiaKey,
  validateKiaSnapshot,
} from '../packages/car-catalog/src/kia-import.ts';
import type { KiaSnapshot } from '../packages/car-catalog/src/kia-import.ts';

const target = 'packages/car-catalog/data/manufacturers/kia.json',
  directory = 'data/raw/kia';
const offline = process.argv.includes('--offline');
const previous = offline ? validateKiaSnapshot(JSON.parse(await readFile(target, 'utf8'))) : null;
const receipts = previous
  ? [
      previous.lineup,
      previous.build,
      ...previous.additionalModelEvidence.map((entry) => entry.source),
      ...previous.excludedModels.map((model) => model.source),
    ]
  : [];
await mkdir(directory, { recursive: true });
async function download(url: string) {
  let bytes: Buffer;
  if (offline) {
    const reference = receipts.find((reference) => reference.url === url);
    if (!reference) throw new Error(`Missing offline Kia source: ${url}`);
    bytes = await readFile(`${directory}/${reference.sha256}`);
    if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256)
      throw new Error('Offline Kia source checksum mismatch.');
  } else {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Kia source HTTP ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const source = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (!offline) await writeFile(`${directory}/${source.sha256}`, bytes);
  return { source, text: bytes.toString('utf8') };
}
const build = await download(kiaBuildPage),
  lineup = await download(kiaLineupPage);
const reference = kiaModels(build.text);
if (kiaCanonical(reference) !== kiaCanonical(kiaModels(lineup.text)))
  throw new Error('Kia lineup/build model data differ; review before replacement.');
const snapshot: KiaSnapshot = {
  schemaVersion: 1,
  retrievedAt: previous?.retrievedAt ?? new Date().toISOString(),
  build: build.source,
  lineup: lineup.source,
  units: kiaUnitLabels(build.text),
  expectedModelPaths: reference.models.map((model) => model.contentFragmentPath),
  groupedModelPaths: reference.groupedModelPaths,
  models: [],
  records: [],
  additionalModelEvidence: [],
  excludedModels: [],
};
for (const model of reference.models) {
  const records = kiaRecords(model);
  if (model.model === 'PV5') {
    if (
      model.year !== '2027' ||
      records.length !== 2 ||
      records.some((record) => record.dimensions.seating !== '2') ||
      records.some((record) => !['Basic', 'Plus'].includes(record.trimName))
    )
      throw new Error('Kia PV5 scope requires renewed review.');
    const evidence = await download(kiaCommercialEvidence);
    if (!evidence.text.includes('dedicated commercial cargo vehicle'))
      throw new Error('Kia commercial vehicle evidence changed.');
    snapshot.excludedModels.push({
      modelPath: model.contentFragmentPath,
      year: Number(model.year),
      name: model.model,
      expectedKeys: records.map(kiaKey),
      reason:
        'Kia identifies this two-seat PV5 as a dedicated commercial cargo vehicle. The current Canadian feed contains no passenger PV5 variant; commercial-only cargo vehicles are outside the confirmed passenger scope.',
      source: evidence.source,
    });
    continue;
  }
  if (!reference.groupedModelPaths.includes(model.contentFragmentPath)) {
    const page = await download(kiaPublicPage(model.vmpUrl));
    kiaModelEvidence(page.text, model);
    snapshot.additionalModelEvidence.push({
      modelPath: model.contentFragmentPath,
      source: page.source,
    });
  }
  snapshot.models.push({
    path: model.contentFragmentPath,
    year: Number(model.year),
    name: model.model,
    bodyType: model.bodyType,
    engineType: model.engineType,
    defaultYear: model.defaultYear,
    specsUrl: kiaPublicPage(model.specsPageUrl),
    expectedKeys: records.map(kiaKey),
  });
  snapshot.records.push(...records);
  console.log(`${model.year} ${model.model}: ${records.length} factory trims/packages.`);
}
snapshot.models.sort((a, b) => a.path.localeCompare(b.path));
snapshot.records.sort((a, b) => kiaKey(a).localeCompare(kiaKey(b)));
const valid = validateKiaSnapshot(snapshot);
const output = await format(JSON.stringify(valid), {
  ...(await resolveConfig(target)),
  filepath: target,
});
if (offline) {
  if (output !== (await readFile(target, 'utf8')))
    throw new Error('Offline Kia reconstruction differs from the tracked snapshot.');
  console.log(
    `Offline reconstruction verified ${valid.records.length} configurations with original source hashes/date.`,
  );
} else {
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  console.log(
    `Saved ${valid.records.length} Kia Canadian configurations; ${valid.excludedModels.length} commercial-only model excluded with primary evidence.`,
  );
}
