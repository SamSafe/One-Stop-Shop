import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { vwConfigureUrl, vwKey, vwSelectorUrl } from './volkswagen-import';
import type { VwRecord, VwSnapshot } from './volkswagen-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const sourceId = (record: VwRecord) =>
  `vw-ca-${record.key.modelYear}-${record.key.carlineId}-${record.key.salesgroupId}-factory-catalogue`;
export const vwRecordId = (record: VwRecord) =>
  `vw-ca-${record.key.modelYear}-${record.key.carlineId}-${record.key.salesgroupId}-${slug(record.key.modelId)}-v${slug(record.key.modelVersion)}`;
export function vwNumber(value: string): number | null {
  const normalized = value.trim().replace(/^(\d{1,2}),(\d{1,2})$/, '$1.$2');
  return /^\d+(?:,\d{3})*(?:\.\d+)?$/.test(normalized)
    ? Number(normalized.replace(/,/g, ''))
    : null;
}
export function vwUnit(value: string, unit: string): number | null {
  const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^\\s*([\\d,.]+)\\s*(?:${escaped}|\\(${escaped}\\))\\s*$`, 'i').exec(
    value,
  );
  return match ? vwNumber(match[1]!) : null;
}
export function vwMsrp(record: VwRecord): number | null {
  const prices = record.factory.prices.filter(
    (price) => price.type === 'price' && price.currency === 'CAD' && !price.vatIncluded,
  );
  return prices.length === 1 ? prices[0]!.price : null;
}
const fields = (record: VwRecord) => record.factory.technicalData.flatMap((group) => group.values);
export function vwFuel(record: VwRecord): Car['fuel'] {
  const evidence = [
    ...record.engineTypes,
    ...record.factory.modelFilters
      .filter((filter) => filter.type === 'FuelType')
      .map((filter) => filter.text),
    ...fields(record)
      .filter((field) => field.description === 'Fuel Requirement')
      .map((field) => field.value),
  ].join(' ');
  if (/plug.in.hybrid/i.test(evidence)) return 'Plug-in hybrid';
  if (/hybrid/i.test(evidence)) return 'Hybrid';
  if (/electric/i.test(evidence)) return 'Electric';
  if (/diesel/i.test(evidence)) return 'Diesel';
  if (/\bgas\b|gasoline|unleaded/i.test(evidence)) return 'Gasoline';
  throw new Error(`VW fuel classification requires source review: ${vwKey(record.key)}`);
}
export function vwDrive(record: VwRecord): Car['drivetrain'] {
  const value = String(record.factory.modelMetaData.driveType ?? record.driveType)
    .toLowerCase()
    .replace(/-/g, ' ');
  if (value === 'all wheel drive') return 'AWD';
  if (value === 'front wheel drive') return 'FWD';
  if (value === 'rear wheel drive') return 'RWD';
  if (value === 'four wheel drive') return '4WD';
  return 'Not verified';
}
export function vwTransmission(record: VwRecord) {
  const transmission = record.factory.modelFilters.find(
    (filter) => filter.type === 'Transmission',
  )?.text;
  const gears = record.factory.modelFilters.find((filter) => filter.type === 'Gear')?.text;
  return (
    [gears && !/speed/i.test(gears) ? `${gears}-speed` : gears, transmission]
      .filter(Boolean)
      .join(' ')
      .slice(0, 100) || 'Not verified'
  );
}
export function vwBody(record: VwRecord): Car['bodyStyle'] {
  if (record.modelName === 'ID. Buzz') return 'Van';
  if (record.bodyTypes.includes('SUV')) return 'SUV';
  if (record.bodyTypes.includes('Sedans')) return 'Sedan';
  if (['Golf GTI', 'Golf R'].includes(record.modelName)) return 'Hatchback';
  return 'Not verified';
}
export function vwFacts(record: VwRecord): Car['facts'] {
  const source = sourceId(record),
    url = vwConfigureUrl(record),
    technical = fields(record),
    fuel = vwFuel(record);
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [
      metric,
      {
        value: null,
        source: null,
        note: 'Not published or not yet verified for this exact Canadian factory model. Alternative roof, equipment and seating arrangements require review.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  const price = vwMsrp(record);
  facts.msrpCad = {
    value: price,
    source,
    sourceUrl: url,
    note:
      price === null
        ? 'No unique tax-exclusive CAD factory model price of type price was verified. Regional selling prices and incentives are not substituted.'
        : `Canadian factory ${vwKey(record.key)} prices[type=price], CAD, vatIncluded=false. This is the model base price used by the public configurator, including any factory package already encoded in modelId. Excludes separately added freight/PDI, levies, dealer charges, taxes, optional paint/accessories and incentives. It is not the regional selling price or a dealer quote.`,
  };
  function set(
    metric: Metric,
    selected: typeof technical,
    parse: (value: string) => number | null,
    note = '',
  ) {
    if (!selected.length) return;
    const values = [...new Set(selected.map((field) => parse(field.value)))],
      def = metricDefinitions[metric];
    const value =
      values.length === 1 && values[0] !== null && values[0]! >= def.min && values[0]! <= def.max
        ? values[0]!
        : null;
    facts[metric] = {
      value,
      source,
      sourceUrl: url,
      note: `${vwKey(record.key)}: ${selected.map((field) => `${field.description}: ${field.value}`).join('; ')}. ${value === null ? 'Missing/ambiguous units or alternative values need review. ' : ''}${note}`.slice(
        0,
        1000,
      ),
    };
  }
  const selected = (pattern: RegExp) =>
    technical.filter((field) => pattern.test(field.description));
  set(
    'seats',
    selected(/^Seating Capacity$/i),
    vwNumber,
    'Published standard seating. Optional seating arrangements require separate configuration evidence.',
  );
  for (const [metric, pattern] of [
    ['lengthMm', /^Length(?: \(mm\))?$/i],
    ['widthMm', /^Width excluding mirrors(?: \(mm\))?$/i],
    ['heightMm', /^Height(?: \(mm\))?$/i],
    ['frontHeadroomMm', /^Headroom.*1st Row/i],
    ['rearHeadroomMm', /^Headroom.*2nd Row/i],
    ['frontLegroomMm', /^Legroom 1st Row/i],
    ['rearLegroomMm', /^Legroom 2nd Row/i],
  ] as const)
    set(
      metric,
      selected(pattern),
      (value) => vwUnit(value, 'mm'),
      /Headroom/.test(metric)
        ? 'With/without-sunroof alternatives remain unknown unless their published values agree.'
        : metric === 'widthMm'
          ? 'Published width excludes mirrors.'
          : /rear/.test(metric)
            ? 'Rear room means the second row.'
            : '',
    );
  set(
    'horsepower',
    selected(/^(?:Net Horsepower|Horsepower \(HP\))$/i),
    (value) => {
      const match = /^\s*(\d+(?:\.\d+)?)\s*hp(?:\s*@\s*[\d, .\-]+\s*rpm)?\s*$/i.exec(value);
      return match ? Number(match[1]) : null;
    },
    'Published hp output. PS and kW values require separate unit conversion. Engine and motor values remain separate.',
  );
  const third = (facts.seats.value ?? 0) >= 6;
  set(
    'cargoSeatsUpL',
    selected(third ? /^Cargo Volume behind 3rd row/i : /^Cargo Volume behind 2nd row/i),
    (value) => vwUnit(value, 'l'),
    'All seating rows upright. Cargo measurement standards differ by manufacturer.',
  );
  set(
    'cargoSeatsDownL',
    selected(/^Cargo Volume behind 1st row/i),
    (value) => vwUnit(value, 'l'),
    'Maximum published volume behind the front row; confirm whether rear-seat removal or folding is required.',
  );
  if (fuel === 'Electric') {
    set(
      'electricCombinedKwh100km',
      selected(/^Combined \(kWh\/100km\)$/i),
      (value) => vwUnit(value, 'kWh/100km'),
      'Electrical energy consumption; not L/100 km or gasoline-equivalent Le/100 km.',
    );
    set(
      'electricRangeKm',
      selected(/^Range \(km\)$/i),
      (value) => vwUnit(value, 'km'),
      'Manufacturer published Canadian range. Actual range varies.',
    );
    set(
      'rechargeHours',
      selected(/^Charging Time 0%-100% \(Home or public AC charging station\)/i),
      (value) => {
        const match = /^(\d{1,2}):(\d{2}) h$/.exec(value);
        return match && Number(match[2]) < 60 ? Number(match[1]) + Number(match[2]) / 60 : null;
      },
      'Several AC charger powers are published; without a specified power, no arbitrary home-charging time is selected. DC fast-charge and standard-outlet windows are not mixed.',
    );
  }
  if (!['Electric', 'Plug-in hybrid'].includes(fuel))
    for (const [metric, label] of [
      ['fuelCityL100km', 'Fuel City'],
      ['fuelHighwayL100km', 'Fuel Highway'],
      ['fuelCombinedL100km', 'Fuel Combined'],
    ] as const)
      set(
        metric,
        technical.filter((field) => field.description === label),
        (value) => vwUnit(value, 'l/100km'),
        'Published Canadian L/100km. Decimal-comma displays are normalized; actual consumption varies.',
      );
  else
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        fuel === 'Electric'
          ? 'Not applicable to battery-electric propulsion. Electricity and gasoline-equivalent energy are not treated as liquid fuel consumed.'
          : 'Plug-in operating modes require separate verification before a whole-journey fuel estimate.';
  return facts;
}
export function vwReviewGaps(snapshot: VwSnapshot) {
  return snapshot.records.flatMap((record) =>
    Object.entries(vwFacts(record))
      .filter(([, fact]) => fact.value === null && fact.source !== null)
      .map(([field, fact]) => ({
        brand: 'Volkswagen',
        configuration: vwKey(record.key),
        field,
        reason: fact.note!,
      })),
  );
}
export function addVolkswagenRetail(base: Catalog, snapshot: VwSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [
      ...new Map(snapshot.records.map((record) => [sourceId(record), record])).values(),
    ].map((record) => {
      const model = snapshot.models.find((model) => model.nodeId === record.modelNode)!;
      return {
        id: sourceId(record),
        title: `${model.year} Volkswagen ${model.name} Canadian factory models, MSRP and technical data`,
        publisher: 'Volkswagen Canada',
        url: vwSelectorUrl,
        reviewedAt,
        publishedAt: null,
        locator: `Current model overview plus exact Canadian catalogue carline/salesgroup/model/year/version joins. Factory model prices, CAD, vatIncluded=false; regional fees, colours and incentives are separate. All published trim engines reconcile, including non-default transmissions, encoded packages and configure-disabled listed years. Checksum-verified source responses retained.`,
      };
    });
  const cars: Car[] = snapshot.records.map((record) => ({
    id: vwRecordId(record),
    make: 'Volkswagen',
    model: record.modelName,
    year: Number(record.key.modelYear),
    trim: record.trimName,
    variant: vwTransmission(record),
    market: 'CA',
    bodyStyle: vwBody(record),
    fuel: vwFuel(record),
    drivetrain: vwDrive(record),
    recordKind: 'retail-trim',
    manufacturerConfiguration: {
      id: vwKey(record.key),
      code: record.key.modelId,
      transmission: vwTransmission(record),
      specificationsUrl: vwConfigureUrl(record),
    },
    availability: {
      status: 'manufacturer-listed',
      checkedAt: reviewedAt,
      source: sourceId(record),
      note: 'Listed in the current Canadian model overview with an exact factory trim/engine reference, including listed years with online building disabled. Dealer stock, delivery dates, older new inventory and additional equipment combinations require confirmation.',
    },
    sourceIds: [sourceId(record)],
    facts: vwFacts(record),
  }));
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
