import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import { lucidAmount, lucidSelectionKey, lucidStockMsrp, lucidYearKey } from './lucid-import';
import type { LucidModel, LucidOptions, LucidSnapshot } from './lucid-import';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const factorySource = (model: string) => `lucid-ca-factory-${model}`;
const priceSource = (model: string, year: number) => `lucid-ca-prices-${model}-${year}`;
const specsSource = (model: string, year: number) => `lucid-ca-power-${model}-${year}`;
const stockSource = (key: string) => `lucid-ca-stock-${slug(key)}`;
export function lucidRecordId(identity: string) {
  let hash = 14695981039346656037n;
  for (const char of identity)
    hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 1099511628211n);
  return `lucid-ca-${hash.toString(16).padStart(16, '0')}`;
}
type Profile = {
  id: string;
  model: LucidModel;
  year: number;
  trim: string;
  variant: string;
  selection: string[];
  options: LucidOptions;
  price: number;
  stockOnly: boolean;
  priceSource: string;
  availabilitySources: string[];
};
function canonical(
  p: Omit<Profile, 'id' | 'stockOnly' | 'priceSource' | 'availabilitySources'>,
  on: string,
) {
  const ignored = [
    'LUCID_EXT_COLOR',
    'LUCID_SECONDARY_EXT_COLOR',
    'LUCID_BUNDLE',
    'LUCID_MODEL',
    'LUCID_TRIM',
    'LUCID_UX',
    'LUCID_CHARGING',
  ];
  for (const c of p.selection) {
    if (
      ['LUCID_TRIM', 'LUCID_UX', 'LUCID_CHARGING'].includes(p.options[c]!.typeId) &&
      lucidAmount(p.options, p.trim, p.variant, c, on).basePrice !== 0
    )
      throw new Error(
        'Lucid non-profile standard equipment acquired a price; review before projecting it.',
      );
  }
  return `${lucidYearKey(p.model, p.year)}/${p.trim}/${lucidSelectionKey(p.selection.filter((c) => !ignored.includes(p.options[c]!.typeId)))}`;
}
export function lucidProfiles(snapshot: LucidSnapshot): Profile[] {
  const profiles: Profile[] = [],
    exact = new Map<string, Profile>(),
    on = snapshot.retrievedAt.slice(0, 10);
  for (const c of snapshot.current)
    for (const row of c.profiles) {
      const b = c.builder,
        t = b.data.trimData.find((t) => row.selection.includes(t.name))!;
      const p = {
        model: b.model,
        year: b.modelYear,
        trim: t.name,
        variant: t.variant[0]!,
        selection: row.selection,
        options: b.data.optionData,
        price: row.msrpCad,
      };
      const profile: Profile = {
        ...p,
        id: lucidRecordId(`factory/${b.model}/${b.modelYear}/${row.key}`),
        stockOnly: false,
        priceSource: factorySource(b.model),
        availabilitySources: [factorySource(b.model)],
      };
      const key = canonical(p, on);
      if (exact.has(key)) throw new Error('Duplicate Lucid factory equipment identity.');
      exact.set(key, profile);
      profiles.push(profile);
    }
  for (const row of snapshot.stock) {
    const y = snapshot.years.find((y) => y.model === row.model && y.year === row.year)!;
    const p = {
        model: row.model,
        year: row.year,
        trim: row.trim,
        variant: row.variant,
        selection: row.selected,
        options: y.options,
        price: lucidStockMsrp(y, row, on),
      },
      key = canonical(p, on);
    let profile = exact.get(key);
    if (!profile) {
      profile = {
        ...p,
        id: lucidRecordId(`stock/${key}`),
        stockOnly: true,
        priceSource: priceSource(p.model, p.year),
        availabilitySources: [],
      };
      profiles.push(profile);
      exact.set(key, profile);
    } else if (profile.price !== p.price)
      throw new Error('Lucid equivalent non-paint equipment MSRP conflict.');
    for (const q of row.searchKeys)
      if (!profile.availabilitySources.includes(stockSource(q)))
        profile.availabilitySources.push(stockSource(q));
  }
  return profiles;
}
const codeFor = (p: Profile, type: string) =>
  p.selection.find((c) => p.options[c]!.typeId === type);
