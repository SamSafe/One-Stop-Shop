import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { kiaBuildPage, kiaKey } from './kia-import';
import type { KiaRecord, KiaSnapshot } from './kia-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const sourceId = (record: { year: number; modelName: string }) =>
  `kia-ca-${record.year}-${slug(record.modelName)}-factory-configurations`;
export function kiaNumber(value: string | undefined, unit = '', plain = false): number | null {
  if (!value) return null;
  const escaped = unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(
    `^\\s*(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*${escaped ? `(?:${escaped})${plain ? '?' : ''}` : ''}\\s*\\**\\s*$`,
    'i',
  ).exec(value);
  if (!match) return null;
  const result = Number(match[1]!.replace(/,/g, ''));
  return Number.isFinite(result) && result > 0 ? result : null;
}
export function kiaPower(value: string | undefined) {
  if (!value) return null;
  const cleaned = value.replace(/^Combined Performance:\s*(?:Horsepower:\s*)?/i, '');
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:hp)?(?:\s*@\s*[\d,~–. -]+\s*(?:rpm)?)?\s*\**\s*$/i.exec(
    cleaned,
  );
  return match ? Number(match[1]) : null;
}
export function kiaFuel(record: KiaRecord): Car['fuel'] {
  if (record.isPhev || record.engineType === 'PHEV') return 'Plug-in hybrid';
  if (record.isHev || record.engineType === 'HEV') return 'Hybrid';
  return record.engineType === 'EV' ? 'Electric' : 'Gasoline';
}
export function kiaDrive(record: KiaRecord): Car['drivetrain'] {
  const explicit = record.performance.drivetrain?.toUpperCase();
  const packageDrive = record.packageName?.toUpperCase();
  const named = /\b(AWD|FWD|RWD|4WD)\b/i.exec(record.trimName)?.[1]?.toUpperCase();
  const values = [
    ...new Set(
      [
        explicit,
        packageDrive,
        named,
        ...record.powertrainLabels,
        record.transmission.transmissionConfiguration,
      ]
        .map((value) => {
          const text = value?.toUpperCase().replace(/[-\s]+/g, ' ');
          if (!text) return undefined;
          if (/\bAWD\b|ALL WHEEL DRIVE/.test(text)) return 'AWD';
          if (/\bFWD\b|FRONT WHEEL DRIVE/.test(text)) return 'FWD';
          if (/\bRWD\b|REAR WHEEL DRIVE/.test(text)) return 'RWD';
          if (/\b4WD\b|FOUR WHEEL DRIVE/.test(text)) return '4WD';
          return undefined;
        })
        .filter((value) => value && ['AWD', 'FWD', 'RWD', '4WD'].includes(value)),
    ),
  ];
  return values.length === 1 ? (values[0] as Car['drivetrain']) : 'Not verified';
}
export function kiaFacts(record: KiaRecord): Car['facts'] {
  const unknown = (): Fact => ({
    value: null,
    source: null,
    note: 'Not published or not yet verified for this exact Canadian factory trim/package. Missing fields, alternatives and ambiguous seating/energy modes remain unknown.',
  });
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [metric, unknown()]),
  ) as Car['facts'];
  function set(
    metric: Metric,
    value: number | null,
    field: string,
    raw: string | undefined,
    note = '',
  ) {
    const def = metricDefinitions[metric];
    if (value !== null && value >= def.min && value <= def.max)
      facts[metric] = {
        value,
        source: sourceId(record),
        sourceUrl: kiaBuildPage,
        note: `Factory ${kiaKey(record)}, ${field}: ${raw}. ${note}`.trim(),
      };
  }
  facts.msrpCad = {
    value: record.msrpCad,
    source: sourceId(record),
    sourceUrl: kiaBuildPage,
    note: `Canadian factory ${kiaKey(record)} priceDetails.AB.msrp includes the complete trim/package price. Excludes separately stated delivery/destination, dealer fees, taxes, levies, paint, accessories and incentives. FSC source aliases: ${record.fscCodes.join(', ')}. Confirm current pricing with the retailer.`,
  };
  const dims = record.dimensions;
  for (const [metric, field] of [
    ['lengthMm', 'length'],
    ['widthMm', 'width'],
    ['heightMm', 'height'],
    ['frontHeadroomMm', 'headRoomFront'],
    ['rearHeadroomMm', 'headRoomRear'],
    ['frontLegroomMm', 'legRoomFront'],
    ['rearLegroomMm', 'legRoomRear'],
  ] as const)
    set(
      metric,
      kiaNumber(dims[field], 'mm'),
      `dimensions.${field}`,
      dims[field],
      metric === 'widthMm'
        ? 'Published width; mirror convention is not established.'
        : /rear/i.test(metric)
          ? 'Rear means second row.'
          : '',
    );
  set('seats', kiaNumber(dims.seating), 'dimensions.seating', dims.seating);
  if (!dims.headRoomFront && dims.headRoomFrontWithSunroof)
    facts.frontHeadroomMm = {
      value: null,
      source: sourceId(record),
      sourceUrl: kiaBuildPage,
      note: `Published headRoomFrontWithSunroof: ${dims.headRoomFrontWithSunroof}. Roof applicability needs exact-trim review; this qualified value is not substituted automatically.`,
    };
  const thirdRow = (facts.seats.value ?? 0) >= 6 || Boolean(dims.volumeBehindThirdRow);
  const upField = thirdRow ? 'volumeBehindThirdRow' : 'volumeBehindSecondRow';
  set(
    'cargoSeatsUpL',
    kiaNumber(dims[upField], 'L'),
    `dimensions.${upField}`,
    dims[upField],
    'All seating rows upright. Cargo measurement standards differ by manufacturer.',
  );
  set(
    'cargoSeatsDownL',
    kiaNumber(dims.volumeBehindFirstRow, 'L'),
    'dimensions.volumeBehindFirstRow',
    dims.volumeBehindFirstRow,
    'Volume behind the front row; confirm folding/removal and cargo-floor arrangements for practical fit.',
  );
  for (const [metric, field, fallback] of [
    ['cargoSeatsUpL', upField, 'minimumVolume'],
    ['cargoSeatsDownL', 'volumeBehindFirstRow', 'maximumVolume'],
  ] as const) {
    const raw = dims[field] ?? dims[fallback];
    if (facts[metric].value === null && raw)
      facts[metric] = {
        value: null,
        source: sourceId(record),
        sourceUrl: kiaBuildPage,
        note: `Published dimensions.${dims[field] ? field : fallback}: ${raw}. The source gives alternatives or lacks an explicit seating arrangement. No arbitrary cargo-floor choice or generic minimum/maximum is substituted.`,
      };
  }
  const electric = kiaFuel(record) === 'Electric';
  const combined = record.engine.combinedPowertrainOutput;
  const combinedValue =
    combined && /^\s*(\d+(?:\.\d+)?)\s*HP\s*\|\s*\d+(?:\.\d+)?\s*Torque\s*$/i.exec(combined)?.[1];
  const power = electric ? record.motor.power : (combined ?? record.engine.horsepower);
  set(
    'horsepower',
    combinedValue && !electric ? Number(combinedValue) : kiaPower(power),
    electric ? 'evMotor.power' : combined ? 'engine.combinedPowertrainOutput' : 'engine.horsepower',
    power,
    electric
      ? 'The captured Canadian display label explicitly states Power - hp. No kW value is treated as hp.'
      : 'Engine versus combined-system output is as stated by the manufacturer; engine and motor ratings are not added.',
  );
  if (!['Electric', 'Plug-in hybrid'].includes(kiaFuel(record)))
    for (const [metric, field] of [
      ['fuelCityL100km', 'estimatedFuelEconCity'],
      ['fuelHighwayL100km', 'estimatedFuelEconHwy'],
      ['fuelCombinedL100km', 'estimatedFuelEconCombined'],
    ] as const)
      set(
        metric,
        kiaNumber(record.performance[field], 'L/100km', true),
        `performance.${field}`,
        record.performance[field],
        'Captured Canadian display labels explicitly specify L/100km, including fields whose numeric text omits the unit. Actual consumption varies.',
      );
  else
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note = electric
        ? 'Not applicable to battery-electric propulsion. Le/100km is energy equivalence, not gasoline consumed.'
        : 'The published plug-in fuel fields do not establish the operating-mode split. Fuel-only, blended and electric-mode values need review before a whole-journey estimate.';
  if (electric) {
    const energy = record.performance.energyConsumptionCombined;
    set(
      'electricCombinedKwh100km',
      kiaNumber(energy, 'kWh/100km'),
      'performance.energyConsumptionCombined',
      energy,
    );
    set(
      'electricModeLe100km',
      kiaNumber(energy, 'Le/100km'),
      'performance.energyConsumptionCombined',
      energy,
      'Gasoline-equivalent energy in Le/100 km. Fuel and electricity use the separately published L/100 km and kWh/100 km figures.',
    );
    const range = record.performance.electricDrivingRange?.replace(
      /^AER - All Electric Range \(kms\):\s*/i,
      '',
    );
    set(
      'electricRangeKm',
      kiaNumber(range, 'km', true),
      'performance.electricDrivingRange',
      record.performance.electricDrivingRange,
      'Manufacturer estimated range, including the original footnote qualifiers. Targets and unresolved alternatives remain unverified.',
    );
  }
  const charge = record.performance.chargingLevelTwo;
  const time =
    charge &&
    /^\s*(?:(\d+(?:\.\d+)?)\s*h(?:ours?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?)?)?)?\s*\**\s*$/i.exec(
      charge,
    );
  if (time && (time[1] || time[2]))
    set(
      'rechargeHours',
      Number(time[1] ?? 0) + Number(time[2] ?? 0) / 60,
      'performance.chargingLevelTwo',
      charge,
      'Manufacturer Level 2 (240 V) time. Confirm the charging window, equipment, test conditions and home power supply.',
    );
  return facts;
}
export function kiaReviewGaps(snapshot: KiaSnapshot) {
  return snapshot.records.flatMap((record) => {
    const gaps: { configuration: string; field: string; reason: string }[] = [];
    if (kiaDrive(record) === 'Not verified')
      gaps.push({
        configuration: kiaKey(record),
        field: 'drivetrain',
        reason:
          'No unambiguous drive label is published for this exact factory record. A prior model year or sibling trim is not substituted.',
      });
    if (record.sourceTrimName !== record.trimName)
      gaps.push({
        configuration: kiaKey(record),
        field: 'trimName',
        reason: `Source sibling-package label ${record.sourceTrimName} differs from its explicitly referenced parent ${record.parentTrimName}. The parent factory identity is used for display; the original alias is retained for manufacturer reconciliation.`,
      });
    if (record.fscCodes.length > 1)
      gaps.push({
        configuration: kiaKey(record),
        field: 'fscCodes',
        reason:
          'Multiple manufacturer FSC aliases share one published trim/specification record. Reconcile whether they encode colour, production revisions or additional equipment variants before asserting exhaustive option coverage.',
      });
    const facts = kiaFacts(record);
    for (const [metric, field] of [
      ['cargoSeatsUpL', 'cargo'],
      ['cargoSeatsDownL', 'cargo'],
      ['frontHeadroomMm', 'roof'],
    ] as const)
      if (facts[metric].value === null && facts[metric].source)
        gaps.push({ configuration: kiaKey(record), field, reason: facts[metric].note! });
    return gaps;
  });
}
export function addKiaRetail(base: Catalog, snapshot: KiaSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const sources: Source[] = snapshot.models.map((model) => ({
    id: sourceId({ year: model.year, modelName: model.name }),
    title: `${model.year} ${model.name} Canadian factory trims/packages, MSRP and specifications`,
    publisher: 'Kia Canada',
    url: kiaBuildPage,
    reviewedAt,
    publishedAt: null,
    locator: `Build tool vehicle-list JSON: ${model.path}. Every parent and package has its own trimCode, priceDetails.AB.msrp and specification fields. All flat/grouped references reconcile; flat-only models require matching official model-page evidence. The i18n dictionary establishes units; raw responses are checksummed.`,
  }));
  const cars: Car[] = snapshot.records.map((record) => {
    const model = snapshot.models.find((model) => model.path === record.modelPath)!;
    const transmission = record.transmission.transmission?.trim() || 'Not verified';
    return {
      id: `kia-ca-${record.year}-${slug(record.trimCode)}`,
      make: 'Kia',
      model: record.modelName,
      year: record.year,
      trim: record.trimName,
      variant:
        [
          record.packageName &&
          record.packageName.toUpperCase() !== kiaDrive(record) &&
          !record.trimName.toLowerCase().includes(record.packageName.toLowerCase())
            ? record.packageName
            : '',
          transmission === 'Not verified' ? '' : transmission,
        ]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 200) || undefined,
      market: 'CA',
      bodyStyle: record.bodyType,
      fuel: kiaFuel(record),
      drivetrain: kiaDrive(record),
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: kiaKey(record),
        code: record.trimCode,
        transmission: transmission.slice(0, 100),
        specificationsUrl: `${model.specsUrl}?trimCode=${encodeURIComponent(record.trimCode)}`,
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: sourceId(record),
        note: 'Listed in the current Canadian lineup/configurator with an exact trim/package code. Non-default and older listed model years remain included. Dealer stock, delivery dates and additional older new inventory require confirmation.',
      },
      sourceIds: [sourceId(record)],
      facts: kiaFacts(record),
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
