import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import {
  rivianFactoryProfiles,
  rivianFactoryPrice,
  rivianOptionPrice,
  rivianSelectionKey,
  rivianRulesKey,
  rivianProfileKey,
} from './rivian-import';
import type { RivianRules, RivianSnapshot } from './rivian-import';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export function rivianRecordId(identity: string) {
  let hash = 14695981039346656037n;
  for (const char of identity)
    hash = BigInt.asUintN(64, (hash ^ BigInt(char.charCodeAt(0))) * 1099511628211n);
  return `rivian-ca-${hash.toString(16).padStart(16, '0')}`;
}
const currentSource = (model: string) => `rivian-ca-factory-${model.toLowerCase()}`;
const rulesSource = (key: string) => `rivian-ca-rules-${slug(key)}`;
const stockSource = (key: string) => `rivian-ca-stock-${slug(key)}`;
type Profile = {
  id: string;
  model: 'R1S' | 'R1T';
  year: number;
  rules: RivianRules;
  selection: string[];
  price: number;
  stockOnly: boolean;
  priceSource: string;
  availabilitySources: string[];
};
const nonPaintVehicle = (r: RivianRules, selected: string[]) =>
  selected.filter(
    (c) => !r.groups.EXP?.options.includes(c) && !r.groups.ACCESSORIES?.options.includes(c),
  );
