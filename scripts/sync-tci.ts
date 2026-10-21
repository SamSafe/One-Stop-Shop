import { createHash } from 'node:crypto';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import {
  tciListedSeries,
  tciModelReferences,
  tciModelResponseSchema,
  tciPackageResponseSchema,
  tciRulesResponseSchema,
  tciSeriesUrl,
  tciYearsUrl,
  tciUrl,
  pickTciDimensions,
  validateTciSnapshot,
  tciModelDefinition,
  tciAliasPackages,
} from '../packages/car-catalog/src/tci-import.ts';
import type { TciBrand, TciSnapshot } from '../packages/car-catalog/src/tci-import.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const rawDirectory = path.join(root, 'data/raw/tci');
await mkdir(rawDirectory, { recursive: true });
const target = path.join(root, 'packages/car-catalog/data/manufacturers/tci.json');
const capture = process.argv.includes('--offline')
  ? validateTciSnapshot(JSON.parse(await readFile(target, 'utf8')))
  : null;
const capturedSources = new Map(
  (capture
    ? [
        ...capture.brands.map((brand) => brand.source),
        ...capture.series.flatMap((series) => [series.source, series.rulesSource]),
        ...capture.models.map((model) => model.source),
        ...capture.records.map((record) => record.source),
      ]
    : []
  ).map((source) => [source.url, source]),
);
const result: TciSnapshot = {
  schemaVersion: 1,
  retrievedAt: capture?.retrievedAt ?? new Date().toISOString(),
  brands: [],
  series: [],
  models: [],
  records: [],
  gaps: [],
};
async function download(url: string) {
  if (capture) {
    const source = capturedSources.get(url);
    if (!source) throw new Error(`Source was not captured: ${url}`);
    const bytes = await readFile(path.join(rawDirectory, `${source.sha256}.json`));
    if (createHash('sha256').update(bytes).digest('hex') !== source.sha256)
      throw new Error(`Captured source checksum mismatch: ${url}`);
    return { data: JSON.parse(bytes.toString('utf8')) as unknown, source };
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': 'OSS Canadian vehicle catalog research (local development)' },
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`TCI HTTP ${response.status}: ${url}. Snapshot not replaced.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(path.join(rawDirectory, `${sha256}.json`), bytes);
  return { data: JSON.parse(bytes.toString('utf8')) as unknown, source: { url, sha256 } };
}
async function batch<T>(items: T[], work: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, items.length) }, async () => {
      while (cursor < items.length) await work(items[cursor++]!);
    }),
  );
}
for (const brand of ['toyota', 'lexus'] as TciBrand[]) {
  const brandData = await download(tciSeriesUrl(brand));
  const listed = tciListedSeries(brandData.data, brand);
  result.brands.push({
    brand,
    source: brandData.source,
    expectedSeries: listed.map((series) => series.code),
  });
  await batch(listed, async (series) => {
    const response = await download(tciYearsUrl(brand, series.code));
    const references = tciModelReferences(response.data, brand, series);
    const rules = await download(
      tciUrl(brand, 'BnP-get-dimensions-rules', { series: series.code, brand }),
    );
    result.series.push({
      brand,
      ...series,
      source: response.source,
      rulesSource: rules.source,
      rules: tciRulesResponseSchema.parse(rules.data).data.breDimensionsList.items,
      expectedModelPaths: references.selected.map((model) => model._path),
      historicalReferencesExcluded: references.historical,
      inactiveReferencesExcluded: references.inactive,
    });
    if (!references.selected.length)
      result.gaps.push({
        brand,
        seriesCode: series.code,
        path: response.source.url,
        reason:
          'Current display years are configured but no active factory model references are published.',
      });
    for (const reference of references.selected) {
      const modelData = await download(
        tciUrl(brand, 'BnP-get-models', { modelPath: reference._path }),
      );
      const model = tciModelResponseSchema.parse(modelData.data).data.modelV2ByPath.item;
      if (!model) {
        result.models.push({
          brand,
          path: reference._path,
          source: modelData.source,
          expectedPackagePaths: [],
          unavailable: true,
          definition: null,
        });
        result.gaps.push({
          brand,
          seriesCode: series.code,
          path: reference._path,
          reason: 'Factory model reference exists but its public model data are unavailable.',
        });
        continue;
      }
      if (
        model._path !== reference._path ||
        model.modelCode.trim() !== reference.modelCode.trim() ||
        model.modelYear !== reference.modelYear ||
        model.modelStatus !== 'active'
      )
        throw new Error('TCI factory model changed during import.');
      const packages = (model.packagesFragmentPath ?? []).filter(
        (pack) => pack.websitedisplay === true,
      );
      result.models.push({
        brand,
        path: reference._path,
        source: modelData.source,
        expectedPackagePaths: packages.map((pack) => pack._path),
        unavailable: false,
        definition: tciModelDefinition(model, series.code),
      });
      if (!packages.length)
        result.gaps.push({
          brand,
          seriesCode: series.code,
          path: reference._path,
          reason: 'Active factory model has no website-visible package configurations.',
        });
      for (const pack of packages) {
        const packageData = await download(
          tciUrl(brand, 'BnP-get-package', { packagePath: pack._path }),
        );
        const details = tciPackageResponseSchema.parse(packageData.data).data.packageV2ByPath.item;
        if (
          !details ||
          details._path !== pack._path ||
          details.packageSuffixCode !== pack.packageSuffixCode ||
          details.websitedisplay !== true
        )
          throw new Error(`TCI package changed or disappeared: ${pack._path}`);
        result.records.push({
          brand,
          seriesCode: series.code,
          seriesName: series.name,
          year: Number(model.modelYear),
          modelCode: model.modelCode.trim(),
          modelDescription: model.modelDescriptionEn?.plaintext?.trim() || model.modelCode.trim(),
          bodyType: model.bodyType,
          engine: model.engine,
          transmission: model.transmission,
          packageCode: details.packageSuffixCode,
          packageDescription:
            details.packageSuffixDescriptionEn?.plaintext?.trim() || details.packageSuffixCode,
          isBasePackage: details.isBasePackage === true,
          originalModelCode: details.originalModelCode,
          priceHidden: details.hidePackagePrice === true,
          vehiclePrice: details.packagePriceFragmentPath?.vehiclePrice ?? null,
          basePrice: details.packagePriceFragmentPath?.vehicleBasePackagePrice ?? null,
          packagePrice: details.packagePriceFragmentPath?.vehiclePackagePrice ?? null,
          dimensions: pickTciDimensions(details.dimensionsFragmentPath),
          dimensionsVisible: details.dimensionsFragmentPath?.websiteDisplay !== false,
          source: packageData.source,
          modelSource: modelData.source,
        });
      }
    }
    console.log(
      `${brand} ${series.code}: ${references.selected.length} current factory models processed`,
    );
  });
  const after = await download(tciSeriesUrl(brand));
  if (JSON.stringify(tciListedSeries(after.data, brand)) !== JSON.stringify(listed))
    throw new Error(`${brand} lineup changed during import. Snapshot not replaced.`);
}
result.series.sort((a, b) => `${a.brand}/${a.code}`.localeCompare(`${b.brand}/${b.code}`));
result.models.sort((a, b) => a.path.localeCompare(b.path));
result.records.sort((a, b) => a.source.url.localeCompare(b.source.url));
result.gaps = result.gaps.filter(
  (gap) =>
    !result.models.some(
      (model) => model.path === gap.path && tciAliasPackages(model, result.records).length,
    ),
);
const snapshot = validateTciSnapshot(result);
await writeFile(
  `${target}.tmp`,
  await format(JSON.stringify(snapshot), { ...(await resolveConfig(target)), parser: 'json' }),
);
await rename(`${target}.tmp`, target);
console.log(
  `Saved ${snapshot.records.length} Toyota/Lexus retail configurations; ${snapshot.gaps.length} explicit source gaps remain.`,
);
if (capture)
  console.log(
    `Rebuilt offline from sources captured ${capture.retrievedAt}; review dates were not advanced.`,
  );
