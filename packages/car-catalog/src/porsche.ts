import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import type {
  PorscheSnapshot,
  PorscheFactory,
  PorscheModel,
  PorscheDetail,
} from './porsche-import';
import { porscheProfileKey } from './porsche-import';

const token = (s: string) => s.toLowerCase().replaceAll('/', '-');
export const porscheRecordId = (p: PorscheFactory) => `porsche-ca-${token(porscheProfileKey(p))}`;
const menuId = 'porsche-ca-current-menu',
  detailId = (m: PorscheModel) => `porsche-ca-${token(m.id)}-specs`,
  initialId = (m: PorscheModel) => `porsche-ca-${token(m.id)}-initial`;
function body(m: PorscheModel): Car['bodyStyle'] {
  if (['macan', 'cayenne'].includes(m.familyId)) return 'SUV';
  if (/Cabriolet|Roadster|Targa/.test(m.body)) return 'Convertible';
  if (m.body === 'Sports Sedan') return 'Sedan';
  if (m.body === 'Cross Turismo') return 'Wagon';
  if (['Coupé', 'GT', 'Turbo Coupé'].includes(m.body)) return 'Coupe';
  return 'Not verified';
}
function seats(m: PorscheModel, p: PorscheFactory | null) {
  if (p?.rearSeatOption) return p.rearSeatOption.selected ? 4 : 2;
  if (p?.disclaimer && /deletion of Rear Seats is standard/.test(p.disclaimer)) return 2;
  return ({ '2': 2, '2+2': 4, '4+1': 5, '5': 5 } as Record<string, number>)[m.seatingLabel] ?? null;
}
function facts(
  m: PorscheModel,
  p: PorscheFactory | null,
  d: PorscheDetail,
  factorySource: string | null,
): Car['facts'] {
  const out = Object.fromEntries(
    Object.keys(metricDefinitions).map((k) => [
      k,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year, transmission and equipment. A different year, optional roof/suspension, temporary overboost or unqualified measurement is not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  const set = (key: Metric, value: number | null, source: string, note: string) => {
    if (value !== null) out[key] = { value, source, note };
  };
  if (p && factorySource)
    set(
      'msrpCad',
      p.prices.base.raw + p.prices.options.raw,
      factorySource,
      `Explicit Canadian factory base ${p.prices.base.raw} CAD plus selected transmission/rear-seat options ${p.prices.options.raw} CAD. Destination, dealer fees, levies, taxes, incentives and unselected options are separate. The native option total reconciles to the selected priced components once.`,
    );
  set(
    'seats',
    seats(m, p),
    p?.rearSeatOption && factorySource ? factorySource : menuId,
    p?.rearSeatOption
      ? `${p.rearSeatOption.selected ? 'Selected 3UG adds the explicitly described two rear seats to the two front seats.' : 'Rear seats are deleted in this exact default selection; the unselected no-cost 3UG option does not establish four seats.'}`
      : `Canadian menu seating arrangement ${m.seatingLabel}. Standard factory equipment applies; unexpanded seating changes require review.`,
  );
  if (!p?.transmission) {
    if (m.fuel === 'FUEL' && m.power.label === 'Power (hp)')
      set(
        'horsepower',
        m.power.value,
        menuId,
        `Exact ${m.year}/${m.code} Canadian menu card: ${m.power.label}: ${m.power.value} hp. This year-qualified menu value does not establish factory allocation, equipment or the unqualified detail table's year.`,
      );
    return out;
  }
  const trans = p.transmission.id;
  const row = (key: string) => {
    const rows = d.rows.filter((r) => r.id === `${key}-${trans}`);
    return rows.length === 1 ? rows[0]! : null;
  };
  const number = (key: string, unit: string) => {
    const r = row(key);
    if (!r) return null;
    const match = new RegExp(`^([\\d,]+(?:\\.\\d+)?) ${unit}$`).exec(r.value);
    return match ? { row: r, value: Number(match[1]!.replaceAll(',', '')) } : null;
  };
  for (const [metric, key] of [
    ['lengthMm', 'length'],
    ['widthMm', 'width'],
  ] as const) {
    const n = number(key, 'mm');
    if (n && (metric !== 'widthMm' || n.row.label === 'Width (not incl. mirrors)'))
      set(
        metric,
        n.value,
        detailId(m),
        `Exact ${m.year}/${m.code}/${trans}: ${n.row.label}: ${n.row.value}. Standard equipment; body width excludes mirrors. Unexpanded wheels/roofs/equipment do not inherit this fact.`,
      );
  }
  const hybrid = ['hybrid', 'mild-hybrid'].includes(p.engineType),
    powerKey = hybrid
      ? 'powerCombinedNARHp'
      : p.engineType === 'electric'
        ? 'powerNARUpToHp'
        : 'powerNARHp',
    hp = number(powerKey, 'hp');
  if (hp && !/overboost|launch control/i.test(hp.row.label))
    set(
      'horsepower',
      hp.value,
      detailId(m),
      `Exact transmission ${trans}: ${hp.row.label}: ${hp.row.value}. ${hybrid ? 'Combined system output; engine-only and motor-only figures are not substituted.' : p.engineType === 'electric' ? 'Published non-overboost power, qualified by the manufacturer as up to this value. Launch Control overboost is separate.' : 'Manufacturer published engine output.'}`,
    );
  const air = d.equipment.some((e) => /Air Suspension/i.test(e.name)),
    pasm = d.equipment.some((e) => /PASM|Porsche Active Suspension Management/.test(e.name)),
    rails = d.equipment.some((e) => /Roof Rails/i.test(e.name));
  const heightKeys = air
    ? [rails ? 'heightWithRailingAirSuspension' : 'heightAirSuspension']
    : ['heightDIN', ...(pasm ? ['heightSteelSuspensionPASMDIN'] : []), 'heightSteelSuspensionDIN'];
  for (const key of heightKeys) {
    const h = number(key, 'mm');
    if (h && (!/PASM/.test(h.row.label) || pasm)) {
      set(
        'heightMm',
        h.value,
        detailId(m),
        `Exact-year standard-equipment table and suspension join: ${h.row.label}: ${h.row.value}. Optional suspension levels and roof rails are not substituted.`,
      );
      break;
    }
  }
  out.rechargeHours.note =
    'AC charger power, full-charge intervals and selected standard equipment still require a separate compatible join. Partial DC-charge intervals are not a full recharge time.';
  out.cargoSeatsUpL.note =
    'Front luggage, rear luggage and open storage behind front seats use different scopes. A value without an explicit matching seat position is not labeled seats-up cargo.';
  out.cargoSeatsDownL.note =
    'A matching folded-seat measurement for this exact seating arrangement has not been verified; front/rear compartments and unqualified maxima are not combined.';
  return out;
}
export function addPorscheRetail(base: Catalog, snapshot: PorscheSnapshot): Catalog {
  const source = (
    id: string,
    title: string,
    r: { url: string; capturedAt: string },
    locator: string,
  ): Source => ({
    id,
    title,
    publisher: 'Porsche Canada',
    url: r.url,
    reviewedAt: r.capturedAt.slice(0, 10),
    publishedAt: null,
    locator,
  });
  const sources: Source[] = [
      source(
        menuId,
        'Porsche Canadian model-year menu',
        snapshot.overviewSource,
        'Canadian modelCards: exact model code/year, body family, drive, seating label and linked build/detail URLs. A menu entry does not establish current new inventory or delivery.',
      ),
    ],
    cars: Car[] = [];
  for (const row of snapshot.models) {
    const m = row.reference,
      detail = row.detail.data;
    sources.push(
      source(
        detailId(m),
        `${m.year} Porsche ${m.name} technical data`,
        row.detail.source,
        'Exact modelVariantCode, Canadian year/code metadata, transmission-suffixed technical attributes and standard equipment. Mirror position, suspension, charging scope, combined output and overboost remain distinct.',
      ),
    );
    if (row.initial)
      sources.push(
        source(
          initialId(m),
          `${m.year} Porsche ${m.name} factory initializer`,
          row.initial.source,
          'Anonymous Canadian CAD factory selection and explicit base/options/fees. Some initializers have no selected transmission; completed selections are separate sources.',
        ),
      );
    const profiles = row.profiles.length ? row.profiles : [null];
    for (const profile of profiles) {
      const p = profile?.data ?? null,
        id = p ? porscheRecordId(p) : `porsche-ca-${token(m.id)}-menu`,
        factory = profile?.selection ? `${id}-factory` : p ? initialId(m) : null;
      if (profile?.selection && factory)
        sources.push(
          source(
            factory,
            `${m.year} Porsche ${m.name}: ${p!.transmission!.title}${p!.rearSeatOption?.selected ? ' / rear seats' : ''}`,
            profile.source,
            'Exact public options/optionAdded/optionRemoved query. Returned selected codes, transmission, rear seats and explicit base/options price reconcile. Fees, tax and quoted totals are separate.',
          ),
        );
      const fuel: Car['fuel'] =
        p?.engineType === 'mild-hybrid'
          ? 'Hybrid'
          : m.fuel === 'ELECTRIC'
            ? 'Electric'
            : m.fuel === 'HYBRID'
              ? 'Plug-in hybrid'
              : 'Gasoline';
      const trim = m.name.startsWith(m.family)
        ? m.name.slice(m.family.length).trim() || 'Base'
        : m.name;
      cars.push({
        id,
        make: 'Porsche',
        model: m.family,
        trim,
        year: m.year,
        market: 'CA',
        bodyStyle: body(m),
        fuel,
        drivetrain: m.drive,
        recordKind: 'retail-trim',
        variant: p
          ? `${p.transmission!.title} · ${seats(m, p)} seats`
          : 'Menu listing · factory allocation unverified',
        manufacturerConfiguration: {
          id: p ? porscheProfileKey(p) : m.id,
          code: m.code,
          transmission: p?.transmission?.title ?? m.transmissionChoice,
          specificationsUrl: m.detailUrl,
        },
        availability: {
          status: 'manufacturer-listed',
          checkedAt: (profile?.source ?? snapshot.overviewSource).capturedAt.slice(0, 10),
          source: factory ?? menuId,
          note: p
            ? 'Current Canadian menu and completed anonymous factory selection. Transmission and rear-seat choices are verified; additional packages, national/older new stock, order acceptance and delivery remain unverified.'
            : 'Current Canadian model menu only. This limited 90-unit model has no published configurator link or verifiable exact-year technical join; price, current allocation, new stock and order acceptance remain unverified.',
        },
        sourceIds: [
          ...new Set([
            menuId,
            detailId(m),
            ...(row.initial ? [initialId(m)] : []),
            ...(factory ? [factory] : []),
          ]),
        ],
        facts: facts(m, p, detail, factory),
      });
    }
  }
  return validateCatalog({
    ...base,
    reviewedAt:
      snapshot.retrievedAt.slice(0, 10) > base.reviewedAt
        ? snapshot.retrievedAt.slice(0, 10)
        : base.reviewedAt,
    cars: [...base.cars, ...cars],
    sources: [...base.sources, ...sources],
  });
}
export function porscheReviewGaps(snapshot: PorscheSnapshot) {
  return [
    {
      brand: 'Porsche',
      field: 'scope',
      reason:
        'Current Canadian menu, transmissions and explicit rear-seat selections are represented. Additional equipment/packages, cosmetic compatibility, independent national offerings and all remaining older new stock are incomplete.',
    },
    ...snapshot.models
      .filter((m) => m.detail.data.identityKind === 'menu-only')
      .map((m) => ({
        brand: 'Porsche',
        configuration: m.reference.id,
        field: 'menu-only-model',
        reason:
          'No native configurator link or verifiable exact-year detail identity. Limited production does not establish remaining Canadian allocation, price, equipment or new stock.',
      })),
    {
      brand: 'Porsche',
      field: 'technical-qualifications',
      reason:
        'Power and metric dimensions join exact model year, transmission and standard equipment. Cargo scopes, cabin measurements, charging configurations and Canadian energy/range cycles still require review; other versions, temporary boost and front/rear storage are not substituted.',
    },
    {
      brand: 'Porsche',
      field: 'new-inventory-access',
      reason:
        'An ordinary public Canadian finder GET returned HTTP 429 on October 26, 2026 at 01:32:11.623Z. No access boundary was bypassed. This is not evidence of absent stock; current/older new inventory and independent national reconciliation remain open.',
    },
  ];
}
