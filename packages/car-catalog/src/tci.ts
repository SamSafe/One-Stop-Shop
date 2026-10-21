import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import type { TciRecord, TciSnapshot } from './tci-import';

type Series = TciSnapshot['series'][number];
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const tciRecordId = (record: TciRecord) =>
  `${record.brand}-ca-${record.year}-${slug(record.seriesCode)}-${slug(record.originalModelCode ?? record.modelCode)}-${slug(record.packageCode)}`;
const sourceId = (series: Series, year: number) =>
  `${series.brand}-ca-${year}-${slug(series.code)}-factory-configurations`;

export function tciNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^\s*\d+(?:\.\d+)?\s*$/.test(value)) return null;
  const number = Number(value);
  return number > 0 ? number : null; // Zero-filled manufacturer fields are unavailable, not measurements.
}
function tciHours(value: string | number | null | undefined) {
  if (typeof value === 'number') return tciNumber(value);
  return typeof value === 'string' ? tciNumber(value.replace(/\s*(?:HRS?|HOURS?)\s*$/i, '')) : null;
}
function matches(rule: Series['rules'][number], record: TciRecord, asOf: string) {
  if (rule.year && String(rule.year) !== String(record.year)) return false;
  for (const [key, value] of [
    ['model', record.modelCode],
    ['package', record.packageCode],
  ] as const)
    if (
      rule[key] &&
      !String(rule[key])
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .includes(value.toUpperCase())
    )
      return false;
  if (rule.startDate && Date.parse(String(rule.startDate)) > Date.parse(asOf)) return false;
  if (rule.endDate && Date.parse(String(rule.endDate)) < Date.parse(asOf)) return false;
  return true;
}
function visible(series: Series, record: TciRecord, flag: string, asOf: string) {
  return (
    record.dimensionsVisible &&
    !series.rules.some((rule) => matches(rule, record, asOf) && rule[flag] === false)
  );
}
export function tciFuel(series: Series): Car['fuel'] {
  const types = new Set(series.powertrains);
  if (types.has('powertrains:fcev')) return 'Hydrogen';
  if (types.has('powertrains:bev')) return 'Electric';
  if (types.has('powertrains:phev')) return 'Plug-in hybrid';
  if (types.has('powertrains:hev') && !types.has('powertrains:gas')) return 'Hybrid';
  if (types.has('powertrains:gas') && !types.has('powertrains:hev')) return 'Gasoline';
  return 'Gasoline / hybrid';
}
function bodyStyle(value: string | null): Car['bodyStyle'] {
  if (!value) return 'Not verified';
  if (/SUV|sport utility/i.test(value)) return 'SUV';
  if (/hatch\s*back/i.test(value)) return 'Hatchback';
  if (/sedan/i.test(value)) return 'Sedan';
  if (/wagon/i.test(value)) return 'Wagon';
  if (/convertible/i.test(value)) return 'Convertible';
  if (/coupe/i.test(value)) return 'Coupe';
  if (/minivan/i.test(value)) return 'Minivan';
  if (/pickup|^[CD] CAB$/i.test(value)) return 'Pickup';
  return 'Not verified';
}
export function tciFacts(record: TciRecord, series: Series, asOf: string): Car['facts'] {
  const source = sourceId(series, record.year);
  const unknown = (): Fact => ({
    value: null,
    source: null,
    note: 'Not published or not yet verified for this exact Canadian factory configuration. Zero-filled manufacturer placeholders are not treated as measured values.',
  });
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [key, unknown()]),
  ) as Car['facts'];
  const dim = record.dimensions;
  function set(metric: Metric, value: number | null, note: string, flag?: string) {
    const definition = metricDefinitions[metric];
    if (
      value !== null &&
      value >= definition.min &&
      value <= definition.max &&
      (!flag || visible(series, record, flag, asOf))
    )
      facts[metric] = { value, source, sourceUrl: record.source.url, note };
  }
  const priceConsistent =
    record.basePrice === null ||
    record.packagePrice === null ||
    record.vehiclePrice === null ||
    Math.abs(record.vehiclePrice - record.basePrice - record.packagePrice) < 0.02;
  if (!record.priceHidden && priceConsistent)
    set(
      'msrpCad',
      tciNumber(record.vehiclePrice),
      `Manufacturer configuration MSRP in CAD, including ${record.packageDescription}. Package cost is included once. Excludes freight/PDI, taxes, levies, dealer fees, premium colours and accessories.`,
    );
  if (record.priceHidden)
    facts.msrpCad.note =
      'The manufacturer hides the price of this configuration; a current price requires confirmation.';
  if (!priceConsistent)
    facts.msrpCad.note = 'Manufacturer price components disagree; price verification is required.';
  set(
    'seats',
    tciNumber(dim.seatingCapacity),
    'Manufacturer seatingCapacity field for the selected factory package.',
    'displaySeatingCapacity',
  );
  for (const [metric, key, flag] of [
    ['lengthMm', 'lengthMm', 'displayLength'],
    ['widthMm', 'widthMm', 'displayWidth'],
    ['heightMm', 'heightMm', 'displayHeight'],
    ['frontHeadroomMm', 'headroomFrontMm', 'displayHeadroomFront'],
    ['rearHeadroomMm', 'headroomSecondRowMm', 'displayHeadroomSecondRow'],
    ['frontLegroomMm', 'legroomFrontMm', 'displayLegroomFront'],
    ['rearLegroomMm', 'legroomSecondRowMm', 'displayLegroomSecondRow'],
  ] as const)
    set(
      metric,
      tciNumber(dim[key]),
      `Manufacturer ${key} field, in millimetres. ${metric === 'widthMm' ? 'Mirror convention is not specified by this field.' : 'Equipment and seating configuration can affect measurements.'}`,
      flag,
    );
  const hp =
    typeof dim.engineHorsePower === 'string'
      ? /^\s*(\d+(?:\.\d+)?)(?:\s*\([\d.]+\))?(?:\s*@\s*[\d,]+\s*RPM)?\s*$/i.exec(
          dim.engineHorsePower,
        )?.[1]
      : dim.engineHorsePower;
  set(
    'horsepower',
    tciNumber(hp),
    'Manufacturer engineHorsePower field in hp; parentheses give kW where present. Engine versus total-system output depends on the source/configuration.',
    'displayEngineHorsepower',
  );
  const seats = tciNumber(dim.seatingCapacity);
  const thirdRow = tciNumber(dim.cargoCapacityBehindThirdRowL);
  const secondRow = tciNumber(dim.cargoCapacityBehindSecondRowL);
  const genericCargo = tciNumber(dim.cargoCapacityL);
  if (seats !== null && seats >= 6) {
    set(
      'cargoSeatsUpL',
      thirdRow,
      'Manufacturer cargo capacity behind the third row, in litres. Measurement standards and seat positions can differ.',
      'displayCargoCapacityBehindThirdRow',
    );
  } else {
    set(
      'cargoSeatsUpL',
      secondRow ?? genericCargo,
      secondRow !== null
        ? 'Manufacturer cargo capacity behind the second row, in litres; measurement methods can differ.'
        : 'Manufacturer cargoCapacityL field; seating position and measurement standard are not stated in this field. Confirm real-world fit.',
      'displayCargoCapacity',
    );
  }
  if (seats !== null && seats > 2)
    set(
      'cargoSeatsDownL',
      tciNumber(dim.cargoCapacityBehindFrontSeatL),
      'Manufacturer cargo capacity behind the front row, in litres; folded/removed seat positions and standards can differ.',
      'displayCargoCapacityBehindFrontSeat',
    );
  const fuel = tciFuel(series);
  if (!['Electric', 'Hydrogen', 'Plug-in hybrid'].includes(fuel)) {
    for (const [metric, key, flag] of [
      [
        'fuelCityL100km',
        'fuelConsumptionRatingCityL100Km',
        'displayFuelConsumptionRatingCityL100km',
      ],
      [
        'fuelHighwayL100km',
        'fuelConsumptionRatingHighwayL100Km',
        'displayFuelConsumptionRatingHighwayL100km',
      ],
      [
        'fuelCombinedL100km',
        'fuelConsumptionRatingCombL100Km',
        'displayFuelConsumptionRatingCombL100km',
      ],
    ] as const)
      set(
        metric,
        tciNumber(dim[key]),
        'Canadian manufacturer-published liquid-fuel consumption in L/100 km; actual consumption varies.',
        flag,
      );
  }
  if (fuel === 'Plug-in hybrid') {
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        'The manufacturer values require an exact fuel-only versus blended-mode check. No gasoline rating or whole-journey cost is assumed from an ambiguous mode.';
  }
  if (fuel === 'Electric' || fuel === 'Hydrogen') {
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        fuel === 'Electric'
          ? 'Not applicable to battery-electric propulsion. A manufacturer gasoline-equivalent field is not gasoline consumed.'
          : 'Hydrogen fuel-cell energy is not a gasoline L/100 km rating.';
  }
  if (fuel === 'Electric' || fuel === 'Plug-in hybrid') {
    set(
      'electricCombinedKwh100km',
      tciNumber(dim.energyConsumptionRatingCombinedKWhPer100km),
      'Manufacturer combined electricity consumption in kWh/100 km; plug-in hybrid mode/basis requires checking before a whole-journey estimate.',
      'displayEnergyConsumptionRatingCombinedKWhPer100km',
    );
    if (fuel === 'Electric') {
      set(
        'electricRangeKm',
        tciNumber(dim.rangeKm) ?? tciNumber(dim.totalDrivingRangeKM),
        'Manufacturer electric driving range; weather, speed and loading affect actual range.',
        'displayRange',
      );
      set(
        'electricModeLe100km',
        tciNumber(dim.fuelConsumptionLe),
        'Gasoline-equivalent energy rating. Le is not gasoline consumed.',
        'displayFuelConsumptionLe',
      );
    }
    const full = tciHours(dim.acL2ChargeTime0to100Pct);
    set(
      'rechargeHours',
      full ?? tciHours(dim.acL2ChargeTime10to100Pct),
      `Manufacturer AC Level 2 charging estimate, ${full !== null ? '0–100%' : '10–100%'}. Equipment and conditions vary; this is not a DC fast-charge time.`,
      full !== null ? 'displayAcL2ChargeTime0to100Pct' : 'displayAcL2ChargeTime10to100Pct',
    );
  }
  return facts;
}

