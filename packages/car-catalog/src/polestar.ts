import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import {
  polestarIdentity,
  polestarSelected,
  polestarStockIdentity,
  polestarInventoryRecords,
} from './polestar-import';
import type {
  PolestarFactoryRecord,
  PolestarSnapshot,
  PolestarStockRecord,
} from './polestar-import';

// Deterministic IDs retain the full model-year/structure-week/PNO identity in the
// snapshot. A collision is rejected by the catalog's duplicate-ID validation.
export function polestarRecordId(identity: string) {
  let hash = 14695981039346656037n;
  for (const character of identity)
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.charCodeAt(0))) * 1099511628211n);
  return `polestar-ca-${identity.slice(0, 4)}-${hash.toString(16).padStart(16, '0')}`;
}
const clean = (value: string) =>
  value
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
export function polestarUnit(value: string, unit: string, epa = false): number | null {
  const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `^${epa ? '(?:Up to )?' : ''}(\\d+(?:,\\d{3})*(?:\\.\\d+)?) ${escaped}${epa ? ' \\(EPA\\)' : ''}$`,
  ).exec(clean(value));
  return match ? Number(match[1]!.replace(/,/g, '')) : null;
}
const sourceId = (year: string, code: string, kind: 'factory' | 'stock') =>
  `polestar-ca-${year}-${code}-${kind}`;
const initialFacts = () =>
  Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not published or not verified for this exact Canadian model-year, structure week and equipped factory configuration. Other years, wheel/roof arrangements and test cycles are not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
const factoryIdentity = (row: PolestarFactoryRecord) =>
  polestarIdentity(
    row.configuration.model.modelYear,
    row.configuration.model.structureWeek,
    row.configuration.pno34,
  );
