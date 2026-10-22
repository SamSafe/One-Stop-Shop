import { mkdir, writeFile } from 'node:fs/promises';
import {
  catalog,
  nrcanSnapshot,
  tciSnapshot,
  hondaSnapshot,
  fordSnapshot,
  mazdaSnapshot,
  hyundaiSnapshot,
  kiaSnapshot,
  gmSnapshot,
} from '../packages/car-catalog/src/index.ts';
import { catalogCoverage } from '../packages/car-catalog/src/coverage.ts';
import { mazdaMeasurementConflicts } from '../packages/car-catalog/src/mazda.ts';
import { kiaReviewGaps } from '../packages/car-catalog/src/kia.ts';
import { gmOptionKey } from '../packages/car-catalog/src/gm-import.ts';

const report = {
  ...catalogCoverage(catalog, nrcanSnapshot),
  manufacturerSourceGaps: [
    ...tciSnapshot.gaps,
    ...gmSnapshot.records
      .filter((record) => !record.configuration || record.configuration.msrpCad === null)
      .map((record) => ({
        brand: 'GM',
        model: record.modelKey,
        configuration: gmOptionKey(record.option),
        field: 'msrpCad',
        reason: record.configurationGap ?? record.configuration?.priceNote,
      })),
    ...gmSnapshot.models
      .filter((model) => !model.excludedReason)
      .map((model) => ({
        brand: model.reference.brand,
        model: model.key,
        field: 'specifications',
        sourceCaptured: model.specificationsSource !== null,
        reason:
          'Exact style/powertrain joins for dimensional, seating, cargo and energy tables remain under review. Default or sibling measurements are not copied into other configurations.',
      })),
    ...kiaReviewGaps(kiaSnapshot).map((gap) => ({ brand: 'Kia', ...gap })),
    ...hyundaiSnapshot.models.map((model) => ({
      brand: 'Hyundai',
      model: model.name,
      year: model.year,
      sourceUrl: model.specificationsReview.source.url,
      sourceStatus: model.specificationsReview.status,
      reason: model.specificationsReview.reason,
    })),
    ...hyundaiSnapshot.records
      .filter((record) => record.optionEstimateCad !== record.msrpCad)
      .map((record) => ({
        brand: 'Hyundai',
        model: record.modelName,
        year: record.year,
        configuration: record.trimId,
        sourceUrl: record.priceSource.url,
        optionEstimateCad: record.optionEstimateCad,
        exactTrimMsrpCad: record.msrpCad,
        reason:
          'Parent option arithmetic differs from the exact-trim calculator MSRP. Exact-trim MSRP is displayed with a source-conflict note; independent reconciliation remains required.',
      })),
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
  manufacturerCommercialOnlyExclusions: [
    ...kiaSnapshot.excludedModels.map((model) => ({
      brand: 'Kia',
      model: model.name,
      year: model.year,
      configurations: model.expectedKeys,
      reason: model.reason,
      sourceUrl: model.source.url,
    })),
    ...gmSnapshot.models
      .filter((model) => model.excludedReason)
      .map((model) => ({
        brand: model.reference.brand,
        model: model.key,
        year: model.reference.year,
        configurations: model.expectedKeys,
        reason: model.excludedReason,
        sourceUrl: model.source.url,
      })),
  ],
  manufacturerOlderModelYearsNeedingInventoryReview: mazdaSnapshot.excludedModelYears.map(
    (year) => ({ brand: 'Mazda', model: year.carline, year: year.year, reason: year.reason }),
  ),
  manufacturerConfigurationExpansion: [
    ...fordSnapshot.models.map((model) => ({
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
    ...gmSnapshot.models
      .filter((model) => !model.excludedReason)
      .map((model) => ({
        brand: model.reference.brand,
        model: model.key,
        year: model.reference.year,
        capturedMatrixConfigurations: model.expectedKeys.length,
        additionalSelectionsExhaustivelyExpanded: false,
        remaining:
          'Reconcile additional equipment/package selections beyond the complete published body/drive/engine/transmission/axle/battery/propulsion matrix. Matrix coverage does not establish all ordering or dealer-inventory configurations.',
      })),
  ],
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
