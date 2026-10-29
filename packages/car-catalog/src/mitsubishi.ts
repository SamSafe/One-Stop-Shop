import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { mitsubishiKey, mitsubishiPriceUrl } from './mitsubishi-import';
import type { MitsubishiRecord, MitsubishiSnapshot } from './mitsubishi-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const priceId = (model: MitsubishiSnapshot['models'][number]) =>
  `mitsubishi-ca-${model.year}-${slug(model.vehicleCode)}-factory-pricing`;
const specsId = (model: MitsubishiSnapshot['models'][number]) =>
  `mitsubishi-ca-${model.year}-${slug(model.vehicleCode)}-specifications`;
export const mitsubishiRecordId = (record: MitsubishiRecord) =>
  `mitsubishi-ca-${record.model.year}-${slug(record.model.code)}`;
export function mitsubishiNumber(value: string): number | null {
  return /^\s*\d+(?:,\d{3})*(?:\.\d+)?\s*$/.test(value)
    ? Number(value.replace(/,/g, '').trim())
    : null;
}
export function mitsubishiMeasurement(value: string, label: string): number | null {
  const parts = value.split('/');
  if (parts.length !== 2) return null;
  const si = mitsubishiNumber(parts[0]!),
    imperial = mitsubishiNumber(parts[1]!);
  const factor = /mm\s*\/\s*in/i.test(label)
    ? 25.4
    : /l\s*\/\s*cu\s*ft/i.test(label)
      ? 28.316846592
      : null;
  return si !== null &&
    imperial !== null &&
    factor !== null &&
    Math.abs(si - imperial * factor) <= 2
    ? si
    : null;
}
export function mitsubishiMsrp(record: MitsubishiRecord): number | null {
  const price = record.model.price,
    fees = price.fees.reduce((sum, fee) => sum + fee.value, 0);
  return price.baseValue > 0 &&
    price.fees.every((fee) => fee.value >= 0) &&
    Math.abs(price.value - price.baseValue - fees) < 0.01
    ? price.baseValue
    : null;
}
export function mitsubishiFuel(record: MitsubishiRecord): Car['fuel'] {
  if (/PHEV/i.test(record.model.engineType)) return 'Plug-in hybrid';
  if (record.model.fuelType === 'Electric') return 'Electric';
  if (/48V BSG/i.test(record.model.engineType)) return 'Hybrid';
  if (record.model.fuelType === 'Unleaded') return 'Gasoline';
  throw new Error(`Mitsubishi fuel needs source review: ${mitsubishiKey(record)}`);
}
export function mitsubishiDrive(record: MitsubishiRecord): Car['drivetrain'] {
  const value = record.model.drivetrain
    .toUpperCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return value === 'ALL WHEEL DRIVE'
    ? 'AWD'
    : value === 'FRONT WHEEL DRIVE'
      ? 'FWD'
      : value === 'REAR WHEEL DRIVE'
        ? 'RWD'
        : 'Not verified';
}
export function mitsubishiFacts(
  record: MitsubishiRecord,
  model: MitsubishiSnapshot['models'][number],
): Car['facts'] {
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [
      metric,
      {
        value: null,
        source: null,
        note: 'Not published or not yet verified for this exact Canadian factory trim/year. Different model years, arrangements and operating modes are not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  const price = mitsubishiMsrp(record),
    priceUrl = mitsubishiPriceUrl(model);
  facts.msrpCad = {
    value: price,
    source: priceId(model),
    sourceUrl: priceUrl,
    note:
      price !== null
        ? `Canadian ${mitsubishiKey(record)}, getModelsSelector MSRP price.baseValue, CA/CAD context, empty package/colour/accessory selections. Price and separately returned fee components reconcile. Excludes delivery/PDI, levies, dealer fees, taxes, optional equipment and incentives. Published factory model-year price. Confirm current dealer pricing and exact trim stock.`
        : 'No reconcilable positive factory base price was verified. All-in prices, discounts and another trim/year are not substituted.',
  };
  facts.seats = {
    value: record.model.seats,
    source: priceId(model),
    sourceUrl: priceUrl,
    note: `Exact ${mitsubishiKey(record)} selector seating count. Optional arrangements require their own evidence.`,
  };
  const specification = record.specification;
  if (!specification) return facts;
  const fields = specification.fields,
    fuel = mitsubishiFuel(record);
  function set(
    metric: Metric,
    selected: typeof fields,
    parse: (value: string, label: string) => number | null,
    note = '',
  ) {
    if (!selected.length) return;
    const values = [...new Set(selected.map((field) => parse(field.value, field.label)))],
      def = metricDefinitions[metric];
    const value =
      values.length === 1 && values[0] !== null && values[0]! >= def.min && values[0]! <= def.max
        ? values[0]!
        : null;
    facts[metric] = {
      value,
      source: specsId(model),
      sourceUrl: specification!.source.url,
      note: `${mitsubishiKey(record)}: ${selected.map((field) => `${field.label}: ${field.value}`).join('; ')}. ${value === null ? 'Source alternatives, units or basis need review. ' : ''}${note}`.slice(
        0,
        1000,
      ),
    };
  }
  const selected = (pattern: RegExp) => fields.filter((field) => pattern.test(field.label));
  for (const [metric, pattern] of [
    ['lengthMm', /^Length \(mm/i],
    ['widthMm', /^Width \(mm/i],
    ['heightMm', /^Height \(mm/i],
    ['frontHeadroomMm', /^Head.?room.*(?:front|1st)/i],
    ['rearHeadroomMm', /^Head.?room.*(?:rear|2nd)/i],
    ['frontLegroomMm', /^Leg.?room.*(?:front|1st)/i],
    ['rearLegroomMm', /^Leg.?room.*(?:rear|2nd)/i],
  ] as const)
    set(
      metric,
      selected(pattern),
      mitsubishiMeasurement,
      metric === 'widthMm'
        ? 'Manufacturer published width; the source does not establish its mirror convention.'
        : 'Metric/imperial values must agree within rounding tolerance. Rear means second row.',
    );
  set(
    'cargoSeatsUpL',
    selected(
      record.model.seats >= 6
        ? /^Cargo volume \(behind 3rd Row Seat\)/i
        : /^Cargo volume \(behind 2nd Row Seat\)/i,
    ),
    mitsubishiMeasurement,
    'All seating rows upright. Manufacturer volume standards may differ.',
  );
  set(
    'cargoSeatsDownL',
    selected(/^Cargo volume \(behind front seat\)/i),
    mitsubishiMeasurement,
    'Published volume behind the front row; verify folding/removal and loading arrangements.',
  );
  if (facts.cargoSeatsUpL.value === null && selected(/^Cargo volume \(L/i).length)
    set(
      'cargoSeatsUpL',
      selected(/^Cargo volume \(L/i),
      () => null,
      'The generic cargo label does not establish the seating arrangement.',
    );
  if (fuel === 'Plug-in hybrid')
    set(
      'horsepower',
      selected(/Horsepower|Motor Power Output/i),
      () => null,
      'Engine hp, front/rear motor hp and a maximum POWER-mode motor figure do not unambiguously establish net combined-system output. These values are not summed or treated as interchangeable.',
    );
  else
    set(
      'horsepower',
      selected(/^Horsepower \(HP @ RPM\)/i),
      (value) => {
        const match = /^(\d+(?:\.\d+)?)\s*@\s*[\d,\-]+$/.exec(value.trim());
        return match ? Number(match[1]) : null;
      },
      'Explicit manufacturer hp/RPM field. The 48 V model is a mild hybrid; engine and starter-generator outputs are not added.',
    );
  if (!['Electric', 'Plug-in hybrid'].includes(fuel)) {
    const rows = selected(
      /^Estimated Consumption - City\/Highway\/Combined \(L\s*\/\s*100\s*km\)/i,
    );
    const triplets = rows.map((row) => row.value.split('/').map(mitsubishiNumber));
    const invalid = triplets.some(
      (parts) =>
        parts.length !== 3 ||
        parts.some((part) => part === null) ||
        parts[2]! < Math.min(parts[0]!, parts[1]!) - 0.1 ||
        parts[2]! > Math.max(parts[0]!, parts[1]!) + 0.1,
    );
    for (const [metric, index] of [
      ['fuelCityL100km', 0],
      ['fuelHighwayL100km', 1],
      ['fuelCombinedL100km', 2],
    ] as const)
      set(
        metric,
        rows,
        (value) => (invalid ? null : (value.split('/').map(mitsubishiNumber)[index] ?? null)),
        'Publisher explicitly orders city/highway/combined in L/100km; no weighted average is invented. Actual consumption varies.',
      );
  } else
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        fuel === 'Electric'
          ? 'Not applicable to battery-electric propulsion. Le/100km is gasoline-equivalent energy, not liquid fuel consumed.'
          : 'The generic plug-in fuel fields do not establish fuel-only, blended and electric-mode splits. A whole-journey estimate requires operating-mode evidence.';
  if (fuel === 'Electric') {
    set(
      'electricRangeKm',
      selected(/^Total Driving Range \(km\)/i),
      mitsubishiNumber,
      'Battery-electric model: published total driving range is electric range. Actual range varies.',
    );
    set(
      'electricModeLe100km',
      selected(/^City\/Highway\/Combined \(Le\/100 km\)/i),
      (value) => (value.split('/').length === 3 ? mitsubishiNumber(value.split('/')[2]!) : null),
      'Combined gasoline-equivalent energy. This is neither liquid fuel consumed nor a published kWh measurement.',
    );
    set(
      'rechargeHours',
      selected(/^240V.*EVSE/i),
      (value) =>
        /^approx\s+(\d+(?:\.\d+)?)\s+hours$/i.exec(value)?.[1]
          ? Number(/^approx\s+(\d+(?:\.\d+)?)\s+hours$/i.exec(value)![1])
          : null,
      'Published 240 V/30 A times differ between 10–100% and 20–80% state-of-charge windows. A charging window must be specified before selecting one time.',
    );
  }
  if (fuel === 'Plug-in hybrid') {
    set(
      'electricRangeKm',
      selected(/^EV Range \(km\)/i),
      mitsubishiNumber,
      'Published electric range; total hybrid driving range is a separate value. Actual range varies.',
    );
    set(
      'rechargeHours',
      selected(/^Charging time:\s*240V\s*\/15A/i),
      (value) => {
        const match = /^approx\s+(\d+(?:\.\d+)?)\s+hours$/i.exec(value);
        return match ? Number(match[1]) : null;
      },
      'Manufacturer approximate 240 V/15 A EVSE time; the source label does not establish the state-of-charge window. Actual charging varies.',
    );
  }
  return facts;
}
export function mitsubishiReviewGaps(snapshot: MitsubishiSnapshot) {
  return snapshot.records.flatMap((record) => {
    const model = snapshot.models.find((model) => model.key === record.modelKey)!,
      facts = mitsubishiFacts(record, model);
    return [
      ...(record.specificationGap
        ? [
            {
              brand: 'Mitsubishi',
              configuration: mitsubishiKey(record),
              field: 'specifications',
              reason: record.specificationGap,
            },
          ]
        : []),
      ...Object.entries(facts)
        .filter(([, fact]) => fact.value === null && fact.source)
        .map(([field, fact]) => ({
          brand: 'Mitsubishi',
          configuration: mitsubishiKey(record),
          field,
          reason: fact.note!,
        })),
      ...(record.specification && record.specification.priceCad !== record.model.price.baseValue
        ? [
            {
              brand: 'Mitsubishi',
              configuration: mitsubishiKey(record),
              field: 'msrpCad',
              reason: `Static specification price ${record.specification.priceCad} differs from exact-trim calculator base ${record.model.price.baseValue}. The exact calculator is displayed; independent reconciliation remains open.`,
            },
          ]
        : []),
    ];
  });
}
export function addMitsubishiRetail(base: Catalog, snapshot: MitsubishiSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [];
  for (const model of snapshot.models) {
    sources.push({
      id: priceId(model),
      title: `${model.year} Mitsubishi ${model.name} Canadian factory trim prices and identities`,
      publisher: 'Mitsubishi Motors Canada',
      url: mitsubishiPriceUrl(model),
      reviewedAt,
      publishedAt: null,
      locator: `Public Canadian getModelsSelector with exact vehicle GUID/year, CA/CAD context and MSRP label. Current active codes reconcile against the build-start page and selector. Empty options/paint/accessories; base and separate fee amounts reconcile. Older inventory-family references do not verify individual trim availability.`,
    });
    if (model.specificationsSource)
      sources.push({
        id: specsId(model),
        title: `${model.year} Mitsubishi ${model.name} exact Canadian trim specifications`,
        publisher: 'Mitsubishi Motors Canada',
        url: model.specificationsSource.url,
        reviewedAt,
        publishedAt: null,
        locator: `Official SpecificationsModel table: exact trim id/code/name, parent model and year. Complete model sets reconcile. Units and paired measurements remain explicit; optional arrangements and ambiguous hybrid/charging bases remain unknown.`,
      });
  }
  const cars: Car[] = snapshot.records.map((record) => {
    const model = snapshot.models.find((model) => model.key === record.modelKey)!;
    return {
      id: mitsubishiRecordId(record),
      make: 'Mitsubishi',
      model: model.name,
      year: model.year,
      trim: record.model.name,
      variant: [
        record.model.transmissionDescription || record.model.transmissionType,
        /48V BSG/i.test(record.model.engineType) ? '48 V mild hybrid' : record.model.engineSize,
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 200),
      market: 'CA',
      bodyStyle: 'SUV',
      fuel: mitsubishiFuel(record),
      drivetrain: mitsubishiDrive(record),
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: mitsubishiKey(record),
        code: record.model.code,
        transmission:
          record.model.transmissionDescription || record.model.transmissionType || 'Not verified',
        specificationsUrl: model.specificationsSource?.url ?? mitsubishiPriceUrl(model),
      },
      availability: {
        status: model.currentBuildListing ? 'manufacturer-listed' : 'not-checked',
        checkedAt: model.currentBuildListing ? reviewedAt : null,
        source: model.currentBuildListing ? priceId(model) : null,
        note: model.currentBuildListing
          ? 'Listed in the current Canadian build selector with an exact active factory trim code. Dealer stock, delivery dates and additional equipment remain unconfirmed.'
          : 'This model-year family appears in the national new-inventory feed, while the current build selector omits it. These are exact Canadian factory records; availability of each individual trim has not been checked.',
      },
      sourceIds: [priceId(model), ...(record.specification ? [specsId(model)] : [])],
      facts: mitsubishiFacts(record, model),
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
