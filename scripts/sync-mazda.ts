import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import {
  mazdaBuildPage,
  mazdaLineupUrl,
  mazdaApiUrl,
  mazdaSpecsUrl,
  mazdaYearsResponse,
  mazdaTrimsResponse,
  mazdaEnginesResponse,
  mazdaValidateYear,
  mazdaEngineIdentities,
  mazdaPackageChoices,
  mazdaSpecifications,
  validateMazdaSnapshot,
} from '../packages/car-catalog/src/mazda-import.ts';
import type { MazdaSnapshot } from '../packages/car-catalog/src/mazda-import.ts';

const target = 'packages/car-catalog/data/manufacturers/mazda.json',
  directory = 'data/raw/mazda';
const offline = process.argv.includes('--offline');
const previous = offline ? validateMazdaSnapshot(JSON.parse(await readFile(target, 'utf8'))) : null;
const receipts = previous
  ? [
      previous.client,
      previous.lineup,
      ...previous.modelYears.map((year) => year.source),
      ...previous.trims.map((trim) => trim.enginesSource),
      ...previous.engines.map((engine) => engine.source),
      ...previous.records.map((record) => record.specificationsSource),
    ]
  : [];
await mkdir(directory, { recursive: true });
async function download(url: string, configuration?: string) {
  let bytes: Buffer;
  if (offline) {
    const reference = configuration
      ? previous!.records.find(
          (record) => `${record.modelCode}/${record.optionCode}` === configuration,
        )?.specificationsSource
      : receipts.find((source) => source.url === url);
    if (!reference) throw new Error(`Missing offline Mazda source: ${url}`);
    bytes = await readFile(`${directory}/${reference.sha256}`);
    if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256)
      throw new Error('Offline Mazda source checksum mismatch.');
  } else {
    const response = await fetch(url, {
      method: configuration ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: configuration ? JSON.stringify({ cars: [configuration] }) : undefined,
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Mazda source HTTP ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const source = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (!offline) await writeFile(`${directory}/${source.sha256}`, bytes);
  return { source, text: bytes.toString('utf8') };
}
let client;
if (previous) {
  const script = await download(previous.client.url);
  if (
    !script.text.includes('n8xgyscaa3.execute-api.ca-central-1.amazonaws.com/prod') ||
    !script.text.includes('/api/ModelYears')
  )
    throw new Error('Mazda client API source changed; review the source contract.');
  client = script.source;
} else {
  const page = await (await fetch(mazdaBuildPage, { signal: AbortSignal.timeout(45000) })).text();
  const path = page.match(
    /src="(\/globalassets\/mazda-canada\/react\/buildandprice\/js\/main\.[^"]+\.js)"/,
  )?.[1];
  if (!path) throw new Error('Mazda public client is missing.');
  const script = await download(`https://www.mazda.ca${path}`);
  if (
    !script.text.includes('n8xgyscaa3.execute-api.ca-central-1.amazonaws.com/prod') ||
    !script.text.includes('/api/ModelYears')
  )
    throw new Error('Mazda client API source changed; review the source contract.');
  client = script.source;
}
const lineup = await download(mazdaLineupUrl),
  listed = mazdaYearsResponse.parse(JSON.parse(lineup.text)).data.model_years;
