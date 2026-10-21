import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { format, resolveConfig } from 'prettier';
import {
  hondaModels,
  hondaLineupUrl,
  hondaPricingApiUrl,
  hondaSpecificationsUrl,
  hondaPriceEntries,
  hondaSpecsResponseSchema,
  hondaSelectedSpecifications,
  hondaConfigurationKey,
  validateHondaSnapshot,
} from '../packages/car-catalog/src/honda-import.ts';
import type {
  HondaBrand,
  HondaRecord,
  HondaSnapshot,
} from '../packages/car-catalog/src/honda-import.ts';

const target = 'packages/car-catalog/data/manufacturers/honda.json';
const rawDirectory = 'data/raw/honda';
const offline = process.argv.includes('--offline');
const previous = offline ? validateHondaSnapshot(JSON.parse(await readFile(target, 'utf8'))) : null;
const receipts = previous
  ? [
      ...previous.brands.map((brand) => brand.source),
      ...previous.records.flatMap((record) => [record.pricingSource, record.specificationsSource]),
    ]
  : [];
await mkdir(rawDirectory, { recursive: true });
async function download(url: string, body?: { modelKey: string; modelYear: string }[]) {
  let bytes: Buffer;
  if (offline) {
    const reference = receipts.find(
      (receipt) =>
        receipt.url === url &&
        (!body ||
          previous!.records.some(
            (record) =>
              record.pricingSource.sha256 === receipt.sha256 &&
              record.modelKey === body[0]!.modelKey &&
              record.year === Number(body[0]!.modelYear),
          )),
    );
    if (!reference) throw new Error(`Missing offline source: ${url}`);
    bytes = await readFile(`${rawDirectory}/${reference.sha256}`);
    if (createHash('sha256').update(bytes).digest('hex') !== reference.sha256)
      throw new Error('Offline source checksum mismatch.');
  } else {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45000),
    });
    if (!response.ok) throw new Error(`Honda source HTTP ${response.status}: ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const source = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
  if (!offline) await writeFile(`${rawDirectory}/${source.sha256}`, bytes);
  return { source, text: bytes.toString('utf8') };
}
const brands: HondaSnapshot['brands'] = [];
const models: HondaSnapshot['models'] = [];
const records: HondaRecord[] = [];
for (const brand of ['honda', 'acura'] as HondaBrand[]) {
  const lineup = await download(hondaLineupUrl(brand));
  const listed = hondaModels(lineup.text, brand);
  brands.push({ brand, source: lineup.source, expectedModels: listed.map((model) => model.key) });
  for (const model of listed) {
    models.push({
      brand,
      key: model.key,
      name: model.name,
      years: model.years.map((year) => ({
        year: year.year,
        announced: year.announced,
        excludedProvinces: year.excludedProvinces,
        expectedTrimIds: year.trims.map((trim) => trim.id),
        expectedConfigurationKeys: year.trims.flatMap((trim) =>
          trim.transmissions.map((transmission) =>
            hondaConfigurationKey({ trimKey: trim.key, transmissionKey: transmission.key }),
          ),
        ),
        pricingOnlyConfigurationKeys: [],
      })),
    });
    for (const year of model.years) {
      const price = await download(hondaPricingApiUrl(brand), [
        { modelKey: model.key, modelYear: String(year.year) },
      ]);
      const offered = hondaPriceEntries(
        JSON.parse(price.text),
        model.key,
        year.trims.flatMap((trim) =>
          trim.transmissions.map((transmission) => ({
            trimId: trim.id,
            trimKey: trim.key,
            transmissionId: transmission.id,
          })),
        ),
      );
      for (const trim of year.trims) {
        const specs = await download(hondaSpecificationsUrl(brand, trim.id));
        const specifications = hondaSpecsResponseSchema.parse(JSON.parse(specs.text));
        const pricedTrim = offered.find(
          (row) => row.Id === Number(trim.id) && row.Key === trim.key,
        );
        for (const transmission of trim.transmissions) {
          const priced = pricedTrim?.Transmissions.find(
            (row) => row.Id === Number(transmission.id),
          );
          records.push({
            brand,
            modelKey: model.key,
            modelName: model.name,
            year: year.year,
            trimId: trim.id,
            trimKey: trim.key,
            trimName: trim.name,
            transmissionId: transmission.id,
            transmissionKey: transmission.key,
            transmissionName: transmission.name,
            modelCode: transmission.code,
            buildable: transmission.buildable,
            announced: year.announced || trim.announced,
            excludedProvinces: [...new Set([...year.excludedProvinces, ...trim.excludedProvinces])],
            bodyTags: trim.bodyTags,
            msrpCad: priced && priced.Msrp > 0 ? priced.Msrp : null,
            pricingTransmissionKey: priced?.Key ?? null,
            pricingSource: price.source,
            specificationsSource: specs.source,
            specifications: hondaSelectedSpecifications(specifications),
          });
        }
      }
      const pricedKeys = offered.flatMap((trim) =>
        trim.Transmissions.map((transmission) =>
          hondaConfigurationKey({ trimKey: trim.Key, transmissionKey: transmission.Key }),
        ),
      );
      const yearReceipt = models.at(-1)!.years.find((row) => row.year === year.year)!;
      const expected = yearReceipt.expectedConfigurationKeys;
      const listedPricingKeys = records
        .filter(
          (record) =>
            record.brand === brand &&
            record.modelKey === model.key &&
            record.year === year.year &&
            record.pricingTransmissionKey !== null,
        )
        .map((record) =>
          hondaConfigurationKey({
            trimKey: record.trimKey,
            transmissionKey: record.pricingTransmissionKey!,
          }),
        );
      yearReceipt.pricingOnlyConfigurationKeys = pricedKeys.filter(
        (key) => !listedPricingKeys.includes(key),
      );
      console.log(
        `${brand} ${model.name} ${year.year}: ${expected.length} configurations, ${pricedKeys.length} pricing entries`,
      );
    }
  }
  if (!offline) {
    const recheck = hondaModels((await download(hondaLineupUrl(brand))).text, brand);
    if (JSON.stringify(recheck) !== JSON.stringify(listed))
      throw new Error(`Honda lineup changed during capture: ${brand}`);
  }
}
const snapshot = validateHondaSnapshot({
  schemaVersion: 1,
  retrievedAt: previous?.retrievedAt ?? new Date().toISOString(),
  brands,
  models,
  records,
});
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(snapshot), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved ${snapshot.records.length} Honda/Acura configurations. Dealer inventory and model cards without current years still require review.`,
);
