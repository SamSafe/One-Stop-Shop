import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import type { FordBuild, FordSnapshot, FordVariant } from './ford-import';

type RecordEntry = FordSnapshot['records'][number];
const clean = (text: string) =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/[®™]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
export const fordRecordId = (record: RecordEntry) =>
  `${record.brand.toLowerCase()}-ca-${record.year}-${record.key}-${record.build.configHash.replace(/^-/, 'n')}`;
const sourceId = (model: FordSnapshot['models'][number]) =>
  `${model.brand.toLowerCase()}-ca-${model.year}-${model.key}-factory-configurations`;
export function fordMsrp(build: FordBuild): number | null {
  const { Base, Options, Accessories } = build.prices;
  if (
    Base === undefined ||
    Options === undefined ||
    Accessories !== 0 ||
    build.pricingAdjustments.some((adjustment) => adjustment.price === null)
  )
    return null;
  const discounts = build.pricingAdjustments
    .filter((adjustment) => adjustment.category === 'DISCOUNT_PACK')
    .reduce((sum, adjustment) => sum + adjustment.price!, 0);
  const colours = build.pricingAdjustments
    .filter((adjustment) =>
      ['COLOR', 'SECONDARY_COLOR', 'SEATING_COLOR'].includes(adjustment.category),
    )
    .reduce((sum, adjustment) => sum + adjustment.price!, 0);
  const value = Base + Options - discounts - colours;
  return Number.isFinite(value) && value >= 10000 && value <= 10000000 ? value : null;
}
export function fordFuel(build: FordBuild, electric: boolean): Car['fuel'] {
  const engine = `${build.features.ENGINE?.description ?? ''} ${build.features.FUEL?.description ?? ''}`;
  if (/plug.?in|PHEV/i.test(engine)) return 'Plug-in hybrid';
  if (/hybrid|PowerBoost|\bF?HEV\b/i.test(engine)) return 'Hybrid';
  if (electric) return 'Electric';
  if (/diesel|Power Stroke/i.test(engine)) return 'Diesel';
  if (/flex.?fuel/i.test(engine)) return 'Flex-fuel';
  return 'Gasoline';
}
export function fordDrive(build: FordBuild): Car['drivetrain'] {
  const value = build.features.DRIVE?.description ?? '';
  if (/AWD|all.wheel drive/i.test(value)) return 'AWD';
  if (/FWD|front.wheel drive/i.test(value)) return 'FWD';
  if (/RWD|rear.wheel drive/i.test(value)) return 'RWD';
  if (/4\s*[x×]\s*4|4WD|four.wheel drive/i.test(value)) return '4WD';
  // A generic 4x2 label does not independently distinguish front from rear drive.
  return 'Not verified';
}
function body(model: FordSnapshot['models'][number], variant: FordVariant): Car['bodyStyle'] {
  if (/transit/i.test(model.key)) return 'Van';
  if (/truck/.test(model.segment)) return 'Pickup';
  if (/suv|crossover/.test(model.segment)) return 'SUV';
  if (Object.values(variant.tags).some((tag) => /convertible/i.test(tag.name)))
    return 'Convertible';
  return 'Not verified';
}
export function addFordRetail(base: Catalog, snapshot: FordSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const sources: Source[] = snapshot.models.map((model) => ({
    id: sourceId(model),
    title: `${model.year} ${model.brand} ${clean(model.name)} Canadian factory configurations`,
    publisher: model.brand === 'Ford' ? 'Ford Canada' : 'Lincoln Canada',
    url: model.selectionSource.url,
    reviewedAt,
    publishedAt: null,
    locator:
      'Canadian showroom and model-selection references reconciled with each exact default factory build. Each MSRP links to that build. Price uses explicit MSRP Base/Options components, excluding selected colour charges, explicit package discounts, freight, levies and delivery allowances. Optional engine/drive/equipment alternatives remain a separate expansion pass.',
  }));
  const cars: Car[] = snapshot.records.map((record) => {
    const model = snapshot.models.find(
      (model) =>
        model.brand === record.brand && model.key === record.key && model.year === record.year,
    )!;
    const variant = model.variants.find((variant) => variant.key === record.variantKey)!;
    const source = sourceId(model),
      build = record.build;
    const unknown = (): Fact => ({
      value: null,
      source: null,
      note: 'Not yet verified for this exact Canadian factory configuration. A nameplate, marketing maximum or unrelated fuel-rating variant is not substituted.',
    });
    const facts = Object.fromEntries(
      Object.keys(metricDefinitions).map((metric) => [metric, unknown()]),
    ) as Car['facts'];
    const msrp = fordMsrp(build);
    facts.msrpCad = {
      value: msrp,
      source: msrp === null ? null : source,
      sourceUrl: record.source.url,
      note:
        msrp === null
          ? 'The source does not provide reconciled base/options/colour/discount components for this exact build. Price verification is required.'
          : `Canadian factory configuration MSRP from Base (${build.prices.Base}) + Options (${build.prices.Options}), removing explicit package discounts and selected colour charges. Excludes freight/PDI, levies, taxes, delivery allowances, incentives and accessories. The displayed TRIM_PRICE/Total can include fees and discounts and is not used as base MSRP.`,
    };
    const fuel = fordFuel(build, model.electric);
    if (fuel === 'Electric')
      for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
        facts[metric].note =
          'Not applicable to battery-electric propulsion. No gasoline-equivalent value is treated as gasoline consumed.';
    const parts = [
      ...Object.entries(variant.tags).map(([key, value]) => `${key}: ${clean(value.name)}`),
      clean(build.features.ENGINE?.description ?? ''),
      clean(build.features.DRIVE?.description ?? ''),
      clean(build.features.PEP_CODE?.description ?? ''),
    ].filter(Boolean);
    return {
      id: fordRecordId(record),
      make: record.brand,
      model: clean(model.name).replace(new RegExp(`^${record.brand}\\s+`, 'i'), ''),
      year: record.year,
      trim: clean(variant.trimName),
      variant: parts.join(' · ').slice(0, 200),
      market: 'CA',
      recordKind: 'retail-trim',
      bodyStyle: body(model, variant),
      fuel,
      drivetrain: fordDrive(build),
      manufacturerConfiguration: {
        id: record.variantKey,
        code: [...variant.seriesCodes, ...variant.variantCodes].join(',') || variant.trimId,
        transmission: clean(build.features.TRANSMISSION?.description ?? 'Not verified').slice(
          0,
          100,
        ),
        specificationsUrl: record.source.url,
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source,
        note: 'Listed in the Canadian retail showroom, model-selection page and exact default factory build. Additional engine, drive and equipment choices are not yet exhaustively expanded. Dealer inventory, older new stock and delivery dates require confirmation.',
      },
      sourceIds: [source],
      facts,
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
