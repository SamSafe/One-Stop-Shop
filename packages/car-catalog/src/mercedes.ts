import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import type { MercedesReference, MercedesSnapshot } from './mercedes-import';

export const mercedesRecordId = (key: string) =>
  `mercedes-ca-${key.toLowerCase().replace('/', '-')}`;
const pageId = (key: string) => `${mercedesRecordId(key)}-specs`;
const buildId = (key: string) => `${mercedesRecordId(key)}-factory`;
const overviewId = 'mercedes-ca-current-menu';
const selectorId = (kind: string) => `mercedes-ca-sprinter-${kind}`;
const label = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim();
const emptyFacts = () =>
  Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year and standard equipment. Another year, optional equipment, a headline maximum or an unqualified measurement is not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
type CarRow = MercedesSnapshot['cars'][number];
export function mercedesSpecification(row: CarRow, names: string[]) {
  const found = row.specifications.filter((s) => names.includes(label(s.name)));
  if (!found.length) return null;
  if (new Set(found.map((r) => r.value)).size !== 1) return null;
  return found[0]!.value;
}
export function mercedesCarFacts(row: CarRow, reference: MercedesReference): Car['facts'] {
  const facts = emptyFacts();
  const conflict = row.builder && row.builder.data.msrpCad !== row.vehicle.msrp;
  facts.msrpCad = {
    value: conflict ? null : row.vehicle.msrp,
    source: row.builder ? buildId(row.key) : pageId(row.key),
    note: conflict
      ? `Canadian source conflict: exact-year model-page MSRP ${row.vehicle.msrp} CAD differs from exact-year builder MSRP ${row.builder!.data.msrpCad} CAD. Comparable base MSRP is withheld pending reconciliation; no fee/currency subtraction or preferred candidate is guessed.`
      : `Explicit CAD base MSRP for ${row.vehicle.year}/${row.vehicle.model}, before paint, optional packages, freight/PDI, fees, levies, taxes and incentives. ${row.builder ? 'The exact-year Canadian model-page and builder prices agree for standard equipment.' : 'Current menu and exact-year model-page MSRP; no current factory-builder link was published. Ordering and new stock require confirmation.'}`,
  };
  function set(metric: Metric, value: number | null, note: string) {
    const bounds = metricDefinitions[metric];
    if (value === null || value < bounds.min || value > bounds.max) return;
    facts[metric] = { value, source: pageId(row.key), sourceUrl: row.source.url, note };
  }
  for (const [metric, names] of [
    ['lengthMm', ['overall length b']],
    ['heightMm', ['overall height c']],
    ['widthMm', ['overall width w/o mirrors e']],
    ['frontHeadroomMm', ['headroom front', 'headroom 1st row']],
    ['rearHeadroomMm', ['headroom rear', 'headroom 2nd row']],
    ['frontLegroomMm', ['legroom front', 'legroom 1st row']],
    ['rearLegroomMm', ['legroom rear', 'legroom 2nd row']],
  ] as const) {
    const value = mercedesSpecification(row, [...names]),
      match = value && /^([\d,]+(?:\.\d+)?)\s*mm$/.exec(value);
    set(
      metric,
      match ? Number(match[1]!.replaceAll(',', '')) : null,
      `Exact-year Canadian model-page ${names.join(' / ')}: ${value}. ${metric === 'widthMm' ? 'Body width explicitly excludes mirrors. ' : ''}Applies to the published standard-equipment profile; optional wheels, suspension, roofs and seating have not been propagated.`,
    );
  }
  const capacity = mercedesSpecification(row, ['passenger capacity']),
    seats = capacity && /^(\d+)(?:\s*\(\d+ optional\))?$/.exec(capacity);
  set(
    'seats',
    seats ? Number(seats[1]) : null,
    `Published standard passenger capacity: ${capacity}. Optional seating is not selected in this base profile.`,
  );
  const power = mercedesSpecification(row, ['power']);
  const hp =
    power &&
    /^(\d+(?:\.\d+)?)\s*hp(?:\s*@\s*[\d,.\s-]+rpm)?(?:\s*\(combined(?:, w\/boost to \d+ hp)?\))?$/.exec(
      power,
    );
  const plugin = mercedesCarFuel(reference, row) === 'Plug-in hybrid';
  set(
    'horsepower',
    hp && (!plugin || /combined/i.test(power!)) ? Number(hp[1]) : null,
    `Exact model-page power: ${power}. The leading published hp rating is retained; temporary boost is not substituted, and separately rated motors are not summed.`,
  );
  if (plugin && facts.horsepower.value === null)
    facts.horsepower.note = `Published power (${power}) does not explicitly identify combined plug-in-hybrid output. Engine-only power, temporary boost and summed motor figures are not substituted.`;
  facts.cargoSeatsUpL.note = facts.cargoSeatsDownL.note =
    'The Canadian model page does not establish comparable cargo volumes with explicitly labeled seat positions. Unlabeled ranges, frunks and maximum total storage are not assigned to seats-up/down cargo.';
  facts.electricRangeKm.note =
    'Exact wheel/equipment qualifications and Canadian test-cycle basis need reconciliation. A model-page estimate or maximum range is not substituted.';
  facts.rechargeHours.note =
    'Published charging intervals vary, including 10–100% and 25–100%. Partial-charge intervals are not labeled as a full recharge time.';
  return facts;
}
export function mercedesCarFuel(reference: MercedesReference, row: CarRow): Car['fuel'] {
  if (reference.electric || reference.fuelType === 'E') return 'Electric';
  if (['PH', 'PPH'].includes(reference.fuelType ?? '')) return 'Plug-in hybrid';
  const engine = mercedesSpecification(row, ['engine']);
  if (engine && /mild hybrid|hybrid assist/i.test(engine)) return 'Hybrid';
  if (engine && /plug.in hybrid/i.test(engine)) return 'Plug-in hybrid';
  if (reference.fuelType && !['G', 'Gasoline'].includes(reference.fuelType))
    throw new Error('Mercedes fuel code needs renewed review.');
  return engine ? 'Gasoline' : 'Gasoline / hybrid';
}
function drivetrain(row: CarRow): Car['drivetrain'] {
  const text = mercedesSpecification(row, ['drive configuration']) ?? '';
  if (/all.wheel drive/i.test(text)) return 'AWD';
  if (/rear.wheel drive/i.test(text)) return 'RWD';
  if (/front.wheel drive/i.test(text)) return 'FWD';
  if (/4.wheel drive/i.test(text)) return '4WD';
  return 'Not verified';
}
function body(reference: MercedesReference): Car['bodyStyle'] {
  const map: Record<string, Car['bodyStyle']> = {
    SUV: 'SUV',
    SDN: 'Sedan',
    CPE: 'Coupe',
    CAB: 'Convertible',
    RDS: 'Convertible',
    WGN: 'Wagon',
  };
  if (!map[reference.bodyCode])
    throw new Error(`Mercedes body code needs renewed review: ${reference.bodyCode}`);
  return map[reference.bodyCode]!;
}
export function addMercedesRetail(base: Catalog, snapshot: MercedesSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [],
    cars: Car[] = [];
  function source(id: string, title: string, url: string, locator: string) {
    sources.push({
      id,
      publisher: 'Mercedes-Benz Canada',
      title,
      url,
      reviewedAt: on,
      publishedAt: null,
      locator,
    });
  }
  source(
    overviewId,
    'Mercedes-Benz Canadian current model-year menu',
    snapshot.overviewSource.url,
    'Canadian country=ca, currency=CAD. Explicit year/model paths, active/coming-soon flags and published model/builder links. Menu prices of -1 are placeholders, not MSRP. A listing does not establish current dealer inventory or factory orderability.',
  );
  for (const reference of snapshot.menu) {
    const row = snapshot.cars.find((r) => r.key === reference.key)!,
      id = mercedesRecordId(row.key);
    source(
      pageId(row.key),
      `${row.vehicle.year} ${row.vehicle.name} Canadian base MSRP and specifications`,
      row.source.url,
      'Explicit vehicle model, year, class, body and MSRP in Canadian page metadata. Labeled metric dimensions, standard seating and hp only; temporary boost, optional seats, unqualified cargo/range and partial charging intervals are not substituted.',
    );
    if (row.builder)
      source(
        buildId(row.key),
        `${row.vehicle.year} ${row.vehicle.name} Canadian factory base equipment`,
        row.builder.source.url,
        `Exact model/year, country=ca, currency=CAD, valid=true. Legacy MSRP pricing is explicitly active even when CCS equipment defaults are selected. The legacy price tree, content and zero-surcharge base selection reconcile. ${row.builder.data.msrpCad === row.vehicle.msrp ? 'Model-page MSRP agrees.' : 'Model-page MSRP conflicts; comparable MSRP is withheld.'} Packages and all-inclusive provincial fees remain separate.`,
      );
    const transmission =
      mercedesSpecification(row, ['automatic transmission']) ?? 'Not independently verified';
    cars.push({
      id,
      make: 'Mercedes-Benz',
      model: reference.family.trim(),
      trim: reference.name,
      year: reference.year,
      market: 'CA',
      recordKind: 'retail-trim',
      bodyStyle: body(reference),
      fuel: mercedesCarFuel(reference, row),
      drivetrain: drivetrain(row),
      variant: 'Standard equipment',
      manufacturerConfiguration: {
        id,
        code: reference.model,
        transmission,
        specificationsUrl: row.source.url,
      },
      availability: {
        status: reference.inactive
          ? 'not-checked'
          : reference.comingSoon
            ? 'announced'
            : 'manufacturer-listed',
        checkedAt: on,
        source: overviewId,
        note: `${reference.inactive ? 'Menu flags this model inactive; current offering needs review.' : reference.comingSoon ? 'Menu flags this model coming soon; current sale availability is not verified.' : 'Exact Canadian model year is explicitly listed in the current manufacturer menu.'} ${row.builder ? 'Base factory builder is published.' : 'No current builder link is published for this menu entry.'} Package combinations, remaining new stock, order acceptance and delivery require confirmation.`,
      },
      sourceIds: [overviewId, pageId(row.key), ...(row.builder ? [buildId(row.key)] : [])],
      facts: mercedesCarFacts(row, reference),
    });
  }
  for (const selector of snapshot.selectors) {
    source(
      selectorId(selector.kind),
      `Canadian Sprinter ${selector.kind} model-year, powertrain and roof selections`,
      selector.source.url,
      'Current Canadian selector activeModels with explicit year, model code, default roof variant, CAD MSRP and matching powertrain/wheelbase filter labels. Passenger seating is joined by wheelbase and roof; crew seating is not inferred from mixed-year marketing copy.',
    );
    for (const reference of selector.models) {
      const row = snapshot.vans.find((r) => r.key === reference.key)!,
        id = mercedesRecordId(row.key),
        facts = emptyFacts();
      source(
        buildId(row.key),
        `${reference.year} Sprinter ${reference.model} Canadian factory base equipment`,
        row.source.url,
        'Exact published selector leaf. Canadian context, valid=true, explicit year/model/default roof, legacy price mode. Builder MSRP, active price tree and zero-surcharge base paint/upholstery selection agree with selector MSRP. Commercial-only cargo/chassis models are outside this passenger import.',
      );
      facts.msrpCad = {
        value: row.data.msrpCad,
        source: buildId(row.key),
        note: 'Exact Canadian model-year/powertrain/roof base MSRP before optional equipment, paint, freight/PDI, fees, levies, sales taxes and incentives. No provincial all-inclusive price is asserted.',
      };
      const seating =
        selector.kind === 'passenger-van' ? /^(\d+)-Passenger$/.exec(reference.seatingLabel) : null;
      if (seating)
        facts.seats = {
          value: Number(seating[1]),
          source: selectorId(selector.kind),
          note: `Exact ${reference.year}/${reference.model}, ${reference.variant}, ${reference.wheelbase}-inch wheelbase selector: ${reference.seatingLabel}. Optional seating modifications are not selected.`,
        };
      else
        facts.seats.note =
          'Exact-year crew-van passenger count is not independently established. Mixed-year marketing text and cargo-van seating are not substituted.';
      if (
        !/^4 Cylinder Diesel (Standard Output|High Output(?: AWD)?)$/.test(
          reference.powertrainLabel,
        )
      )
        throw new Error('Mercedes van powertrain label needs renewed review.');
      cars.push({
        id,
        make: 'Mercedes-Benz',
        model: 'Sprinter',
        trim: `${reference.name} · ${reference.powertrainLabel.replace('4 Cylinder Diesel ', '')}`,
        year: reference.year,
        market: 'CA',
        bodyStyle: 'Van',
        fuel: 'Diesel',
        drivetrain: / AWD$/.test(reference.powertrainLabel) ? 'AWD' : 'Not verified',
        recordKind: 'retail-trim',
        variant: 'Standard equipment',
        manufacturerConfiguration: {
          id,
          code: reference.model,
          transmission: 'Not independently verified',
        },
        availability: {
          status: 'manufacturer-listed',
          checkedAt: on,
          source: selectorId(selector.kind),
          note: 'Current Canadian passenger/crew selector and exact-year base builder are published. Named packages, independent new-stock reconciliation, order acceptance and delivery remain unverified.',
        },
        sourceIds: [selectorId(selector.kind), buildId(row.key)],
        facts,
      });
    }
  }
  return validateCatalog({
    ...base,
    reviewedAt: on > base.reviewedAt ? on : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
export function mercedesReviewGaps(snapshot: MercedesSnapshot) {
  return [
    {
      brand: 'Mercedes-Benz',
      field: 'scope',
      reason:
        'Initial import covers current explicitly identified Canadian base model-year profiles only. Named trim/package compatibility, optional seating/wheels/roofs, cosmetic choices, unobserved older new stock and independent national inventory reconciliation remain open. It does not establish complete Mercedes-Benz or Canadian market coverage.',
    },
    {
      brand: 'Mercedes-Benz',
      field: 'new-stock',
      reason:
        'A separate 2026-10-23 review of the published Canadian passenger-car inventory initdata endpoint returned HTTP 500 (upstream service failure). Normal base-profile refresh does not recheck that endpoint. An empty inventory UI is not proof of no vehicles. Passenger-car stock and independent nationwide van coverage beyond the separate captured dealer queries remain unverified.',
    },
    ...snapshot.placeholders.map((url) => ({
      brand: 'Mercedes-Benz',
      configuration: url,
      field: 'ordering-identity',
      reason:
        'Current Maybach EQS SUV family card has no explicit active model/year identity. Image filenames and placeholder prices are not model years or MSRP. Review the family builder and new stock before deciding availability.',
    })),
    ...snapshot.menu
      .filter((m) => !m.builder)
      .map((m) => ({
        brand: 'Mercedes-Benz',
        configuration: m.key,
        field: 'factory-ordering',
        reason:
          'Explicit current menu identity and exact-year model-page MSRP are retained, but no factory-builder link is published. Remaining new stock and ordering require reconciliation.',
      })),
    ...snapshot.cars.flatMap((r) =>
      Object.entries(
        mercedesCarFacts(
          r,
          snapshot.menu.find((m) => m.key === r.key)!,
        ),
      )
        .filter(([, f]) => f.value === null)
        .map(([field, f]) => ({
          brand: 'Mercedes-Benz',
          configuration: r.key,
          field,
          reason: f.note!,
        })),
    ),
    ...snapshot.vans.map((r) => ({
      brand: 'Mercedes-Benz',
      configuration: r.key,
      field: 'technical-specifications',
      reason:
        'Exact-year seating, dimensions, power, transmission and drivetrain require a verified model-code/roof/powertrain join. Passenger seat counts are imported only from the exact selector; non-AWD drive type and crew capacity are not guessed.',
    })),
  ];
}