export function addTciRetail(base: Catalog, snapshot: TciSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const sources: Source[] = snapshot.series.flatMap((series) =>
    series.years.map((year) => ({
      id: sourceId(series, year),
      title: `${year} ${series.brand === 'toyota' ? 'Toyota' : 'Lexus'} ${series.name} Canadian configurations`,
      publisher: series.brand === 'toyota' ? 'Toyota Canada' : 'Lexus Canada',
      url: series.source.url,
      reviewedAt,
      publishedAt: null,
      locator:
        'Current Canadian build-and-price display years and factory package records. Each known fact links to its exact package source. Manufacturer-listing evidence does not establish dealer stock or delivery dates.',
    })),
  );
  const records: Car[] = snapshot.records.map((record) => {
    const series = snapshot.series.find(
      (series) => series.brand === record.brand && series.code === record.seriesCode,
    )!;
    const manufacturer = record.brand === 'toyota' ? 'Toyota' : 'Lexus';
    const actualCode = record.originalModelCode ?? record.modelCode;
    const factory = snapshot.models.find(
      (model) =>
        model.brand === record.brand &&
        model.definition?.code === actualCode &&
        model.definition.year === record.year &&
        model.definition.seriesCode === record.seriesCode,
    )?.definition;
    if (!factory) throw new Error(`Unresolved TCI factory identity: ${actualCode}`);
    let trim = factory.description;
    for (const prefix of [
      record.seriesName,
      record.seriesName.replace(/ (?:Hybrid|Plug-in Hybrid|All-Electric)$/i, ''),
    ]) {
      if (
        trim.toLowerCase().startsWith(`${prefix.toLowerCase()} `) &&
        trim.length > prefix.length + 1
      ) {
        trim = trim.slice(prefix.length).trim();
        break;
      }
    }
    const drive =
      /\bAWD\b/i.test(factory.description) && record.dimensions.drivetrain === '4WD'
        ? 'AWD'
        : String(record.dimensions.drivetrain ?? '').toUpperCase();
    const drivetrain: Car['drivetrain'] = ['FWD', 'RWD', 'AWD', '4WD'].includes(drive)
      ? (drive as Car['drivetrain'])
      : 'Not verified';
    return {
      id: tciRecordId(record),
      make: manufacturer,
      model: record.seriesName,
      trim,
      year: record.year,
      market: 'CA',
      bodyStyle: bodyStyle(factory.bodyType),
      fuel: tciFuel(series),
      drivetrain,
      recordKind: 'retail-trim',
      variant: record.packageDescription,
      manufacturerConfiguration: {
        id: `${record.seriesCode}/${record.year}/${actualCode}/${record.packageCode}`,
        code: `${actualCode}-${record.packageCode}`,
        transmission: factory.transmission ?? 'Not verified',
        specificationsUrl: record.source.url,
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: sourceId(series, record.year),
        note: `Listed in the Canadian build-and-price tool for this model year and factory package. Provincial visibility restrictions may apply; dealer stock and delivery dates are not established. ${series.hiddenInProvinces.length ? 'Consult the manufacturer for the recorded provincial restrictions.' : ''}`.trim(),
      },
      sourceIds: [sourceId(series, record.year)],
      facts: tciFacts(record, series, snapshot.retrievedAt),
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...records],
  });
}