export function rivianStockMsrp(r: RivianRules, selected: string[]) {
  return (
    rivianFactoryPrice(r, selected) -
    selected
      .filter((c) => r.groups.EXP?.options.includes(c) || r.groups.ACCESSORIES?.options.includes(c))
      .reduce((n, c) => n + rivianOptionPrice(r, selected, c), 0)
  );
}
export function rivianProfiles(snapshot: RivianSnapshot): Profile[] {
  const profiles: Profile[] = [],
    exact = new Map<string, Profile>();
  for (const current of snapshot.current) {
    const b = current.builder,
      r = b.ruleset;
    for (const p of rivianFactoryProfiles(r, b.selection).profiles) {
      const year = Number(p.selection.find((c) => r.groups.MODEL_YEAR!.options.includes(c))!);
      const id = rivianRecordId(`factory/${b.sku}/${year}/${p.key}`);
      const profile: Profile = {
        id,
        model: b.sku,
        year,
        rules: r,
        selection: p.selection,
        price: p.msrpCad,
        stockOnly: false,
        priceSource: currentSource(b.sku),
        availabilitySources: [currentSource(b.sku)],
      };
      profiles.push(profile);
      exact.set(
        `${b.sku}/${year}/${rivianSelectionKey(nonPaintVehicle(r, p.selection))}/${p.msrpCad}`,
        profile,
      );
    }
  }
  const rules = new Map(snapshot.stockRules.map((r) => [r.key, r.rules]));
  for (const row of snapshot.stock) {
    const r = rules.get(rivianRulesKey(row.model, row.ruleset))!,
      selected = row.marketingOptions.map((o) => o.optionId);
    const price = rivianStockMsrp(r, selected);
    const key = `${row.model}/${row.modelYear}/${rivianSelectionKey(nonPaintVehicle(r, selected))}/${price}`;
    let profile = exact.get(key);
    if (!profile) {
      profile = {
        id: rivianRecordId(
          `stock/${row.model}/${row.modelYear}/${rivianSelectionKey(nonPaintVehicle(r, selected))}`,
        ),
        model: row.model,
        year: row.modelYear,
        rules: r,
        selection: selected,
        price,
        stockOnly: true,
        priceSource: rulesSource(rivianRulesKey(row.model, row.ruleset)),
        availabilitySources: [],
      };
      exact.set(key, profile);
      profiles.push(profile);
    }
    for (const search of row.searchKeys) {
      const source = stockSource(search);
      if (!profile.availabilitySources.includes(source)) profile.availabilitySources.push(source);
    }
  }
  return profiles;
}
export function rivianFacts(p: Profile, snapshot: RivianSnapshot): Car['facts'] {
  const equipmentName = (group: string) => {
    const code = p.selection.find((c) => p.rules.groups[group]?.options.includes(c));
    return code ? p.rules.options[code]!.fullName['en-CA'] : 'Not independently specified';
  };
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year and equipment selection. Current marketing cards, EPA ranges, fuel-equivalent figures and a different model year are not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  facts.msrpCad = {
    value: p.price,
    source: p.priceSource,
    note: `${p.stockOnly ? 'Observed stock’s exact model-year factory rules' : 'Minimum compatible factory wheel/interior selection for this equipment profile'}: base vehicle plus selected factory equipment, before paint, accessories, destination, taxes, fees and incentives. Confirm the current stock selling price with the retailer. Wheels: ${equipmentName('WHL')}. Interior: ${equipmentName('INT')}.`,
  };
  const isCurrentYear = snapshot.current.some(
    (c) =>
      c.builder.sku === p.model &&
      c.builder.ruleset.groups.MODEL_YEAR!.options.includes(String(p.year)),
  );
  if (isCurrentYear) {
    const captains = p.selection.some((c) => c === 'SEAT-CAPT' || c === 'BUND-AR02');
    facts.seats = {
      value: captains ? snapshot.seating.captains : snapshot.seating.standard[p.model],
      source: captains ? 'rivian-ca-captains-seating' : 'rivian-ca-standard-seating',
      note: captains
        ? 'The exact selected Captain’s Chairs code is explicitly a six-passenger configuration in the Canadian builder descriptions.'
        : 'Published Canadian model FAQ default seating, reconciled to the current factory model year and a selection without Captain’s Chairs. Older model-year layouts remain unverified.',
    };
  }
  return facts;
}
export function addRivianRetail(base: Catalog, snapshot: RivianSnapshot): Catalog {
  const date = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [];
  for (const c of snapshot.current)
    sources.push({
      id: currentSource(c.builder.sku),
      publisher: 'Rivian Canada',
      title: `${c.builder.ruleset.groups.MODEL_YEAR!.options.join('/')} ${c.builder.sku} Canadian factory configuration and MSRP`,
      url: c.source.url,
      reviewedAt: date,
      publishedAt: null,
      locator: `Anonymous Canadian builder loader, country CA, CAD, ${c.builder.ruleset.meta.version}. Exact basePrice, compatible selected option increments and active price overrides. Build-pricing MSRP independently reconciles before the separate $${c.builder.totalCanadaFees} fee total. Marketing-card prices are not substituted.`,
    });
  for (const entry of snapshot.stockRules)
    sources.push({
      id: rulesSource(entry.key),
      publisher: 'Rivian Canada',
      title: `${entry.rules.meta.vehicle} ${entry.rules.groups.MODEL_YEAR!.options.join('/')} exact Canadian new-stock factory rules`,
      url: entry.source.url,
      reviewedAt: date,
      publishedAt: null,
      locator: `Public read request country=CA, sku=${entry.rules.meta.vehicle}, version=${entry.rules.meta.version}. Stock rows retain their exact model-year rules; full selected codes and their active prices establish factory MSRP. Discounts, paint, accessory products and fees are separate.`,
    });
  for (const q of snapshot.searches.filter((q) => !q.error))
    sources.push({
      id: stockSource(q.key),
      publisher: 'Rivian Canada',
      title: `${q.model} Canadian new-stock configurations visible at ${q.postalCode}`,
      url: q.source.url,
      reviewedAt: date,
      publishedAt: null,
      locator: `Read-only search at public sample delivery point ${q.postalCode}, model ${q.model}, NEW_VEHICLE_CONFIG, no equipment/price/year filters, ALL_MATCHES transfers, discounts unrestricted. ${q.reportedRows} distinct configuration references. These references identify configurations; physical vehicle counts and nationwide stock completeness require separate review.`,
    });
  sources.push(
    {
      id: 'rivian-ca-standard-seating',
      publisher: 'Rivian Canada',
      title: 'Current Canadian Rivian model seating',
      url: snapshot.seating.standardSource.url,
      reviewedAt: date,
      publishedAt: null,
      locator:
        'Canadian model FAQ gives R1S default seven-passenger and R1T five-passenger seating. Joined only to the current factory model year with no Captain’s Chairs selection; not copied into older stock years.',
    },
    {
      id: 'rivian-ca-captains-seating',
      publisher: 'Rivian Canada',
      title: 'Canadian Captain’s Chairs seating configuration',
      url: snapshot.seating.captainsSource.url,
      reviewedAt: date,
      publishedAt: null,
      locator:
        'builderOptions bund-ar02 and seat-capt descriptions explicitly establish six passengers. Selected factory codes must match; a generic seven-seat model headline does not replace this arrangement.',
    },
  );
  const cars: Car[] = rivianProfiles(snapshot).map((p) => {
    const r = p.rules,
      option = (group: string) => p.selection.find((c) => r.groups[group]?.options.includes(c));
    const name = (code: string | undefined) => (code ? r.options[code]!.fullName['en-CA'] : '');
    const trim = name(option('BLD')).replace(new RegExp(`^${p.model}\\s+`), '');
    const powertrain =
      name(option('DTN')) || [name(option('MOT')), name(option('BAT'))].filter(Boolean).join(' · ');
    const parts = [p.stockOnly ? 'Observed new stock' : '', powertrain];
    if (p.selection.includes('SWUP-PERF01')) parts.push(name('SWUP-PERF01'));
    if (p.selection.includes('SEAT-CAPT') || p.selection.includes('BUND-AR02'))
      parts.push('6-seat Captain’s Chairs');
    if (p.selection.includes('BUND-AR01') || p.selection.includes('BUND-AR02'))
      parts.push('Sound + Vision');
    if (p.selection.includes('ATP-001')) parts.push('All-Terrain');
    if (option('WHLPKG')) parts.push(name(option('WHLPKG')));
    if (p.selection.includes('UND-SH01') && !p.selection.includes('ATP-001'))
      parts.push('Underbody shield');
    if (p.stockOnly) parts.push(name(option('WHL')), name(option('INT')));
    const facts = rivianFacts(p, snapshot),
      sourceIds = [
        ...new Set([
          p.priceSource,
          ...p.availabilitySources,
          ...(facts.seats.source ? [facts.seats.source] : []),
        ]),
      ];
    return {
      id: p.id,
      make: 'Rivian',
      model: p.model,
      year: p.year,
      trim,
      market: 'CA',
      bodyStyle: p.model === 'R1S' ? 'SUV' : 'Pickup',
      fuel: 'Electric',
      drivetrain: /\bAWD\b/.test(powertrain) ? 'AWD' : 'Not verified',
      recordKind: 'retail-trim',
      variant: parts.filter(Boolean).join(' · ').slice(0, 200),
      manufacturerConfiguration: {
        id: p.id,
        code: slug(rivianProfileKey(r, p.selection)).slice(0, 100),
        transmission: 'Electric drive; gear count not independently verified',
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: date,
        source: p.availabilitySources[0]!,
        note: p.stockOnly
          ? 'This exact model-year equipment profile appears in sampled Canadian new-stock results. Postal-code delivery areas and physical inventory counts are not exhaustive; current factory ordering is not asserted. Optional adapters omitted by stock serialization are not claimed as included.'
          : 'This exact factory trim/drivetrain/package profile is valid in the current Canadian builder. Compatible cosmetic alternatives and individual accessories are not separate retail trims here; dealer stock and delivery still need review.',
      },
      sourceIds,
      facts,
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: date > base.reviewedAt ? date : base.reviewedAt,
    cars: [...base.cars, ...cars],
    sources: [...base.sources, ...sources],
  });
}
export function rivianReviewGaps(snapshot: RivianSnapshot) {
  return [
    ...snapshot.deferredModels.map((d) => ({
      brand: 'Rivian',
      configuration: d.model,
      field: 'ordering-identity',
      reason: d.reason,
    })),
    ...snapshot.searches
      .filter((q) => q.error)
      .map((q) => ({
        brand: 'Rivian',
        configuration: q.key,
        field: 'delivery-area',
        reason: `The source returns NO_DC at sample postal code ${q.postalCode}. That is a delivery-area result, not proof that no new vehicles are offered in the province or territory.`,
      })),
    ...rivianProfiles(snapshot).flatMap((p) =>
      Object.entries(rivianFacts(p, snapshot))
        .filter(([, f]) => f.value === null)
        .map(([field, f]) => ({ brand: 'Rivian', configuration: p.id, field, reason: f.note! })),
    ),
    {
      brand: 'Rivian',
      configuration: 'Canadian factory and stock',
      field: 'scope',
      reason:
        'All reviewed trim/drivetrain/Power Upgrade/Sound + Vision/Captain’s Chairs/All-Terrain/wheel-package/underbody profiles are expanded. Independent national inventory reconciliation, older unobserved years, additional cosmetic configurations, autonomy products, spare tires, accessory quantities and technical evidence remain open. Stock serialization omits two required charging-adapter codes when the exact rules price them at zero; their inclusion with a particular vehicle is not asserted.',
    },
  ];
}