const nameFor = (p: Profile, type: string) => {
  const code = codeFor(p, type);
  return code ? p.options[code]!.technicalName : 'Not independently specified';
};
export function lucidFacts(p: Profile, snapshot: LucidSnapshot): Car['facts'] {
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year and equipment selection. A marketing maximum or sibling configuration is not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  facts.msrpCad = {
    value: p.price,
    source: p.priceSource,
    note: `${p.stockOnly ? 'Observed new-stock exact model-year configuration' : 'Minimum compatible wheel/interior choice for this factory equipment profile'}: factory MSRP before paint, destination, documentation, air-conditioning tax, other fees, sales taxes and incentives. This is not the discounted stock selling price. Wheels: ${nameFor(p, 'LUCID_WHEELS')}. Interior: ${nameFor(p, 'LUCID_INT_THEME')}. Appearance: ${nameFor(p, 'LUCID_APPEARANCE')}.`,
  };
  const y = snapshot.years.find((y) => y.model === p.model && y.year === p.year)!;
  const power = y.power.find(
    (s) =>
      s.variant === p.variant && p.selection.includes(s.edition) && p.selection.includes(s.drive),
  );
  if (power)
    facts.horsepower = {
      value: power.hp,
      source: specsSource(p.model, p.year),
      note: 'Manufacturer-published electric power in hp, joined to the exact Canadian model-year, variant, edition and drive codes. Actual available power varies with operating conditions.',
    };
  if (p.model === 'gravity') {
    const seating = codeFor(p, 'LUCID_SEATING_REAR'),
      name = seating ? p.options[seating]!.name : '';
    const count = /^(5|7)-Passenger Seating Configuration$/.exec(name);
    if (count)
      facts.seats = {
        value: Number(count[1]),
        source: p.stockOnly ? priceSource(p.model, p.year) : factorySource(p.model),
        note: `Exact selected ${seating} factory product explicitly specifies ${name}. Front-seat adjustment counts are not passenger counts.`,
      };
  }
  facts.electricRangeKm.note =
    'Range remains unverified for this exact year, wheel and seating arrangement. Air estimates include manufacturer projections; wheel-cover and Gravity seating qualifications require reconciliation. No EPA or headline maximum is substituted.';
  facts.cargoSeatsUpL.note = facts.cargoSeatsDownL.note =
    'Published maximum storage figures do not establish a comparable rear cargo compartment with a verified seat position. Frunk and other compartments are not added to rear cargo.';
  facts.widthMm.note =
    'Canadian marketing/comparison mirror conventions require reconciliation; a width including mirrors is not labeled body width.';
  return facts;
}
export function addLucidRetail(base: Catalog, snapshot: LucidSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [];
  for (const c of snapshot.current)
    sources.push({
      id: factorySource(c.builder.model),
      publisher: 'Lucid Canada',
      title: `${c.builder.modelYear} Lucid ${c.builder.model} Canadian factory equipment and MSRP`,
      url: c.source.url,
      reviewedAt: on,
      publishedAt: null,
      locator:
        'Anonymous en-ca builder, COCA, explicit modelYear. Reachable equipment selections follow the reviewed native client. CAD basePrice/manufacturePrice establish factory MSRP; separate value includes destination, documentation and AC charges. Paint and incentives are excluded from comparable MSRP.',
    });
  for (const y of snapshot.years) {
    sources.push({
      id: priceSource(y.model, y.year),
      publisher: 'Lucid Canada',
      title: `${y.year} Lucid ${y.model} exact Canadian factory price components`,
      url: y.priceSource.url,
      reviewedAt: on,
      publishedAt: null,
      locator:
        'Public year-scoped Canadian CPQ products; exact currency CAD, country CA, trim, bundle, manufacturing variant and active validity interval. All observed stock components reconcile the original total before discounts. Legacy aliases are recorded, not priced as missing zeroes.',
    });
    sources.push({
      id: specsSource(y.model, y.year),
      publisher: 'Lucid Canada',
      title: `${y.year} Lucid ${y.model} Canadian electric power specifications`,
      url: y.specsSource.url,
      reviewedAt: on,
      publishedAt: null,
      locator:
        'Public exact-model-year en-ca specifications. Power row in hp, joined by variant, edition and drivetrain. Unqualified ranges and maximum storage are not imported as comparable energy/cargo facts.',
    });
  }
  for (const q of snapshot.searches)
    sources.push({
      id: stockSource(q.key),
      publisher: 'Lucid Canada',
      title: `Lucid ${q.model} new-stock search at sample ${q.province} delivery point${q.variant ? `, ${q.variant}` : ''}`,
      url: q.source.url,
      reviewedAt: on,
      publishedAt: null,
      locator: `Public read-only type=new, zipCountry=CA, 5,000 km, no year/price/equipment filters${q.variant ? `; variant ${q.variant} partition` : ''}. ${q.identities.length} distinct vehicle references, below 200-row cap. New-titled display vehicles may appear; immediate delivery, unused condition, nationwide stock completeness and physical Canadian location are not asserted.`,
    });
  const cars: Car[] = lucidProfiles(snapshot).map((p) => {
    const trim = (
      {
        pure: 'Pure',
        air: 'Pure',
        touring: 'Touring',
        grand_touring: 'Grand Touring',
        sapphire: 'Sapphire',
      } as Record<string, string>
    )[p.trim];
    if (!trim) throw new Error('Lucid retail trim label needs renewed review.');
    const details = [
      p.stockOnly ? 'Observed new stock' : '',
      ...p.selection.flatMap((c) => {
        const labels: Record<string, string> = {
          '5RSC': '5 seats',
          '7RSC': '7 seats',
          PKG08: 'Stealth & Sound 19-inch',
          PKG09: 'Stealth & Sound 20-inch',
          CCP02: 'Comfort & Convenience',
          CCP03: 'Comfort & Convenience',
          CCP05: 'Comfort & Convenience',
          AD02: 'DreamDrive Pro',
          AU01: 'Surreal Sound Pro',
          DHP01: 'Dynamic Handling',
          TNP01: 'Technology package',
          TNP02: 'Power Package',
          TP01: 'Tow package',
          RF01: 'Glass canopy',
        };
        return labels[c] ? [labels[c]!] : [];
      }),
      nameFor(p, 'LUCID_SEATING'),
      ...(p.stockOnly ? [nameFor(p, 'LUCID_WHEELS'), nameFor(p, 'LUCID_INT_THEME')] : []),
    ];
    const variantParts = p.stockOnly
      ? details
          .filter((s) => p.model !== 'gravity' || s !== 'Glass canopy')
          .map((s) =>
            s
              .replace('Comfort & Convenience', 'Comfort package')
              .replace('Surreal Sound Pro', 'Sound Pro')
              .replace('Dynamic Handling', 'Dynamic')
              .replace('Technology package', 'Tech')
              .replace(/(\d+)" Front \/ (\d+)" Rear/, '$1/$2-inch'),
          )
      : details;
    if (p.stockOnly)
      variantParts.push(/Stealth/i.test(nameFor(p, 'LUCID_APPEARANCE')) ? 'Stealth' : 'Platinum');
    const variant = variantParts.filter(Boolean).join(' · ');
    if (variant.length > 200)
      throw new Error('Lucid equipment description needs a reviewed concise label.');
    const facts = lucidFacts(p, snapshot),
      drive = nameFor(p, 'LUCID_DRIVETRAIN');
    return {
      id: p.id,
      make: 'Lucid',
      model: p.model === 'air' ? 'Air' : 'Gravity',
      trim,
      year: p.year,
      market: 'CA',
      bodyStyle: p.model === 'air' ? 'Sedan' : 'SUV',
      fuel: 'Electric',
      drivetrain: /Rear.?Wheel|RWD/i.test(drive)
        ? 'RWD'
        : /All.?Wheel|AWD/i.test(drive)
          ? 'AWD'
          : 'Not verified',
      recordKind: 'retail-trim',
      variant,
      manufacturerConfiguration: {
        id: p.id,
        code: `${p.model}-${p.year}-${p.variant}-${p.id.slice(-16)}`,
        transmission: 'Electric drive; gear count not independently verified',
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: on,
        source: p.availabilitySources[0]!,
        note: p.stockOnly
          ? 'Exact model-year equipment appears in sampled Canadian type=new inventory with new title status, including some display vehicles. Delivery timing and condition require confirmation. Factory ordering for this older selection and exhaustive national stock are not asserted.'
          : 'Current Canadian factory equipment profile with a minimum compatible wheel/interior choice. Paint and other cosmetic alternatives are not separate retail trims. Stock and delivery require confirmation.',
      },
      sourceIds: [
        ...new Set([
          p.priceSource,
          ...p.availabilitySources,
          ...Object.values(facts).flatMap((f) => (f.source ? [f.source] : [])),
        ]),
      ],
      facts,
    };
  });
  if (new Set(cars.map((c) => [c.year, c.model, c.trim, c.variant].join('/'))).size !== cars.length)
    throw new Error('Lucid distinct equipment profiles need distinct visible descriptions.');
  return validateCatalog({
    ...base,
    reviewedAt: on > base.reviewedAt ? on : base.reviewedAt,
    cars: [...base.cars, ...cars],
    sources: [...base.sources, ...sources],
  });
}
export function lucidReviewGaps(snapshot: LucidSnapshot) {
  return [
    {
      brand: 'Lucid',
      field: 'scope',
      reason:
        'Factory equipment profiles use minimum compatible wheel/interior selections. Additional cosmetic configurations, independent national inventory reconciliation, unobserved older years, regional delivery/condition checks and technical specifications remain open. Empty browser inventory caused by failed requests is not absence evidence.',
    },
    ...snapshot.overview.placeholders.map((key) => ({
      brand: 'Lucid',
      configuration: key,
      field: 'ordering-identity',
      reason:
        'Menu-only zero-price placeholder has no priced current factory trim; not imported as a free vehicle or treated as definitively unavailable.',
    })),
    {
      brand: 'Lucid',
      configuration: 'Gravity',
      field: 'fee-source-conflict',
      reason:
        'Canadian marketing footnote delivery charge differs from the exact builder. MSRP uses explicit basePrice/manufacturePrice, never a guessed subtraction from a headline total. Provincial all-inclusive pricing is not asserted.',
    },
    ...lucidProfiles(snapshot).flatMap((p) =>
      Object.entries(lucidFacts(p, snapshot))
        .filter(([, f]) => f.value === null)
        .map(([field, f]) => ({ brand: 'Lucid', configuration: p.id, field, reason: f.note! })),
    ),
  ];
}
