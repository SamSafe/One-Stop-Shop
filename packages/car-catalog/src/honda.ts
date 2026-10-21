import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { hondaConfigurationUrl, hondaPlainText } from './honda-import';
import type { HondaRecord, HondaSnapshot } from './honda-import';

const originals: Record<string, string> = {
  'honda/2026/10901/10949': 'honda-cr-v-2026-lx-fwd',
  'honda/2026/10904/10952': 'honda-cr-v-2026-sport-hybrid-awd',
};
export const hondaRecordId = (record: HondaRecord) =>
  originals[`${record.brand}/${record.year}/${record.trimId}/${record.transmissionId}`] ??
  `${record.brand}-ca-${record.year}-${record.trimId}-${record.transmissionId}`;
const lineupSourceId = (brand: string) => `${brand}-ca-current-retail-lineup`;
const priceSourceId = (record: HondaRecord) =>
  `${record.brand}-ca-${record.year}-${record.modelKey.replace(/[^a-z0-9]+/g, '-')}-retail-pricing`;
const specSourceId = (record: HondaRecord) =>
  `${record.brand}-ca-${record.year}-trim-${record.trimId}-specifications`;
type Spec = { label: string; value: string };
export const hondaSpecifications = (record: HondaRecord): Spec[] =>
  record.specifications.flatMap((group) =>
    group.Specs.map((spec) => ({
      label: hondaPlainText(spec.Label),
      value: hondaPlainText(spec.Value ?? ''),
    })),
  );