const selected = listed.filter((year) => year.show_bnp && !year.is_legacy);
const snapshot: MazdaSnapshot = {
  schemaVersion: 1,
  retrievedAt: previous?.retrievedAt ?? new Date().toISOString(),
  lineup: lineup.source,
  client,
  expectedModelYearIds: selected.map((year) => year.id),
  excludedModelYears: listed
    .filter((year) => !selected.includes(year))
    .map((year) => ({
      id: year.id,
      year: Number(year.year.url_slug),
      carline: year.carline.url_slug,
      reason:
        'Not offered by the current build tool. Remaining new dealer inventory requires separate reconciliation; this is not proof of discontinuation.',
    })),
  modelYears: [],
  trims: [],
  engines: [],
  records: [],
};
let next = 0;
async function worker() {
  for (;;) {
    const year = selected[next++];
    if (!year) return;
    const trimsPage = await download(
      mazdaApiUrl('Trims', year.year.url_slug, year.carline.url_slug),
    );
    const trimData = mazdaTrimsResponse.parse(JSON.parse(trimsPage.text)).data;
    mazdaValidateYear(trimData.model_year, year);
    snapshot.modelYears.push({
      id: year.id,
      year: Number(year.year.url_slug),
      carline: year.carline.url_slug,
      name: year.carline.title,
      bodyDescription: year.description,
      comingSoon: year.is_coming_soon,
      electric: year.is_ev,
      source: trimsPage.source,
      expectedTrimIds: trimData.trims.map((trim) => trim.id),
    });
    let count = 0;
    for (const trim of trimData.trims) {
      const enginesPage = await download(
        mazdaApiUrl(
          'EngineModels',
          year.year.url_slug,
          year.carline.url_slug,
          trim.trim_type.url_slug,
        ),
      );
      const engineData = mazdaEnginesResponse.parse(JSON.parse(enginesPage.text)).data;
      mazdaValidateYear(engineData.model_year, year);
      if (
        engineData.trim.id !== trim.id ||
        engineData.trim.trim_type.url_slug !== trim.trim_type.url_slug
      )
        throw new Error('Mazda engine trim identity mismatch.');
      snapshot.trims.push({
        modelYearId: year.id,
        trimId: trim.id,
        slug: trim.trim_type.url_slug,
        name: trim.trim_type.name,
        source: trimsPage.source,
        enginesSource: enginesPage.source,
        expectedEngineKeys: mazdaEngineIdentities(engineData.models),
      });
      for (const engine of engineData.models) {
        const page = await download(mazdaApiUrl('Packages', engine.model_code, engine.option_code));
        const packages = mazdaPackageChoices(
          JSON.parse(page.text),
          year,
          trim.trim_type.url_slug,
          engine,
        );
        snapshot.engines.push({
          modelYearId: year.id,
          trimId: trim.id,
          modelCode: engine.model_code,
          baseOptionCode: engine.option_code,
          sourceTrimSlug: packages.sourceTrimSlug,
          source: page.source,
          expectedOptionKeys: packages.choices.map(
            (option) => `${option.modelCode}/${option.optionCode}`,
          ),
          excludedOptions: packages.excluded,
        });
        for (const option of packages.choices) {
          const specs = await download(mazdaSpecsUrl, `${option.modelCode}/${option.optionCode}`);
          const specData = mazdaSpecifications(JSON.parse(specs.text), {
            year,
            trimId: trim.id,
            trimSlug: trim.trim_type.url_slug,
            sourceTrimSlug: packages.sourceTrimSlug,
            modelCode: option.modelCode,
            optionCode: option.optionCode,
          });
          snapshot.records.push({
            year: Number(year.year.url_slug),
            carline: year.carline.url_slug,
            modelYearId: year.id,
            modelName: year.carline.title,
            trimId: trim.id,
            trimSlug: trim.trim_type.url_slug,
            trimName: trim.trim_type.name,
            sourceTrimSlug: packages.sourceTrimSlug,
            specificationsTrimId: specData.trimId,
            modelId: option.modelId,
            modelCode: option.modelCode,
            baseOptionCode: engine.option_code,
            optionCode: option.optionCode,
            packageName: option.packageName,
            engine: engine.engine.label,
            transmission: engine.transmission.label.trim(),
            transmissionShort: engine.transmission.short_description.trim(),
            drivetrain: engine.drivetrain.label,
            msrpCad: option.msrpCad,
            priceSource: page.source,
            specificationsSource: specs.source,
            specifications: specData.rows,
          });
          count++;
        }
      }
    }
    console.log(
      `${year.title}: ${count} exact factory configurations${year.is_coming_soon ? ' (source flags coming soon; availability requires review)' : ''}.`,
    );
  }
}
await Promise.all([worker(), worker(), worker()]);
for (const key of ['modelYears', 'trims', 'engines', 'records'] as const)
  snapshot[key].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
if (!offline) {
  const recheck = mazdaYearsResponse
    .parse(JSON.parse((await download(mazdaLineupUrl)).text))
    .data.model_years.filter((year) => year.show_bnp && !year.is_legacy);
  if (
    JSON.stringify(recheck.map((year) => year.id).sort()) !==
    JSON.stringify([...snapshot.expectedModelYearIds].sort())
  )
    throw new Error('Mazda lineup changed during capture.');
}
const validated = validateMazdaSnapshot(snapshot);
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(validated), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved ${validated.records.length} Mazda factory configurations. Older new stock and conflicting coming-soon flags still require reconciliation.`,
);