export function polestarFactoryMsrp(record: PolestarFactoryRecord): number | null {
  const data = record.configuration.cpsPriceBreakdown,
    price = data.car.carTotalBasicPrice.value;
  return price > 0 &&
    price === data.car.carTotalPrice.value &&
    data.delivery.deliveryChargeBasicPrice.value >= 0 &&
    Math.abs(
      price +
        data.delivery.deliveryChargeBasicPrice.value -
        data.grandTotal.grandTotalCarExtrasDelivery.grandTotalCarExtrasDeliveryBasicPrice.value,
    ) < 0.01
    ? price
    : null;
}
export function polestarStockMsrp(record: PolestarStockRecord): number | null {
  const price = record.vehicle.cashPriceData?.listPrice?.totals;
  return price &&
    price.car.carTotalBasicPrice.value > 0 &&
    price.car.carTotalBasicPrice.value === price.car.carTotalPrice.value &&
    price.grandTotal.paymentTotal.paymentTotalBasicPrice.value >= price.car.carTotalBasicPrice.value
    ? price.car.carTotalBasicPrice.value
    : null;
}
export function polestarDrive(value: string | null): Car['drivetrain'] {
  return value === 'All-wheel drive'
    ? 'AWD'
    : value === 'Rear-wheel drive'
      ? 'RWD'
      : value === 'Front-wheel drive'
        ? 'FWD'
        : 'Not verified';
}
export function polestarFactoryFacts(record: PolestarFactoryRecord): Car['facts'] {
  const configuration = record.configuration,
    facts = initialFacts(),
    id = sourceId(configuration.model.modelYear, configuration.model.pno3, 'factory');
  const set = (metric: Metric, value: number | null, note: string) => {
    const definition = metricDefinitions[metric];
    facts[metric] = {
      value: value !== null && value >= definition.min && value <= definition.max ? value : null,
      source: id,
      sourceUrl: record.source.url,
      note: note.slice(0, 1000),
    };
  };
  set(
    'msrpCad',
    polestarFactoryMsrp(record),
    `Canadian CAD undiscounted carTotalBasicPrice for exact PNO ${configuration.pno34}, model year ${configuration.model.modelYear}, structure week ${configuration.model.structureWeek}. Includes the selected factory packs, options and default colour/interior/wheels; excludes the separately reconciled delivery charge, taxes, extras and incentives. The discounted starting/checkout amount is not substituted.`,
  );
  const fields = configuration.techData.data,
    selected = (pattern: RegExp) => fields.filter((field) => pattern.test(clean(field.label)));
  const from = (
    metric: Metric,
    pattern: RegExp,
    parse: (value: string) => number | null,
    note: string,
  ) => {
    const rows = selected(pattern);
    if (!rows.length) return;
    const values = [...new Set(rows.map((row) => parse(row.value)))];
    set(
      metric,
      values.length === 1 ? values[0]! : null,
      `${rows.map((row) => `${row.label}: ${row.value}`).join('; ')}. ${note} Unresolved alternatives and ranges remain unknown.`,
    );
  };
  from(
    'horsepower',
    /^Power$/,
    (value) => {
      const match = /^\d+(?:\.\d+)? kW \/ (\d+(?:\.\d+)?) hp$/.exec(clean(value));
      return match ? Number(match[1]) : null;
    },
    'Explicit manufacturer hp figure; kW, continuous output and motor ratings are not converted or added. Published performance may be preliminary.',
  );
  from(
    'electricRangeKm',
    /^Range up to$/,
    (value) => polestarUnit(value, 'km', true),
    'Explicit EPA-labelled km figure for this configured version. The manufacturer may describe it as preliminary; generic Electric range and WLTP figures are not substituted. Actual range varies.',
  );
  from(
    'electricCombinedKwh100km',
    /^Electric energy consumption \(EPA\)/,
    (value) => polestarUnit(value, 'kWh/100 km'),
    'Published EPA-labelled consumption, potentially preliminary. A wheel/configuration range does not establish one exact consumption value.',
  );
  from(
    'co2Gkm',
    /^Direct use CO₂ emissions$/,
    (value) => polestarUnit(value, 'g/km'),
    'Direct-use emissions only; lifecycle footprint is a different measurement.',
  );
  for (const [metric, label] of [
    ['lengthMm', /^Length$/],
    ['heightMm', /^Height$/],
    ['widthMm', /^Width incl\. mirrors$/],
  ] as const)
    from(
      metric,
      label,
      (value) => polestarUnit(value, 'mm'),
      metric === 'widthMm'
        ? 'Published width includes mirrors.'
        : 'Exact configured model/year dimension.',
    );
  from(
    'rechargeHours',
    /^AC charging 0% – 100%$/,
    (value) => {
      const match = /^(\d+(?:\.\d+)?) hours \((\d+(?:\.\d+)?) kW\)$/.exec(clean(value));
      return match ? Number(match[1]) : null;
    },
    'AC 0–100% at the stated kW supply; DC 10–80% time is not substituted. Conditions affect charging time.',
  );
  for (const metric of [
    'fuelCityL100km',
    'fuelHighwayL100km',
    'fuelCombinedL100km',
    'electricModeFuelL100km',
  ] as const)
    facts[metric].note =
      'Battery-electric configuration. Liquid-fuel consumption is not applicable; electricity and gasoline-equivalent energy use different units.';
  return facts;
}
export function polestarStockFacts(record: PolestarStockRecord): Car['facts'] {
  const vehicle = record.vehicle,
    facts = initialFacts(),
    id = sourceId(vehicle.modelYear, vehicle.pno34.slice(0, 3), 'stock');
  const set = (metric: Metric, value: number | null, note: string) => {
    const definition = metricDefinitions[metric];
    facts[metric] = {
      value: value !== null && value >= definition.min && value <= definition.max ? value : null,
      source: id,
      note: note.slice(0, 1000),
    };
  };
  set(
    'msrpCad',
    polestarStockMsrp(record),
    `Undiscounted Canadian new-stock listPrice.carTotalBasicPrice for exact equipped PNO ${vehicle.pno34}, model year ${vehicle.modelYear}, structure week ${vehicle.startStructureWeek}. Includes this stock car's colour, upholstery, wheels and factory equipment; excludes separate delivery/taxes and incentives. This is configuration MSRP rather than an inferred bare-trim price.`,
  );
  set(
    'horsepower',
    polestarUnit(vehicle.techData?.engineBev_TotalHp ?? '', 'hp'),
    `Exact stock configuration manufacturer hp field: ${vehicle.techData?.engineBev_TotalHp ?? 'not published'}. No conversion from kW, summation or current-year substitution.`,
  );
  const primary = vehicle.techData?.engineBev_ElectricRange ?? '',
    alternative = vehicle.techData?.engineBev_ElectricRangeEpaMiles;
  const range = polestarUnit(primary, 'km', true);
  set(
    'electricRangeKm',
    !alternative || alternative === primary ? range : null,
    `Exact stock EPA-labelled range: ${primary || 'not published'}; alternate field: ${alternative ?? 'not published'}. Explicit km units are required despite the API field name. Manufacturer figures may be preliminary. Other years and test cycles are not substituted.`,
  );
  return facts;
}
export function polestarReviewGaps(snapshot: PolestarSnapshot) {
  const factoryGaps = snapshot.factoryRecords.flatMap((row) => {
    const facts = polestarFactoryFacts(row),
      model = row.configuration.model,
      gaps: { brand: string; configuration: string; field: string; reason: string }[] = [];
    const configuration = `${model.modelYear} ${model.displayName} ${row.configuration.engineName} ${polestarRecordId(factoryIdentity(row))}`;
    const generic = row.configuration.techData.data.find(
      (field) => field.label === 'Electric range',
    );
    if (generic && polestarUnit(generic.value, 'km') !== facts.electricRangeKm.value)
      gaps.push({
        brand: 'Polestar',
        configuration,
        field: 'electricRangeKm',
        reason: `Generic Electric range ${generic.value} differs from the EPA-labelled figure ${facts.electricRangeKm.value ?? 'unknown'} km. The explicitly labelled EPA field is displayed; independent test-cycle reconciliation remains open.`,
      });
    for (const [metric, fact] of Object.entries(facts))
      if (
        fact.value === null &&
        ![
          'fuelCityL100km',
          'fuelHighwayL100km',
          'fuelCombinedL100km',
          'electricModeFuelL100km',
          'electricModeLe100km',
        ].includes(metric)
      )
        gaps.push({ brand: 'Polestar', configuration, field: metric, reason: fact.note! });
    return gaps;
  });
  const stockGroups = new Set(
    snapshot.inventories.flatMap((inventory) =>
      polestarInventoryRecords(snapshot, inventory).map(
        (row) => `${row.vehicle.modelYear}/${inventory.modelCode}`,
      ),
    ),
  );
  return [
    ...factoryGaps,
    ...[...stockGroups].map((configuration) => ({
      brand: 'Polestar',
      configuration,
      field: 'stock-specifications',
      reason:
        'Exact equipped new-stock price, hp and EPA-labelled range are retained. Additional dimensions, seating, cabin/cargo, electric-consumption and charging data require an exact PNO/year/structure-week match; current factory defaults are not copied into other stock configurations.',
    })),
  ];
}
export function addPolestarRetail(base: Catalog, snapshot: PolestarSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [],
    cars: Car[] = [];
  const names = new Map(
    snapshot.models.map((model) => [
      model.initial.configuration.model.pno3,
      {
        slug: model.slug,
        name: model.initial.configuration.model.displayName.replace(/^Polestar /, ''),
      },
    ]),
  );
  const addedSources = new Set<string>();
  function source(year: string, code: string, kind: 'factory' | 'stock') {
    const id = sourceId(year, code, kind),
      model = names.get(code);
    if (!model) throw new Error(`Polestar model code needs review: ${code}`);
    if (!addedSources.has(id)) {
      sources.push({
        id,
        title: `${year} Polestar ${model.name} Canadian ${kind === 'factory' ? 'factory configurations and exact technical fields' : 'equipped new-stock configurations'}`,
        publisher: 'Polestar Canada',
        reviewedAt,
        publishedAt: null,
        url: `https://www.polestar.com/en-ca/${kind === 'factory' ? `configure/${model.slug}` : `stock-cars/${model.slug}`}/`,
        locator:
          kind === 'factory'
            ? 'CA/CAD/en-CA public initconfig and read-only configuration transitions; exact model year, structure week, PNO and selected motor/packs/single options. Price excludes delivery, taxes and incentives. Explicitly labelled EPA fields are distinct from generic range; some published data is preliminary.'
            : 'Public Canadian Preconfigured stock GraphQL: every current listed retailer/model combination and reported ten-record page captured. Repeated page identities leave distinct exhaustive stock coverage unproven. Exact PNO, year, structure week, factory list price and stock technical fields. Stock and delivery can change; this is not a delivery guarantee.',
      });
      addedSources.add(id);
    }
    return { id, model };
  }
  const factory = new Map(snapshot.factoryRecords.map((row) => [factoryIdentity(row), row]));
  const stock = new Map<string, PolestarStockRecord>();
  for (const inventory of snapshot.inventories)
    for (const record of polestarInventoryRecords(snapshot, inventory)) {
      const key = polestarStockIdentity(record.vehicle),
        existing = stock.get(key);
      if (
        existing &&
        (polestarStockMsrp(existing) !== polestarStockMsrp(record) ||
          JSON.stringify(existing.vehicle.techData) !== JSON.stringify(record.vehicle.techData))
      )
        throw new Error('Polestar same-identity stock evidence conflicts across retailers.');
      if (!existing) stock.set(key, record);
    }
  for (const [identity, row] of factory) {
    const configuration = row.configuration,
      { id, model } = source(configuration.model.modelYear, configuration.model.pno3, 'factory'),
      selected = polestarSelected(configuration),
      facts = polestarFactoryFacts(row),
      listed = stock.get(identity);
    if (listed && polestarStockMsrp(listed) !== facts.msrpCad.value)
      throw new Error('Polestar factory/stock price conflict needs review.');
    const stockSource = listed
      ? source(configuration.model.modelYear, configuration.model.pno3, 'stock').id
      : null;
    const recordId = polestarRecordId(identity);
    cars.push({
      id: recordId,
      make: 'Polestar',
      model: model.name,
      trim: configuration.engineName,
      year: Number(configuration.model.modelYear),
      market: 'CA',
      bodyStyle: configuration.model.pno3 === '534' ? 'Hatchback' : 'SUV',
      fuel: 'Electric',
      drivetrain: polestarDrive(
        configuration.techData.data.find((field) => field.label === 'Drivetrain')?.value ?? null,
      ),
      recordKind: 'retail-trim',
      variant:
        selected
          .filter(
            (item) =>
              ['Packages', 'Rims'].includes(item.type) ||
              (item.type === 'SingleOptions' && (item.unformattedPrice ?? 0) > 0),
          )
          .map((item) => item.name)
          .join(' · ')
          .slice(0, 200) || 'Factory standard equipment',
      manufacturerConfiguration: {
        id: recordId,
        code: `${configuration.model.pno3}/${selected.find((item) => item.type === 'Engine')!.code}/${configuration.model.structureWeek}`,
        transmission: 'Electric drive; gearbox not separately published',
        specificationsUrl: row.source.url,
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: stockSource ?? id,
        note: `Listed in the Canadian factory configurator${listed ? ' and exact new-stock results' : ''}. Delivery: ${configuration.delivery.data.value}. Estimated dates, including dates announced later, do not guarantee immediate stock or delivery. Exact dealer availability can change.`,
      },
      sourceIds: [id, ...(stockSource ? [stockSource] : [])],
      facts,
    });
  }
  for (const [identity, row] of stock) {
    if (factory.has(identity)) continue;
    const vehicle = row.vehicle,
      code = vehicle.pno34.slice(0, 3),
      { id, model } = source(vehicle.modelYear, code, 'stock'),
      engine = vehicle.content.find((field) => field.featureType === 'Engine'),
      recordId = polestarRecordId(identity);
    if (!engine?.name || vehicle.pno34.slice(3, 5) !== engine.featureCode)
      throw new Error('Polestar stock engine identity is missing.');
    cars.push({
      id: recordId,
      make: 'Polestar',
      model: model.name,
      trim: engine.name,
      year: Number(vehicle.modelYear),
      market: 'CA',
      bodyStyle: code === '534' ? 'Hatchback' : 'SUV',
      fuel: 'Electric',
      drivetrain: polestarDrive(vehicle.techData?.drive ?? null),
      recordKind: 'retail-trim',
      variant:
        vehicle.content
          .filter((field) =>
            ['Color', 'Rims', 'Packages', 'SingleOptions', 'Upholstery'].includes(
              field.featureType,
            ),
          )
          .map((field) => field.name)
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200) || 'Exact equipped new-stock configuration',
      manufacturerConfiguration: {
        id: recordId,
        code: `${code}/${engine.featureCode}/${vehicle.startStructureWeek}`,
        transmission: 'Electric drive; gearbox not separately published',
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: id,
        note: `Exact PNO/model-year/structure-week configuration in the public Canadian new-stock feed. Delivery label: ${vehicle.earliestDeliveryDateLabel || 'not established'}. Listings and estimates can change; this is not a stock quantity or delivery guarantee.`,
      },
      sourceIds: [id],
      facts: polestarStockFacts(row),
    });
  }
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
