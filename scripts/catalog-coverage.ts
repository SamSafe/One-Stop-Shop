import { mkdir, writeFile } from 'node:fs/promises';
import {
  catalog,
  nrcanSnapshot,
  tciSnapshot,
  hondaSnapshot,
  fordSnapshot,
  mazdaSnapshot,
} from '../packages/car-catalog/src/index.ts';
import { catalogCoverage } from '../packages/car-catalog/src/coverage.ts';
import { mazdaMeasurementConflicts } from '../packages/car-catalog/src/mazda.ts';

const report = {
  ...catalogCoverage(catalog, nrcanSnapshot),
  manufacturerSourceGaps: [
    ...tciSnapshot.gaps,
    ...mazdaSnapshot.records.flatMap((record) =>
      mazdaMeasurementConflicts(record).map((conflict) => ({
        brand: 'Mazda',
        model: record.modelName,
        year: record.year,
        configuration: `${record.modelCode}/${record.optionCode}`,
        ...conflict,
      })),
    ),
    ...mazdaSnapshot.modelYears
      .filter((year) => year.comingSoon)
      .map((year) => ({
        brand: 'Mazda',
        model: year.name,
        year: year.year,
        reason:
          'Build-tool feed flags coming soon for a previous-model-year listing. Current offering needs reconciliation.',
      })),
    ...hondaSnapshot.models.flatMap((model) =>
      model.years.flatMap((year) =>
        year.pricingOnlyConfigurationKeys.map((key) => ({
          brand: model.brand,
          model: model.name,
          year: year.year,
          configuration: key,
          reason:
            'Present in the pricing calculator but absent from the current model/trim lineup. Availability needs reconciliation.',
        })),
      ),
    ),
  ],
  manufacturerModelsWithoutListedYears: hondaSnapshot.models
    .filter((model) => !model.years.length)
    .map((model) => ({
      brand: model.brand,
      model: model.name,
      reason:
        'Model card has no current year. Check remaining new inventory before excluding it from full-market coverage.',
    })),
  manufacturerOlderModelYearsNeedingInventoryReview: mazdaSnapshot.excludedModelYears.map(
    (year) => ({ brand: 'Mazda', model: year.carline, year: year.year, reason: year.reason }),
  ),
  manufacturerConfigurationExpansion: fordSnapshot.models.map((model) => ({
    brand: model.brand,
    model: model.name,
    year: model.year,
    capturedDefaultConfigurations: model.variants.filter(
      (variant) => variant.excludedReason === null,
    ).length,
    additionalSelectionsExhaustivelyExpanded: false,
    remaining:
      'Expand and reconcile additional engine, drive and equipment selections. Default-build coverage does not establish every configurable retail combination.',
  })),
};
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/catalog-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--require-complete') && !report.fullMarketCoverageVerified) {
  console.error(
    'Full Canadian market coverage has not been verified. See the remaining work in artifacts/catalog-coverage.json.',
  );
  process.exitCode = 1;
}
