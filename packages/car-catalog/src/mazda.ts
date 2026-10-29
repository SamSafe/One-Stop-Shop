import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import { mazdaBuildPage, mazdaConfigurationUrl } from './mazda-import';
import type { MazdaRecord, MazdaSnapshot } from './mazda-import';

const text = (value: string) =>
  value
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const sourceId = (record: Pick<MazdaRecord, 'year' | 'carline'>) =>
  `mazda-ca-${record.year}-${slug(record.carline)}-factory-configurations`;
export function mazdaRecordId(record: MazdaRecord) {
  return record.modelCode === 'NXXL86' && record.optionCode === 'AA00'
    ? 'mazda-cx-5-2026-gx-awd'
    : `mazda-ca-${slug(record.modelCode)}-${slug(record.optionCode)}`;
}
export function mazdaNumbers(value: string, count: number): number[] | null {
  const parsed = text(value)
    .replace(/,/g, '')
    .match(/^\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)*)(?:\s*\([^)]*\))?\s*$/)?.[1]
    ?.split('/')
    .map(Number);
  return parsed?.length === count && parsed.every((value) => value > 0) ? parsed : null;
}
export function mazdaMeasurementConflicts(record: MazdaRecord) {
  const rear = record.specifications
    .filter((row) => /^cargo (?:volume|capacity).*behind rear seats.*\(L\)/i.test(text(row.title)))
    .map((row) => mazdaNumbers(row.value, 1)?.[0])
    .filter((value) => value !== undefined);
  const front = record.specifications
    .filter((row) => /^cargo (?:volume|capacity).*behind front seats.*\(L\)/i.test(text(row.title)))
    .map((row) => mazdaNumbers(row.value, 1)?.[0])
    .filter((value) => value !== undefined);
  return rear.length === 1 && front.length === 1 && front[0]! < rear[0]!
    ? [
        {
          field: 'cargo',
          reportedRearSeatsL: rear[0]!,
          reportedFrontSeatsL: front[0]!,
          reason:
            'The published rear/front cargo volumes are reversed relative to the seating arrangement. Independent source review is required; values are not automatically swapped.',
        },
      ]
    : [];
}
export function mazdaFuel(
  record: MazdaRecord,
  year: MazdaSnapshot['modelYears'][number],
): Car['fuel'] {
  const identity = `${record.carline} ${record.engine}`;
  if (/PHEV|plug.?in/i.test(identity)) return 'Plug-in hybrid';
  if (/HEV|hybrid/i.test(identity)) return 'Hybrid';
  if (year.electric) return 'Electric';
  return 'Gasoline';
}
export function mazdaDrive(record: MazdaRecord): Car['drivetrain'] {
  if (/AWD|all.wheel/i.test(record.drivetrain)) return 'AWD';
  if (/FWD|front.wheel/i.test(record.drivetrain)) return 'FWD';
  if (/RWD|rear.wheel/i.test(record.drivetrain)) return 'RWD';
  return 'Not verified';
}
export function mazdaFacts(
  record: MazdaRecord,
  year: MazdaSnapshot['modelYears'][number],
): Car['facts'] {
  const unknown = (): Fact => ({
    value: null,
    source: null,
    note: 'Not published or not yet verified for this exact Canadian model/option code. Ambiguous alternatives, placeholders and incompatible fuel modes remain unknown.',
  });
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((metric) => [metric, unknown()]),
  ) as Car['facts'];
  const specs = record.specifications.map((row) => ({
    section: text(row.section),
    title: text(row.title),
    value: text(row.value),
  }));
  const rows = (pattern: RegExp) => specs.filter((row) => pattern.test(row.title));
  function set(
    metric: Metric,
    value: number | null | undefined,
    row: (typeof specs)[number],
    extra = '',
  ) {
    const definition = metricDefinitions[metric];
    if (value !== null && value !== undefined && value >= definition.min && value <= definition.max)
      facts[metric] = {
        value,
        source: sourceId(record),
        sourceUrl: mazdaConfigurationUrl(record),
        note: `Manufacturer ${row.section}, ${row.title}: ${row.value}. ${extra}`.trim(),
      };
  }
  facts.msrpCad = {
    value: record.msrpCad,
    source: sourceId(record),
    sourceUrl: record.priceSource.url,
    note: `Published financial.msrp for factory ${record.modelCode}/${record.optionCode}, including ${record.packageName}. The published factory-package MSRP already includes the package price. Excludes freight/PDE, taxes, levies, dealer fees, colours, accessories, protection products and incentives. AB/English source request; confirm current pricing with the retailer.`,
  };
  function single(pattern: RegExp, count = 1) {
    const candidates = rows(pattern).filter((row) => mazdaNumbers(row.value, count));
    return candidates.length === 1 ? candidates[0] : undefined;
  }
  const seats = single(/^seating(?: capacity)?$/i);
  if (seats) set('seats', mazdaNumbers(seats.value, 1)?.[0], seats);
  const wheelbaseLength = single(/^wheelbase\s*\/\s*overall length.*\(mm\)/i, 2);
  if (wheelbaseLength)
    set('lengthMm', mazdaNumbers(wheelbaseLength.value, 2)?.[1], wheelbaseLength);
  else {
    const length = single(/^overall length.*\(mm\)/i);
    if (length) set('lengthMm', mazdaNumbers(length.value, 1)?.[0], length);
  }
  const height = single(/^overall height.*\(mm\)/i);
  if (height) set('heightMm', mazdaNumbers(height.value, 1)?.[0], height);
  const widths = rows(/^overall width.*\(mm\)/i);
  if (widths.length === 1) {
    const row = widths[0]!,
      pair = /^([\d,.]+)\s*\(([^)]+)\)\s*\/\s*([\d,.]+)\s*\(([^)]+)\)$/.exec(row.value);
    if (pair && /mirrors folded/i.test(pair[2]!))
      set(
        'widthMm',
        Number(pair[1]!.replace(/,/g, '')),
        row,
        'Width with mirrors folded; the full source convention is retained.',
      );
    else
      set(
        'widthMm',
        mazdaNumbers(row.value, 1)?.[0],
        row,
        'Mirror convention is as stated by the source. Unresolved alternative widths are not selected.',
      );
  }
  for (const [front, rear, pattern] of [
    ['frontHeadroomMm', 'rearHeadroomMm', /^headroom.*\(mm\)/i],
    ['frontLegroomMm', 'rearLegroomMm', /^legroom.*\(mm\)/i],
  ] as const) {
    const options = rows(pattern).flatMap((row) => {
      const values = mazdaNumbers(row.value, 2) ?? mazdaNumbers(row.value, 3);
      return values ? [{ row, values }] : [];
    });
    if (options.length === 1) {
      set(front, options[0]!.values[0], options[0]!.row);
      set(
        rear,
        options[0]!.values[1],
        options[0]!.row,
        'Rear means second row. Roof/seating qualifiers remain visible.',
      );
    }
  }
  const powers = rows(/^horsepower\b|^total.*(?:power|output|horsepower)/i).flatMap((row) => {
    const number = /^(\d+(?:\.\d+)?)(?:\s*hp)?(?:\s*@\s*[\d,]+\s*rpm)?(?:\s*\([^)]*\))?$/i.exec(
      row.value,
    )?.[1];
    return number ? [{ row, value: Number(number) }] : [];
  });
  if (powers.length === 1)
    set(
      'horsepower',
      powers[0]!.value,
      powers[0]!.row,
      'Engine versus system output and fuel-grade qualifiers are source-specific.',
    );
  const fuel = mazdaFuel(record, year);
  if (!['Electric', 'Plug-in hybrid'].includes(fuel)) {
    let fuels = specs.filter(
      (row) =>
        /fuel.*(?:economy|consumption)/i.test(row.section) &&
        /L\s*\/\s*100/i.test(row.section) &&
        mazdaNumbers(row.value, 3),
    );
    const drive = mazdaDrive(record),
      manual =
        /manual/i.test(record.transmissionShort) && !/automatic/i.test(record.transmissionShort),
      turbo = /turbo/i.test(record.engine);
    fuels = fuels.filter(
      (row) =>
        !(drive === 'AWD' && /FWD/.test(row.title)) &&
        !(drive === 'FWD' && /AWD/.test(row.title)) &&
        !(manual && /\dAT/.test(row.title)) &&
        !(!manual && /\dMT/.test(row.title)) &&
        !(turbo === false && /turbo/i.test(row.title)),
    );
    if (turbo && fuels.some((row) => /turbo/i.test(row.title)))
      fuels = fuels.filter((row) => /turbo/i.test(row.title));
    if (fuels.length === 1) {
      const row = fuels[0]!,
        values = mazdaNumbers(row.value, 3)!;
      for (const [index, metric] of [
        'fuelCityL100km',
        'fuelHighwayL100km',
        'fuelCombinedL100km',
      ].entries())
        set(
          metric as Metric,
          values[index],
          row,
          'Canadian liquid-fuel rating in L/100 km, in city/highway/combined order. Actual consumption varies.',
        );
    }
  } else
    for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
      facts[metric].note =
        fuel === 'Electric'
          ? 'Not applicable to battery-electric propulsion. Gasoline-equivalent energy is not gasoline consumed.'
          : 'An exact fuel-only versus blended/electric-mode review is required. No whole-journey cost is assumed from an ambiguous plug-in rating.';
  const thirdRows = rows(/^cargo (?:volume|capacity).*behind.*(?:3rd|third).*\(L\)/i).filter(
    (row) => mazdaNumbers(row.value, 1),
  );
  const rearCargo = single(/^cargo (?:volume|capacity).*behind rear seats.*\(L\)/i);
  const threeRow =
    (facts.seats.value !== null && facts.seats.value >= 6) ||
    specs.some((row) => /cargo (?:volume|capacity).*behind.*(?:3rd|third)/i.test(row.title));
  if (thirdRows.length === 1)
    set(
      'cargoSeatsUpL',
      mazdaNumbers(thirdRows[0]!.value, 1)?.[0],
      thirdRows[0]!,
      'All seating rows upright. Measurement standards differ between manufacturers.',
    );
  else if (!threeRow && rearCargo)
    set(
      'cargoSeatsUpL',
      mazdaNumbers(rearCargo.value, 1)?.[0],
      rearCargo,
      'Manufacturer volume behind rear seats; measurement standard is not harmonized.',
    );
  const generic = rows(/^cargo (?:volume|capacity)\s*\(L\)$/i);
  if (!threeRow && generic.length === 1) {
    const row = generic[0]!,
      pair = /^([\d,.]+)\s*\(([^)]+)\)\s*\/\s*([\d,.]+)\s*\(([^)]+)\)$/.exec(row.value);
    if (pair && /behind rear seats/i.test(pair[2]!) && /rear seats folded/i.test(pair[4]!)) {
      set(
        'cargoSeatsUpL',
        Number(pair[1]!.replace(/,/g, '')),
        row,
        'Seating positions and measurement heights are as published.',
      );
      set(
        'cargoSeatsDownL',
        Number(pair[3]!.replace(/,/g, '')),
        row,
        'Folded-seat measurement height/method differs across models.',
      );
    } else if (facts.seats.value === 2)
      set(
        'cargoSeatsUpL',
        mazdaNumbers(row.value, 1)?.[0],
        row,
        'Two-seat model; roof position and measurement method are as stated by the source.',
      );
  }
  const folded = single(
    /^cargo (?:volume|capacity).*(?:behind front seats|with rear seats folded).*\(L\)/i,
  );
  if (folded)
    set(
      'cargoSeatsDownL',
      mazdaNumbers(folded.value, 1)?.[0],
      folded,
      'Cargo behind the front row; confirm folded/removed-seat arrangement and practical fit.',
    );
  for (const conflict of mazdaMeasurementConflicts(record))
    for (const metric of ['cargoSeatsUpL', 'cargoSeatsDownL'] as const)
      facts[metric] = {
        value: null,
        source: sourceId(record),
        sourceUrl: mazdaConfigurationUrl(record),
        note: `The source lists ${conflict.reportedRearSeatsL} L behind rear seats and ${conflict.reportedFrontSeatsL} L behind front seats, which contradicts the seating arrangement. Both volumes remain unverified pending an independent source check; they are not automatically swapped.`,
      };
  return facts;
}
export function addMazdaRetail(base: Catalog, snapshot: MazdaSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10),
    previous = new Map(base.cars.map((car) => [car.id, car]));
  const sources: Source[] = snapshot.modelYears.map((year) => ({
    id: sourceId(year),
    title: `${year.year} ${text(year.name)} Canadian factory configurations and specifications`,
    publisher: 'Mazda Canada',
    url: `${mazdaBuildPage}#/${year.year}/${encodeURIComponent(year.carline)}/`,
    reviewedAt,
    publishedAt: null,
    locator:
      'Official Canadian build tool: ModelYears → Trims → EngineModels → Packages. Exact model/option financial.msrp is the full configuration price. Each specification comes from POST api/specs with cars:[model_code/option_code]; raw responses and hashes are retained. Header/row units and measurement qualifiers remain explicit.',
  }));
  const cars: Car[] = snapshot.records.map((record) => {
    const year = snapshot.modelYears.find((year) => year.id === record.modelYearId)!,
      id = mazdaRecordId(record),
      old = previous.get(id);
    const imported = mazdaFacts(record, year),
      facts = old
        ? (Object.fromEntries(
            Object.entries(imported).map(([key, fact]) => [
              key,
              fact.value === null && key !== 'msrpCad' ? old.facts[key as Metric] : fact,
            ]),
          ) as Car['facts'])
        : imported;
    const body = year.bodyDescription ?? '',
      model = text(record.modelName)
        .replace(/^MAZDA\s+/i, '')
        .replace(/^MAZDA3/, 'Mazda3');
    return {
      ...old,
      id,
      make: 'Mazda',
      model: old?.model ?? model,
      year: record.year,
      trim: text(record.trimName),
      variant: [
        record.packageName === 'Standard equipment' ? '' : text(record.packageName),
        text(record.engine),
        text(record.transmissionShort),
      ]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 200),
      market: 'CA',
      bodyStyle:
        old?.bodyStyle ??
        (/SUV|crossover/i.test(body)
          ? 'SUV'
          : /convertible/i.test(body)
            ? 'Convertible'
            : /hatchback/i.test(body)
              ? 'Hatchback'
              : /sedan/i.test(body)
                ? 'Sedan'
                : 'Not verified'),
      fuel: mazdaFuel(record, year),
      drivetrain: mazdaDrive(record),
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: `${record.modelCode}/${record.optionCode}`,
        code: `${record.modelCode}/${record.optionCode}`,
        transmission: record.transmissionShort.slice(0, 100),
        specificationsUrl: mazdaConfigurationUrl(record),
      },
      availability: {
        status: year.comingSoon ? 'announced' : 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: sourceId(record),
        note: year.comingSoon
          ? 'The current build-tool feed flags this as coming soon, despite a previous-model-year listing. Current availability requires reconciliation; a configured MSRP does not establish dealer stock.'
          : 'Listed in the current Canadian build tool with exact model/option codes. Dealer stock, older new inventory and delivery dates require confirmation.',
      },
      sourceIds: [...new Set([...(old?.sourceIds ?? []), sourceId(record)])],
      facts,
    };
  });
  const replaced = new Set(cars.map((car) => car.id));
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars.filter((car) => !replaced.has(car.id)), ...cars],
  });
}
