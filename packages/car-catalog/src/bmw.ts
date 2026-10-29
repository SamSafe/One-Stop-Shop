import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { bmwRecordKey, bmwReferenceKey } from './bmw-import';
import type { BmwRecord, BmwSnapshot, BmwStockReference } from './bmw-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const bmwRecordId = (row: BmwRecord) => `bmw-ca-${slug(bmwRecordKey(row))}`;
const stockId = 'bmw-ca-national-new-stock';
const priceId = (reference: BmwStockReference) =>
  `bmw-ca-${reference.year}-${slug(reference.code)}-factory`;
const techId = (row: BmwRecord) => `${bmwRecordId(row)}-specs`;
export function bmwMsrp(row: BmwRecord, reference: BmwStockReference): number | null {
  const model = row.prices?.filter(
    (price) => price.category === 'MODEL' && price.key === reference.code,
  );
  if (
    model?.length !== 1 ||
    model[0]!.netListPrice <= 0 ||
    model[0]!.grossListPrice < model[0]!.netListPrice
  )
    return null;
  const transmission = row.configuration?.classifiedConfiguration.transmission;
  const option = transmission?.transmissionOption;
  const amounts = option
    ? row.prices!.filter((price) => price.category === 'OPTION' && price.key === option)
    : [];
  if (
    amounts.length > 1 ||
    amounts.some((price) => price.netListPrice < 0) ||
    (option && !amounts.length && !transmission?.transmissionOptionIsTypeContent)
  )
    return null;
  return model[0]!.netListPrice + (amounts[0]?.netListPrice ?? 0);
}
export function bmwFuel(row: BmwRecord, reference: BmwStockReference): Car['fuel'] {
  if (row.model?.hybrid === 'BEVE' || reference.fuel === 'E') return 'Electric';
  if (row.model?.hybrid === 'PHEV') return 'Plug-in hybrid';
  if (row.configuration?.classifiedConfiguration.volt48.isVolt48Variant) return 'Hybrid';
  if (reference.fuel === 'H') return 'Hybrid';
  if (reference.fuel === 'D') return 'Diesel';
  if (reference.fuel === 'G') return row.configuration ? 'Gasoline' : 'Gasoline / hybrid';
  throw new Error(`BMW fuel classification needs review: ${bmwReferenceKey(reference)}`);
}
export function bmwBody(row: BmwRecord, reference: BmwStockReference): Car['bodyStyle'] {
  const map: Record<string, Car['bodyStyle']> = {
    SUV: 'SUV',
    CABRIOLET: 'Convertible',
    COUP: 'Coupe',
    SEDAN: 'Sedan',
    TOURING: 'Wagon',
  };
  if (map[reference.body]) return map[reference.body]!;
  if (reference.body === 'GRANCOUP') {
    if (row.model?.range === 'G26' || ['4_SERIES', 'i4'].includes(reference.series))
      return 'Hatchback';
    if (
      ['F44', 'F74', 'G16'].includes(row.model?.range ?? '') ||
      ['2_SERIES', '8_SERIES'].includes(reference.series)
    )
      return 'Sedan';
    return 'Not verified';
  }
  throw new Error(`BMW body style needs review: ${reference.body}`);
}
const emptyFacts = () =>
  Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [
      metric,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year, VG/AG code and transmission. Other years, factory defaults, test cycles and energy modes are not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
export function bmwFacts(row: BmwRecord, reference: BmwStockReference): Car['facts'] {
  const facts = emptyFacts(),
    price = bmwMsrp(row, reference);
  facts.msrpCad = {
    value: price,
    source: priceId(reference),
    note:
      price === null
        ? `No valid CAD RRP_NET price was established for exact ${bmwReferenceKey(reference)} and its transmission. Supplier/dealer base prices, discounts and all-in totals are not substituted.`
        : `Exact Canadian ${bmwReferenceKey(reference)}: public-calculation CAD/RRP_NET MODEL net list price plus a separately selected transmission option, if applicable. Excludes other options/paint, freight/PDI, retailer fees, levies, taxes and incentives. ${row.modelBaseOnly ? 'This is a published bare-model MSRP. Current factory ordering/transmission choices are not verified; observed stock transmissions are not priced as optional configurations.' : 'The classified transmission and required option code must reconcile with the exact factory calculation.'}`,
  };
  const values = row.technical?.values;
  if (!values) return facts;
  const number = (key: string) => {
    const value = values[key]?.targetValue;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const set = (metric: Metric, value: number | null, note: string) => {
    if (value === null) return;
    const definition = metricDefinitions[metric];
    facts[metric] = {
      value: value >= definition.min && value <= definition.max ? value : null,
      source: techId(row),
      sourceUrl: row.technicalSource!.url,
      note,
    };
  };
  for (const [metric, key, imperial] of [
    ['lengthMm', 'A_LAENGE', 'A_US_LAENGE'],
    ['widthMm', 'A_BREITE_GES_SPIEGEL', 'A_US_BREITE_GES_SPIEGEL'],
    ['heightMm', 'A_HOEHE', 'A_US_HOEHE'],
  ] as const) {
    const value = number(key),
      pair = number(imperial);
    set(
      metric,
      value !== null && value > 0 && (pair === null || Math.abs(value - pair * 25.4) <= 2)
        ? value
        : null,
      `Exact resolved Canadian VG ${reference.code}, AG ${reference.agCode}: manufacturer metric ${key}. ${metric === 'widthMm' ? 'Width includes mirrors. ' : ''}When imperial values are present, the metric/imperial pair must agree within rounding tolerance. Zero placeholders are not measurements.`,
    );
  }
  const hp = number('C_LEIST_GES_KOMM_BHP');
  set(
    'horsepower',
    hp,
    `Manufacturer combined powertrain BHP field C_LEIST_GES_KOMM_BHP for the exact AG code and resolved options. Engine-only hp, metric PS, continuous motor power and separately rated motor outputs are not substituted, converted or summed.`,
  );
  const seats = number('N_SITZE');
  set(
    'seats',
    seats !== null && Number.isInteger(seats) ? seats : null,
    'Manufacturer N_SITZE for the exact resolved configuration. Optional seating arrangements require separate evidence.',
  );
  const cargo = number('A_GEPR_V210');
  if (cargo !== null)
    for (const metric of ['cargoSeatsUpL', 'cargoSeatsDownL'] as const)
      facts[metric] = {
        value: null,
        source: techId(row),
        sourceUrl: row.technicalSource!.url,
        note: `Published luggage field A_GEPR_V210 is ${cargo} L, but its seating/loading arrangement is not established by this capture. It is not assigned to seats-up/down volume.`,
      };
  for (const metric of [
    'fuelCityL100km',
    'fuelHighwayL100km',
    'fuelCombinedL100km',
    'electricCombinedKwh100km',
    'electricModeFuelL100km',
    'electricModeLe100km',
    'electricRangeKm',
    'rechargeHours',
  ] as const)
    facts[metric].note =
      'No exact Canadian consumption/range/charging-mode join is established. The Canadian configurator uses a technical countryGroup named us; unlabeled, US-cycle, WLTP, engine-only and mixed-mode values are not treated as Canadian operating-mode figures.';
  return facts;
}
export function bmwReviewGaps(snapshot: BmwSnapshot) {
  const references = new Map(
    snapshot.inventory.modelReferences.map((reference) => [bmwReferenceKey(reference), reference]),
  );
  return [
    ...snapshot.matrixModels
      .filter(
        (model) =>
          !snapshot.inventory.modelReferences.some(
            (reference) => reference.code === model.code && reference.agCode === model.agCode,
          ),
      )
      .map((model) => ({
        brand: 'BMW',
        configuration: model.code,
        field: 'model-year',
        reason: `The Canadian current model tree lists ${model.name} (${model.range}/${model.agCode}), but the captured stock feed supplies no exact year mapping for this code/AG identity. No model year is inferred from a code prefix. Current offering/ordering/year reconciliation remains open.`,
      })),
    ...snapshot.overview
      .filter(
        (card) =>
          !card.code ||
          !snapshot.inventory.modelReferences.some(
            (reference) => reference.code === card.code && reference.agCode === card.agCode,
          ),
      )
      .map((card) => ({
        brand: 'BMW',
        configuration: card.label,
        field: 'overview-reference',
        reason: `Overview ${card.code ?? card.id}, ${card.flag || 'unflagged'}: an exact Canadian stock year/retail identity is not established. Concept/future/AG-code placeholders and unmatched older offerings require their own identity review.`,
      })),
    ...snapshot.records.flatMap((record) => {
      const reference = references.get(record.referenceKey)!;
      const facts = bmwFacts(record, reference);
      return Object.entries(facts)
        .filter(([, fact]) => fact.value === null)
        .map(([field, fact]) => ({
          brand: 'BMW',
          configuration: bmwRecordKey(record),
          field,
          reason: fact.note!,
        }));
    }),
  ];
}
export function addBmwRetail(base: Catalog, snapshot: BmwSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10),
    inventoryDate = snapshot.inventory.retrievedAt.slice(0, 10);
  const sources: Source[] = [
    {
      id: stockId,
      title: 'BMW Canada national new-inventory model/year identities',
      publisher: 'BMW Canada',
      url: 'https://inventory.bmw.ca/en/NewInventorySearch?site=bmw.ca',
      reviewedAt: inventoryDate,
      publishedAt: null,
      locator:
        'Official national new-vehicle search embedded by bmw.ca. Brand BMW, Status N, no province/series/engine/year/price filters, all reported 48-record pages. Explicit ModelYear/VGCode/AGCode, names and transmissions. Repeated page identities leave exhaustive inventory coverage unproven; observed exact configurations remain dated listings.',
    },
  ];
  const references = new Map(
    snapshot.inventory.modelReferences.map((reference) => [bmwReferenceKey(reference), reference]),
  );
  const added = new Set<string>();
  const cars: Car[] = snapshot.records.map((row) => {
    const reference = references.get(row.referenceKey)!,
      id = priceId(reference),
      facts = bmwFacts(row, reference);
    if (!added.has(id)) {
      sources.push({
        id,
        title: `${reference.year} BMW ${reference.name} Canadian VG ${reference.code} factory pricing`,
        publisher: 'BMW Canada',
        url: row.model
          ? `https://configure.bmw.ca/en_CA/configure/${row.model.range}/${reference.code}`
          : 'https://www.bmw.ca/en/all-models.html',
        reviewedAt,
        publishedAt: null,
        locator:
          'Exact Canadian VG code and separately sourced stock model year/AG identity. Public CAD RRP_NET MODEL net list price and classified transmission option, before freight, fees, taxes, incentives and discretionary equipment. Current ordering may be unavailable for older stock; dealer base prices are not substituted.',
      });
      added.add(id);
    }
    if (row.technical)
      sources.push({
        id: techId(row),
        title: `${reference.year} BMW ${reference.code} exact AG/configuration technical data`,
        publisher: 'BMW Canada',
        url: row.technicalSource!.url,
        reviewedAt,
        publishedAt: null,
        locator: `Official Canadian configurator-selected AG ${reference.agCode}, exact VG ${reference.code} and resolved factory options. The client service uses countryGroup us; Canadian fuel-cycle ratings require their own verified source. Metric dimensions, explicit combined BHP and seating are kept; unresolved cargo arrangements and energy modes remain unknown.`,
      });
    const transmission = row.configuration?.classifiedConfiguration.transmission;
    const gears = row.technical?.values.GETR_ANZG?.targetValue;
    const transmissionLabel = transmission
      ? `${typeof gears === 'number' && gears > 0 ? `${gears}-speed ` : ''}${transmission.type}${transmission.transmissionOption ? ` · ${transmission.transmissionOption}` : ''}`
      : `Not verified for ordering; stock lists ${reference.transmissions.join(' / ')}`;
    const model = reference.name.startsWith('ALPINA ')
      ? reference.name.split(' ').slice(0, 2).join(' ')
      : reference.body === 'TOURING' && reference.series === 'M5'
        ? 'M5 Touring'
        : reference.series.replace(/^(\d)_SERIES$/, '$1 Series');
    const mild = row.configuration?.classifiedConfiguration.volt48.isVolt48Variant;
    const fuel = bmwFuel(row, reference);
    return {
      id: bmwRecordId(row),
      make: 'BMW',
      model,
      trim: reference.name,
      year: reference.year,
      market: 'CA',
      bodyStyle: bmwBody(row, reference),
      fuel,
      drivetrain:
        row.model?.drive === 'AR'
          ? 'AWD'
          : row.model?.drive === 'HR'
            ? 'RWD'
            : row.model?.drive === 'VR'
              ? 'FWD'
              : 'Not verified',
      recordKind: 'retail-trim',
      variant:
        `${transmissionLabel}${mild ? ' · 48 V mild hybrid' : fuel === 'Gasoline / hybrid' ? ' · gasoline stock fuel; hybrid subtype not verified' : ''}`.slice(
          0,
          200,
        ),
      manufacturerConfiguration: {
        id: bmwRecordKey(row),
        code: reference.code,
        transmission: transmissionLabel.slice(0, 100),
        ...(row.technicalSource ? { specificationsUrl: row.technicalSource.url } : {}),
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: inventoryDate,
        source: stockId,
        note: `Exact ${reference.year}/${reference.code}/${reference.agCode} appears in the dated Canadian new-stock feed. ${row.configuration ? 'The factory solver also establishes this transmission configuration; dealer stock of that exact option selection is not guaranteed.' : 'Current factory ordering and additional transmission/equipment choices remain unverified.'} Repeated national inventory pages leave additional offerings unproven; listings and delivery can change.`,
      },
      sourceIds: [stockId, id, ...(row.technical ? [techId(row)] : [])],
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