// Reject optional alternatives and ambiguous paired widths; explicit qualifiers and imperial conversions are retained in fact notes.
export function hondaNumbers(value: string, count: number): number[] | null {
  const numbers = value
    .replace(/,/g, '')
    .match(/^\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)(?:\s*\([^)]*\))?\s*$/)?.[1]
    ?.split('/')
    .map(Number);
  return numbers?.length === count && numbers.every((value) => value > 0) ? numbers : null;
}
export function hondaDrivetrain(record: HondaRecord): Car['drivetrain'] {
  const explicit = hondaSpecifications(record).filter(
    (spec) =>
      /^drivetrain\b|^dual-motor all-wheel/i.test(spec.label) &&
      spec.value &&
      !/^available\b/i.test(spec.value),
  );
  const dimensionalQualifiers = hondaSpecifications(record)
    .filter((spec) => /^(?:height|length|width) \(mm\)/i.test(spec.label))
    .map((spec) => spec.value)
    .join(' ');
  const evidence = `${record.trimName} ${explicit.map((spec) => `${spec.label} ${spec.value}`).join(' ')} ${dimensionalQualifiers}`;
  const front = /\bFWD\b|front-wheel drive/i.test(evidence);
  const all = /\bAWD\b|all-wheel drive/i.test(evidence);
  if (front && !all) return 'FWD';
  if (all && !front) return 'AWD';
  const fuelRows = hondaSpecifications(record).filter(
    (spec) => /city.*hwy.*combined/i.test(spec.label) && hondaNumbers(spec.value, 3),
  );
  if (fuelRows.length === 1) {
    if (/front-wheel/i.test(fuelRows[0]!.label)) return 'FWD';
    if (/\bAWD\b|all-wheel/i.test(fuelRows[0]!.label)) return 'AWD';
  }
  return 'Not verified';
}
function powertrain(record: HondaRecord): Car['fuel'] {
  if (/^electric$/i.test(record.transmissionName)) return 'Electric';
  if (
    record.bodyTags.includes('Hybrids') ||
    hondaSpecifications(record).some(
      (spec) => /^two-motor hybrid system/i.test(spec.label) && spec.value === '•',
    )
  )
    return 'Hybrid';
  return 'Gasoline';
}
function bodyStyle(record: HondaRecord): Car['bodyStyle'] {
  for (const [tag, style] of [
    ['SUV', 'SUV'],
    ['Sedan', 'Sedan'],
    ['Hatchback', 'Hatchback'],
    ['Coupe', 'Coupe'],
    ['Minivan', 'Minivan'],
    ['Pickup', 'Pickup'],
  ] as const)
    if (record.bodyTags.includes(tag)) return style;
  if (/hatchback/i.test(record.modelName)) return 'Hatchback';
  if (/sedan/i.test(record.modelKey)) return 'Sedan';
  // The shared "Trucks Minivans" category does not distinguish these body styles.
  return 'Not verified';
}
export function hondaFacts(record: HondaRecord): Car['facts'] {
  const unknown = (): Fact => ({
    value: null,
    source: null,
    note: 'Not published or not yet verified for this exact Canadian trim and transmission. An ambiguous measurement remains unknown.',
  });
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [metric, unknown()]),
  ) as Car['facts'];
  const specs = hondaSpecifications(record);
  const rows = (pattern: RegExp) => specs.filter((spec) => pattern.test(spec.label) && spec.value);
  const single = (pattern: RegExp) => {
    const found = rows(pattern);
    return found.length === 1 ? found[0] : undefined;
  };
  function set(metric: Metric, value: number | null | undefined, spec: Spec, extra = '') {
    const definition = metricDefinitions[metric];
    if (value !== null && value !== undefined && value >= definition.min && value <= definition.max)
      facts[metric] = {
        value,
        source: specSourceId(record),
        sourceUrl: record.specificationsSource.url,
        note: `Manufacturer ${spec.label}: ${spec.value}. ${extra}`.trim(),
      };
  }
  if (record.msrpCad !== null)
    facts.msrpCad = {
      value: record.msrpCad,
      source: priceSourceId(record),
      sourceUrl: hondaConfigurationUrl(record),
      note: 'Canadian manufacturer calculator Transmission.Msrp, before freight/PDI, taxes, levies, dealer fees, premium colours, accessories and discounts. Captured with the ON pricing request; the fee-inclusive SellingPrice field is not base MSRP.',
    };
  const seats = single(/^(?:max )?seating capacity\b/i);
  if (seats) set('seats', hondaNumbers(seats.value, 1)?.[0], seats);
  for (const [metric, pattern] of [
    ['lengthMm', /^length \(mm\)/i],
    ['widthMm', /^width \(mm\)/i],
    ['heightMm', /^height \(mm\)/i],
  ] as const) {
    const spec = single(pattern);
    if (spec)
      set(
        metric,
        hondaNumbers(spec.value, 1)?.[0],
        spec,
        metric === 'widthMm'
          ? 'Mirror convention is not specified in this field. Multiple alternative widths are left unknown.'
          : 'Published millimetres; qualifiers remain visible.',
      );
  }
  for (const [front, rear, pattern] of [
    ['frontHeadroomMm', 'rearHeadroomMm', /^headroom\b.*\(mm\)/i],
    ['frontLegroomMm', 'rearLegroomMm', /^legroom\b.*\(mm\)/i],
  ] as const) {
    const spec = single(pattern);
    if (spec) {
      const count = /3rd/.test(spec.label) ? 3 : 2;
      const values = hondaNumbers(spec.value, count);
      set(front, values?.[0], spec);
      set(rear, values?.[1], spec, 'Rear measurement refers to the second row.');
    }
  }
  const totalPower = single(/^combined total horsepower\b/i);
  const enginePower = single(/^horsepower\b/i);
  const power = totalPower ?? enginePower;
  if (power)
    set(
      'horsepower',
      Number(power.value.match(/^(?:Up to )?(\d+(?:\.\d+)?)(?:\s*hp)?(?:\s*@.*)?$/i)?.[1]) || null,
      power,
      totalPower
        ? 'Combined system output.'
        : 'Published engine/motor output; the source qualifier is retained.',
    );
  const drive = hondaDrivetrain(record);
  const fuel = powertrain(record);
  if (fuel !== 'Electric') {
    const fuels = rows(/city.*hwy.*combined/i).filter(
      (spec) =>
        hondaNumbers(spec.value, 3) &&
        !(drive === 'FWD' && /AWD|all-wheel/i.test(spec.label)) &&
        !(drive === 'AWD' && /front-wheel/i.test(spec.label)),
    );
    if (fuels.length === 1) {
      const spec = fuels[0]!,
        values = hondaNumbers(spec.value, 3)!;
      for (const [index, metric] of [
        'fuelCityL100km',
        'fuelHighwayL100km',
        'fuelCombinedL100km',
      ].entries())
        set(
          metric as Metric,
          values[index],
          spec,
          'Canadian liquid-fuel consumption in L/100 km; actual consumption varies.',
        );
    }
  } else {
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        'Not applicable to battery-electric propulsion; electricity consumption is not gasoline consumed.';
    const range = single(/^range \(km\)/i);
    if (range)
      set(
        'electricRangeKm',
        hondaNumbers(range.value, 1)?.[0],
        range,
        'Actual range varies with conditions.',
      );
  }
  const capacity = facts.seats.value;
  const threeRow = capacity !== null && capacity >= 6;
  const behindThird = single(/^cargo volume behind 3rd row\b/i);
  const behindSecond = single(/^cargo volume behind 2nd row\b/i);
  const upDown = single(/^cargo volume.*rear seats up\/down\b/i);
  const generic = single(/^cargo volume(?:\*|\s|–|\().*\(L\)$/i);
  if (threeRow) {
    if (behindThird)
      set(
        'cargoSeatsUpL',
        hondaNumbers(behindThird.value, 1)?.[0],
        behindThird,
        'All seating rows upright.',
      );
  } else if (upDown) {
    const values = hondaNumbers(upDown.value, 2);
    set('cargoSeatsUpL', values?.[0], upDown);
    set('cargoSeatsDownL', values?.[1], upDown);
  } else if (behindSecond)
    set('cargoSeatsUpL', hondaNumbers(behindSecond.value, 1)?.[0], behindSecond);
  else if (generic && !/maximum|behind/i.test(generic.label))
    set(
      'cargoSeatsUpL',
      hondaNumbers(generic.value, 1)?.[0],
      generic,
      'Seating position/measurement method is not specified by this field; confirm practical fit.',
    );
  const behindFront = single(/^cargo volume behind (?:front|1st) row\b/i);
  if (behindFront)
    set(
      'cargoSeatsDownL',
      hondaNumbers(behindFront.value, 1)?.[0],
      behindFront,
      'Seat positions and cargo standards can differ.',
    );
  return facts;
}
export function addHondaRetail(base: Catalog, snapshot: HondaSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const sources = new Map<string, Source>();
  for (const brand of snapshot.brands)
    sources.set(lineupSourceId(brand.brand), {
      id: lineupSourceId(brand.brand),
      title: `${brand.brand === 'honda' ? 'Honda' : 'Acura'} Canada current model/trim lineup`,
      publisher: brand.brand === 'honda' ? 'Honda Canada' : 'Acura Canada',
      url: brand.source.url,
      reviewedAt,
      publishedAt: null,
      locator:
        'ModelCardWithTrims embedded JSON: every listed year, trim and transmission. Includes low-inventory configurations with online building disabled. Cards without a current year and calculator-only configurations remain availability research gaps.',
    });
  const previous = new Map(base.cars.map((car) => [car.id, car]));
  const additions: Car[] = snapshot.records.map((record) => {
    const id = hondaRecordId(record),
      old = previous.get(id),
      publisher = record.brand === 'honda' ? 'Honda Canada' : 'Acura Canada';
    sources.set(priceSourceId(record), {
      id: priceSourceId(record),
      title: `${record.year} ${record.modelName} Canadian retail pricing`,
      publisher,
      url: hondaConfigurationUrl(record),
      reviewedAt,
      publishedAt: null,
      locator: `Public manufacturer price calculator: POST ${record.pricingSource.url}, modelKey=${record.modelKey}, modelYear=${record.year}. Match Trim.Id/Key and Transmission.Id; presentation suffix aliases are preserved in the snapshot. Transmission.Msrp excludes SellingPrice fees and colour markups.`,
    });
    sources.set(specSourceId(record), {
      id: specSourceId(record),
      title: `${record.year} ${record.modelName} ${record.trimName} Canadian specifications`,
      publisher,
      url: record.specificationsSource.url,
      reviewedAt,
      publishedAt: null,
      locator: `Exact TrimId ${record.trimId}. Combined system versus engine power, seating/cargo rows, units and source qualifiers remain explicit. Multiple unresolved alternatives stay unknown.`,
    });
    const imported = hondaFacts(record);
    const facts = old
      ? (Object.fromEntries(
          Object.entries(imported).map(([key, fact]) => [
            key,
            fact.value === null && key !== 'msrpCad' ? old.facts[key as Metric] : fact,
          ]),
        ) as Car['facts'])
      : imported;
    return {
      ...(old ?? {}),
      id,
      make: record.brand === 'honda' ? 'Honda' : 'Acura',
      model: old?.model ?? record.modelName,
      trim: old?.trim ?? record.trimName.replace(/\s*-\s*LOW INVENTORY\s*$/i, ''),
      year: record.year,
      market: 'CA',
      bodyStyle: old?.bodyStyle ?? bodyStyle(record),
      fuel: powertrain(record),
      drivetrain: old?.drivetrain ?? hondaDrivetrain(record),
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: `${record.year}/${record.trimId}/${record.transmissionId}`,
        code: record.modelCode,
        transmission: record.transmissionName,
        specificationsUrl: record.specificationsSource.url,
      },
      availability: {
        status: record.announced ? 'announced' : 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: lineupSourceId(record.brand),
        note: `Listed on the Canadian model/trim page. ${record.buildable ? 'Online building is enabled.' : 'Online building is disabled; this does not establish that remaining new inventory is unavailable.'} ${record.trimName.includes('LOW INVENTORY') ? 'The manufacturer labels this trim LOW INVENTORY. ' : ''}${record.excludedProvinces.length ? `Build-and-price is excluded in: ${record.excludedProvinces.join(', ')}. ` : ''}Dealer stock and delivery dates require confirmation.`,
      },
      sourceIds: [
        ...new Set([
          ...(old?.sourceIds ?? []),
          lineupSourceId(record.brand),
          priceSourceId(record),
          specSourceId(record),
        ]),
      ],
      facts,
    };
  });
  const replaced = new Set(additions.map((car) => car.id));
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources.values()],
    cars: [...base.cars.filter((car) => !replaced.has(car.id)), ...additions],
  });
}
