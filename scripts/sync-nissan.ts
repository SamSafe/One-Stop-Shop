import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { z } from 'zod';
import { format, resolveConfig } from 'prettier';
import {
  nissanBrands,
  nissanBuildUrl,
  nissanOrigin,
  nissanSelection,
  nissanSpecifications,
  nissanInventoryReferences,
  nissanEquipmentPackages,
  nissanKey,
  validateNissanSnapshot,
} from '../packages/car-catalog/src/nissan-import.ts';
import type {
  NissanSnapshot,
  NissanRecord,
  NissanReceipt,
} from '../packages/car-catalog/src/nissan-import.ts';

const directory = 'data/raw/nissan',
  target = 'packages/car-catalog/data/manufacturers/nissan.json';
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const manifestSchema = z.object({
  retrievedAt: z.iso.datetime(),
  sources: z.array(
    z.object({
      url: z.url(),
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
      status: z.number().int(),
    }),
  ),
});
const offline = process.argv.includes('--offline'),
  argument = process.argv.indexOf('--from-captures');
const manifestPath =
  argument >= 0 ? process.argv[argument + 1]! : `${directory}/capture-manifest.json`;
const captured = offline || argument >= 0;
const manifest = captured
  ? manifestSchema.parse(JSON.parse(await readFile(manifestPath, 'utf8')))
  : {
      retrievedAt: new Date().toISOString(),
      sources: [] as z.infer<typeof manifestSchema>['sources'],
    };
const snapshot: NissanSnapshot = {
  schemaVersion: 1,
  retrievedAt: manifest.retrievedAt,
  brands: [],
  models: [],
  records: [],
};
await mkdir(directory, { recursive: true });
const seen = new Map<string, { source: NissanReceipt; text: string; status: number }>();
async function capture(url: string) {
  if (seen.has(url)) return seen.get(url)!;
  let bytes: Buffer, status: number;
  if (captured) {
    const receipt = manifest.sources.find((source) => source.url === url);
    if (!receipt) throw new Error(`Missing Nissan/Infiniti capture: ${url}`);
    bytes = await readFile(`${directory}/${receipt.sha256}`);
    if (hash(bytes) !== receipt.sha256)
      throw new Error(`Nissan/Infiniti checksum mismatch: ${url}`);
    status = receipt.status;
  } else {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
    bytes = Buffer.from(await response.arrayBuffer());
    status = response.status;
    const sha256 = hash(bytes);
    await writeFile(`${directory}/${sha256}`, bytes);
    manifest.sources.push({ url, sha256, status });
  }
  const value = { source: { url, sha256: hash(bytes) }, text: bytes.toString('utf8'), status };
  seen.set(url, value);
  return value;
}
for (const brand of nissanBrands) {
  const selector = await capture(nissanBuildUrl(brand)),
    inventory = await capture(`${nissanOrigin(brand)}/shopping-tools/search-inventory`);
  if (selector.status !== 200 || inventory.status !== 200)
    throw new Error('Required Nissan/Infiniti lineup source unavailable.');
  const models = nissanSelection(selector.text, brand);
  snapshot.brands.push({
    brand,
    source: selector.source,
    expectedModelKeys: models.map((model) => `${brand}/${model.id}`),
    inventorySource: inventory.source,
    inventoryOnlyModels: nissanInventoryReferences(inventory.text).filter(
      (reference) => !models.some((model) => model.id === reference.code),
    ),
  });
  for (const model of models) {
    const category = ['leaf', 'ariya'].includes(model.slug)
      ? 'electric-cars'
      : (model.vehicleTypes.find((type) => !['electric-cars', 'hybrid'].includes(type.slug))
          ?.slug ?? model.vehicleTypes[0]!.slug);
    const page = await capture(
      `${nissanOrigin(brand)}/vehicles/${category}/${model.slug}/specs.html`,
    );
    const specifications = page.status === 200 ? nissanSpecifications(page.text, page.source) : [];
    const returnedModelCodes = [
      ...new Set(specifications.map((spec) => spec.gradeCode.split('-')[0]!)),
    ].sort();
    const matchedModel = returnedModelCodes.includes(model.id);
    const reason =
      page.status !== 200
        ? `The published specification route returned HTTP ${page.status}. Exact-version measurements remain unknown.`
        : !matchedModel
          ? `The specification route now publishes model code(s) ${returnedModelCodes.join(', ')}, not requested ${model.id}/${model.year}. Current-year measurements are not copied into a previous or newer year.`
          : 'Exact model, year, grade and version codes are required for each specification join.';
    const expectedKeys: string[] = [];
    for (const version of model.versions) {
      const spec =
        specifications.find(
          (spec) =>
            spec.gradeCode === version.gradeCode &&
            spec.versionKey === version.versionCode &&
            spec.path.includes(`/en_CA/cars/${model.year}-${model.slug}/`),
        ) ?? null;
      const record: NissanRecord = {
        brand,
        year: Number(model.year),
        modelCode: model.id,
        modelName: model.modelName,
        modelSlug: model.slug,
        versionCode: version.versionCode,
        eimCode: version.eimCode,
        packageCode: version.packageCode,
        nstConfigCode: version.nstConfigCode,
        displayName: version.displayName,
        gradeCode: version.gradeCode,
        gradeName: version.gradeName,
        versionName: version.versionName,
        filterTags: version.filterTags.filter((tag) =>
          /^(driveTrain|fuelType|engineSize):/.test(tag),
        ),
        keyFeatures: version.keyFeatures,
        seatingCapacity: version.seatingCapacity,
        buildPath: version.buildPath,
        retailPrice: version.priceList.retail,
        gradeFuelConsumption:
          model.grades.find((grade) => grade.gradeCode === version.gradeCode)?.specification
            .fuelConsumption ?? null,
        optionPackage: null,
        specification: spec,
        specificationGap: spec
          ? null
          : `${reason} No exact grade/version specification join was established for ${version.versionCode}.`,
      };
      snapshot.records.push(record);
      expectedKeys.push(nissanKey(record));
      if (spec)
        for (const pack of nissanEquipmentPackages(spec)) {
          const packaged = { ...record, optionPackage: pack };
          snapshot.records.push(packaged);
          expectedKeys.push(nissanKey(packaged));
        }
    }
    snapshot.models.push({
      brand,
      code: model.id,
      name: model.modelName,
      year: Number(model.year),
      slug: model.slug,
      vehicleTypes: model.vehicleTypes.map((type) => type.slug),
      electric: model.isEV,
      expectedKeys,
      specificationsReview: {
        source: page.source,
        status: page.status,
        returnedModelCodes,
        reason,
      },
    });
    console.log(
      `${brand} ${model.year} ${model.modelName}: ${expectedKeys.length} configurations, ${snapshot.records.filter((record) => record.brand === brand && record.modelCode === model.id && record.specification).length} exact specification joins.`,
    );
  }
}
snapshot.models.sort((a, b) => `${a.brand}/${a.code}`.localeCompare(`${b.brand}/${b.code}`));
snapshot.records.sort((a, b) => nissanKey(a).localeCompare(nissanKey(b)));
const valid = validateNissanSnapshot(snapshot),
  output = await format(JSON.stringify(valid), {
    ...(await resolveConfig(target)),
    filepath: target,
  });
if (offline) {
  if (output !== (await readFile(target, 'utf8')))
    throw new Error('Nissan/Infiniti offline reconstruction differs from the tracked snapshot.');
  console.log(`Verified original hashes/date for ${valid.records.length} Canadian configurations.`);
} else {
  await writeFile(`${target}.tmp`, output);
  await rename(`${target}.tmp`, target);
  if (!captured) await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}
