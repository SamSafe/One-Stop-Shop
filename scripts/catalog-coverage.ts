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
  nissanSnapshot,
  volkswagenSnapshot,
  mitsubishiSnapshot,
  polestarSnapshot,
  bmwSnapshot,
  miniSnapshot,
  genesisSnapshot,
  rivianSnapshot,
} from '../packages/car-catalog/src/index.ts';
import { catalogCoverage } from '../packages/car-catalog/src/coverage.ts';
import { mazdaMeasurementConflicts } from '../packages/car-catalog/src/mazda.ts';
import { kiaReviewGaps } from '../packages/car-catalog/src/kia.ts';
import { gmOptionKey } from '../packages/car-catalog/src/gm-import.ts';
import { nissanReviewGaps } from '../packages/car-catalog/src/nissan.ts';
import { vwReviewGaps } from '../packages/car-catalog/src/volkswagen.ts';
import { mitsubishiReviewGaps } from '../packages/car-catalog/src/mitsubishi.ts';
import { polestarReviewGaps } from '../packages/car-catalog/src/polestar.ts';
import { polestarPartitionIdentities } from '../packages/car-catalog/src/polestar-import.ts';
import { bmwReviewGaps } from '../packages/car-catalog/src/bmw.ts';
import { miniReviewGaps } from '../packages/car-catalog/src/mini.ts';
import { genesisReviewGaps } from '../packages/car-catalog/src/genesis.ts';
import { rivianReviewGaps } from '../packages/car-catalog/src/rivian.ts';
import sourceAccessReviews from '../docs/catalog-source-access.json';

const report = {
  ...catalogCoverage(catalog, nrcanSnapshot),
  manufacturerSourceAccessReviews: sourceAccessReviews,
  manufacturerInventoryModelSourceGaps: mitsubishiSnapshot.inventoryGaps,
  manufacturerInventoryPaginationGaps: [
    ...(bmwSnapshot.inventory.distinctStockRecords < bmwSnapshot.inventory.total
      ? [
          {
            brand: 'BMW',
            reportedRows: bmwSnapshot.inventory.total,
            distinctCapturedVehicleReferences: bmwSnapshot.inventory.distinctStockRecords,
            capturedModelYearProfiles: bmwSnapshot.inventory.modelReferences.length,
            reason:
              'All reported national new-stock pages were captured, but repeated vehicle identities leave exhaustive coverage unproven. Observed explicit VG/AG/model-year profiles remain included; reconcile disjoint filters or independent inventory references before claiming completeness.',
          },
        ]
      : []),
    ...polestarSnapshot.inventories.flatMap((inventory) => {
      const distinct = polestarPartitionIdentities(
        inventory.partition,
        inventory.filterGroups,
      ).size;
      return distinct === inventory.total
        ? []
        : [
            {
              brand: 'Polestar',
              retailerId: inventory.retailerId,
              modelCode: inventory.modelCode,
              reportedRows: inventory.total,
              distinctCapturedConfigurations: distinct,
              reason:
                'Disjoint source-declared single-page partitions do not reconcile to the parent count. Distinct inventory coverage is unproven.',
            },
          ];
    }),
  ],
  manufacturerSourceGaps: [
    ...tciSnapshot.gaps,
    ...nissanReviewGaps(nissanSnapshot),
    ...vwReviewGaps(volkswagenSnapshot),
    ...mitsubishiReviewGaps(mitsubishiSnapshot),
    ...polestarReviewGaps(polestarSnapshot),
    ...bmwReviewGaps(bmwSnapshot),
    ...miniReviewGaps(miniSnapshot),
    ...genesisReviewGaps(genesisSnapshot),
    ...rivianReviewGaps(rivianSnapshot),
    ...genesisSnapshot.rejectedSpecifications.map((s) => ({
      brand: 'Genesis',
      configuration: s.label,
      field: 'specification-year-conflict',
      reason: `${s.reason} Selector year ${s.requestedYear}, returned metadata years ${s.publishedYears.join(', ')}.`,
    })),
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
  manufacturerModelsWithoutFactoryReferences: volkswagenSnapshot.virtualVehicleReferences.map(
    (model) => ({
      brand: 'Volkswagen',
      ...model,
      sourceUrl: 'https://www.vw.ca/en/models/new-vehicles.html',
    }),
  ),
  manufacturerAdditionalModelsNeedingAvailabilityReview: ['ID.4']
    .filter((name) => !volkswagenSnapshot.models.some((model) => model.name === name))
    .map((name) => ({
      brand: 'Volkswagen',
      model: name,
      reason:
        'Absent from the current Canadian model overview/build selector. Buyer-guide and regional price metadata alone do not prove current dealer stock or a complete retail-trim set. Reconcile remaining new offerings and inventory before completing manufacturer coverage.',
      sourceUrl: 'https://www.vw.ca/en/buyers-guides.html',
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
  manufacturerOlderModelYearsNeedingInventoryReview: [
    ...mitsubishiSnapshot.models
      .filter((model) => !model.currentBuildListing)
      .map((model) => ({
        brand: 'Mitsubishi',
        model: model.name,
        year: model.year,
        reportedFamilyInventoryCount: model.inventoryReference?.num_items,
        reason:
          'The national new-inventory feed references this family/year and the Canadian factory query supplies exact trims, but current stock has not been reconciled for every trim. These records remain availability unchecked.',
      })),
    ...mazdaSnapshot.excludedModelYears.map((year) => ({
      brand: 'Mazda',
      model: year.carline,
      year: year.year,
      reason: year.reason,
    })),
    ...nissanSnapshot.brands.flatMap((brand) =>
      brand.inventoryOnlyModels.map((model) => ({
        brand: brand.brand,
        model: model.name,
        modelCode: model.code,
        year: model.year,
        reason: model.reason,
        sourceUrl: brand.inventorySource.url,
      })),
    ),
  ],
  manufacturerConfigurationExpansion: [
    ...rivianSnapshot.current.map((c) => ({
      brand: 'Rivian',
      model: c.builder.sku,
      years: c.builder.ruleset.groups.MODEL_YEAR!.options.map(Number),
      capturedFactoryProfiles: c.expectedProfileKeys.length,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Independent national new-stock reconciliation beyond the sampled delivery points, older unobserved years, individual cosmetic configurations, spare tires, autonomy products, accessory quantities and exact Canadian technical measurements remain open. Wheel-derived All-Terrain and underbody equipment are not independently multiplied into phantom selections.',
    })),
    ...genesisSnapshot.families.map((f) => ({
      brand: 'Genesis',
      model: f.model.modelNameEn,
      years: f.years,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Reconcile individual older new-stock availability, optional equipment and seating, ambiguous specification-year metadata, missing measurements, hybrid subtypes and normalized base MSRP. Regional all-inclusive component totals retain their separate basis; preorders do not establish current stock or delivery.',
    })),
    ...miniSnapshot.models.map((model) => ({
      brand: 'MINI',
      model: model.current?.name ?? model.lines?.Vehicle ?? model.code,
      year: model.year,
      modelCode: model.code,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Reconcile additional individual options and constraints, older stock line/style/equipment identities, source AG/transmission conflicts and missing consumption/seating/cabin evidence. Current named package choices are expanded from each exact published line/style context; counts do not establish full market coverage.',
    })),
    ...bmwSnapshot.inventory.modelReferences.map((reference) => ({
      brand: 'BMW',
      model: reference.name,
      year: reference.year,
      modelCode: reference.code,
      agCode: reference.agCode,
      observedStockTransmissions: reference.transmissions,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Reconcile additional equipment/packages and transmission choices beyond captured solver selections, current-model references without explicit stock year mappings, repeated inventory pages, older ordering restrictions and exact consumption/cabin/cargo evidence. Bare-model MSRP does not price unverified optional configurations.',
    })),
    ...polestarSnapshot.models.map((model) => ({
      brand: 'Polestar',
      model: model.initial.configuration.model.displayName,
      year: model.initial.configuration.model.modelYear,
      capturedFactoryConfigurations: polestarSnapshot.factoryRecords.filter(
        (record) => record.modelSlug === model.slug,
      ).length,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Current motor, pack and single-option transitions reconcile. Listed retailer/model inventory is reconciled using disjoint single-page filter partitions. Enumerate additional factory colour, upholstery, wheel and accessory compatibility and independently reconcile additional retailers/older new-stock offerings. Missing cabin/cargo specifications and EPA/generic range conflicts remain open.',
    })),
    ...mitsubishiSnapshot.models.map((model) => ({
      brand: 'Mitsubishi',
      model: model.name,
      year: model.year,
      capturedFactoryConfigurations: model.expectedCodes.length,
      currentBuildListing: model.currentBuildListing,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Reconcile additional factory package compatibility, individual older-trim stock and inventory model years missing factory data. Exact Canadian trim records do not establish every currently available ordering combination.',
    })),
    ...volkswagenSnapshot.models.map((model) => ({
      brand: 'Volkswagen',
      model: model.name,
      year: model.year,
      capturedFactoryConfigurations: model.expectedKeys.length,
      onlineConfigurationEnabled: model.configureEnabled,
      additionalSelectionsExhaustivelyExpanded: false,
      remaining:
        'Reconcile optional equipment, roof and seating arrangements beyond the exact published trim/engine references. Current/older new stock and models without factory references remain in scope.',
    })),
    ...nissanSnapshot.models
      .filter((model) =>
        nissanSnapshot.records.some(
          (record) =>
            record.brand === model.brand &&
            record.modelCode === model.code &&
            record.specification === null,
        ),
      )
      .map((model) => ({
        brand: model.brand,
        model: model.name,
        year: model.year,
        capturedSelectorConfigurations: model.expectedKeys.length,
        additionalSelectionsExhaustivelyExpanded: false,
        remaining:
          'The exact model-year specification/package table is unavailable or superseded. Reconcile additional factory packages before asserting exhaustive offering coverage.',
      })),
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
