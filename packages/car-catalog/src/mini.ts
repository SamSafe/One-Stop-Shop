import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Metric, Source } from './schema';
import {
  miniCarouselUrl,
  miniLineUrl,
  miniModelKey,
  miniPackageSelections,
  miniRecordKey,
  miniSpecUrl,
  miniStockUrl,
  miniTechnicalGaps,
} from './mini-import';
import type { MiniModel, MiniRecord, MiniSnapshot, MiniStockReference } from './mini-import';

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const baseId = (m: MiniModel) => `mini-ca-${m.year}-${slug(m.code)}-factory`;
const specId = (m: MiniModel) => `mini-ca-${m.year}-${slug(m.code)}-specs`;
const contextId = (r: MiniRecord) => `mini-ca-${slug(miniRecordKey(r))}`;
export const miniRecordId = (r: MiniRecord, codes: string[] = []) =>
  `${contextId(r)}-${codes.length ? [...codes].sort().map(slug).join('-') : 'standard'}`;
const stockId = 'mini-ca-national-new-stock',
  carouselId = 'mini-ca-current-carousel';
export const miniProperties = (m: MiniModel) =>
  Object.fromEntries(
    m.technical.SpecData.flatMap((g) => g.properties.map((p) => [p.Name, p.Value])),
  );
export function miniMsrp(
  m: MiniModel,
  r: MiniRecord,
  packages: { code: string; price: number }[],
  stock?: MiniStockReference,
): number | null {
  if (
    !m.lines ||
    (r.stockBaseOnly && miniTechnicalGaps(m, stock).some((gap) => gap.includes('transmission')))
  )
    return null;
  if (r.stockBaseOnly) return m.lines.Price > 0 ? m.lines.Price : null;
  const line = m.lines.LineList.find((line) => line.lineid === r.lineId);
  if (
    !line ||
    packages.some(
      (p) =>
        !r.nav?.packages.some(
          (candidate) => candidate.code === p.code && candidate.price === p.price,
        ),
    )
  )
    throw new Error('Unknown MINI package price.');
  return (
    m.lines.Price + line.Price + (r.style?.Price ?? 0) + packages.reduce((n, p) => n + p.price, 0)
  );
}
export function miniFacts(
  m: MiniModel,
  r: MiniRecord,
  packages: { code: string; price: number }[],
  stock?: MiniStockReference,
): Car['facts'] {
  const facts = Object.fromEntries(
    Object.keys(metricDefinitions).map((key) => [
      key,
      {
        value: null,
        source: null,
        note: 'Not verified for this exact Canadian model year and model/line/style/package selection. Sibling years, unspecified cycles, bare unitless values and different charging modes are not substituted.',
      } satisfies Fact,
    ]),
  ) as Car['facts'];
  const price = miniMsrp(m, r, packages, stock),
    gaps = miniTechnicalGaps(m, stock);
  facts.msrpCad = {
    value: price,
    source: r.nav ? `${contextId(r)}-selection` : baseId(m),
    note:
      price === null
        ? 'No reconciled factory MSRP is available for this exact stock/ordering identity. A failed source or conflicting transmission does not justify a sibling or supplier-price fallback.'
        : r.stockBaseOnly
          ? `Published exact-CACode bare-model MSRP before fees, taxes, incentives, paint and equipment. Current ordering and stock line/style/option charges remain unverified; this is not the equipped stock selling price.`
          : `Canadian model ${m.code}: base ${m.lines!.Price} + line ${m.lines!.LineList.find((l) => l.lineid === r.lineId)!.Price} + style ${r.style?.Price ?? 0} + selected named packages ${packages.reduce((n, p) => n + p.price, 0)} CAD. Excludes freight/PDI, fees, taxes, incentives, paint and other optional products. Package selections reconcile with the public selector and its published rules.`,
  };
  if (gaps.length) {
    for (const key of Object.keys(facts) as Metric[])
      if (key !== 'msrpCad') facts[key] = { value: null, source: specId(m), note: gaps.join(' ') };
    return facts;
  }
  const props = miniProperties(m);
  const set = (metric: Metric, field: string, unit: string, extra = '') => {
    const match = new RegExp(`^([0-9,]+(?:\\.[0-9]+)?)\\s*${unit}$`).exec(
      props[field]?.trim() ?? '',
    );
    if (!match) return;
    const value = Number(match[1]!.replaceAll(',', '')),
      definition = metricDefinitions[metric];
    if (value < definition.min || value > definition.max) return;
    facts[metric] = {
      value,
      source: specId(m),
      sourceUrl: miniSpecUrl(m.code),
      note: `Exact Canadian CACode ${m.code}, manufacturer field ${field} with explicit ${unit} units. ${extra}These are published model-code measurements; optional wheel/equipment-specific differences are not separately established.`,
    };
  };
  set('horsepower', 'Power', 'hp');
  set('lengthMm', 'Length', 'mm');
  set('heightMm', 'Height', 'mm');
  set('widthMm', 'Width Including Mirrors', 'mm', 'Width includes mirrors. ');
  set(
    'cargoSeatsUpL',
    'Luggage Capacity Behind 2nd Row',
    'L',
    'Published two-row luggage arrangement. ',
  );
  set(
    'cargoSeatsDownL',
    'Luggage Capacity Behind 1st Row',
    'L',
    'Published luggage arrangement behind the first row. ',
  );
  if (props.Powertrain === 'Electric')
    set(
      'rechargeHours',
      'AC Charging Time 0-100% @ 9.6kW',
      'h',
      'Full AC recharge at 9.6 kW; DC 10–80% minutes and unitless colon durations are not substituted. ',
    );
  return facts;
}
function miniIdentity(m: MiniModel, stock?: MiniStockReference) {
  const props = miniProperties(m),
    gaps = miniTechnicalGaps(m, stock);
  const name = (m.current?.name ?? m.lines?.Vehicle ?? stock?.names[0] ?? m.code)
    .replace(new RegExp(`^${m.year} MINI\\s+`), '')
    .replace(/^MINI\s+/, '');
  const basis = `${m.current?.families.join(' ') ?? ''} ${name} ${stock?.names.join(' ') ?? ''}`;
  let model: string, bodyStyle: Car['bodyStyle'];
  if (/U25|Countryman/i.test(basis)) {
    model = 'Countryman';
    bodyStyle = 'SUV';
  } else if (/F67|Convertible/i.test(basis)) {
    model = 'Cooper Convertible';
    bodyStyle = 'Convertible';
  } else if (/F65|5\s*door|Cooper S 5\b/i.test(basis)) {
    model = 'Cooper 5 door';
    bodyStyle = 'Hatchback';
  } else if (/F66|3\s*door|John Cooper Works/i.test(basis)) {
    model = 'Cooper 3 door';
    bodyStyle = 'Hatchback';
  } else {
    model = name;
    bodyStyle = 'Not verified';
  }
  const fuel: Car['fuel'] =
    m.current?.electric || stock?.fuels.every((f) => f === 'E')
      ? 'Electric'
      : !gaps.length && props.Powertrain === 'Gasoline'
        ? 'Gasoline'
        : 'Gasoline / hybrid';
  const drivetrain: Car['drivetrain'] = m.current
    ? m.current.awd
      ? 'AWD'
      : 'FWD'
    : stock?.drives.length === 1 && ['AWD', 'FWD'].includes(stock.drives[0]!)
      ? (stock.drives[0] as 'AWD' | 'FWD')
      : 'Not verified';
  const transmission = gaps.some((gap) => gap.includes('transmission'))
    ? `Stock ${stock?.transmissions.join(' / ')}; technical source conflicts`
    : props.Transmission || stock?.transmissions.join(' / ') || 'Not verified';
  return { name, model, bodyStyle, fuel, drivetrain, transmission };
}
export function miniReviewGaps(snapshot: MiniSnapshot) {
  const refs = new Map(snapshot.inventory.references.map((r) => [miniModelKey(r), r]));
  return snapshot.models.flatMap((m) => {
    const stock = refs.get(m.key);
    return [
      ...Object.entries(
        miniFacts(
          m,
          snapshot.records.find((r) => r.modelKey === m.key)!,
          [],
          stock,
        ),
      )
        .filter(([, fact]) => fact.value === null)
        .map(([field, fact]) => ({
          brand: 'MINI',
          configuration: m.key,
          field,
          reason: fact.note!,
        })),
      ...miniTechnicalGaps(m, stock).map((reason) => ({
        brand: 'MINI',
        configuration: m.key,
        field: 'technical-identity',
        reason,
      })),
      ...(m.lineSource.status !== 200
        ? [
            {
              brand: 'MINI',
              configuration: m.key,
              field: 'factory-source',
              reason: `Reviewed factory line response HTTP ${m.lineSource.status}; no sibling/supplier price is substituted. Live refreshes abort on source failures.`,
            },
          ]
        : []),
      ...(!m.current
        ? [
            {
              brand: 'MINI',
              configuration: m.key,
              field: 'ordering-and-stock-equipment',
              reason:
                'Observed new-stock model code is absent from the active carousel. Its exact line/style/options and current factory ordering remain unverified; the base profile does not enumerate or price every equipped stock configuration.',
            },
          ]
        : []),
      ...(stock && stock.supplierBasePrices.length > 1
        ? [
            {
              brand: 'MINI',
              configuration: m.key,
              field: 'supplier-price-conflict',
              reason:
                'Supplier base-price values disagree within this exact stock model/year code. Published factory pricing is used where reconciled; supplier values are not a fallback.',
            },
          ]
        : []),
    ];
  });
}
export function addMiniRetail(base: Catalog, snapshot: MiniSnapshot): Catalog {
  const date = snapshot.retrievedAt.slice(0, 10),
    stockDate = snapshot.inventory.retrievedAt.slice(0, 10);
  const sources: Source[] = [
    {
      id: carouselId,
      title: 'MINI Canada active model-year selector',
      publisher: 'MINI Canada',
      url: miniCarouselUrl,
      reviewedAt: date,
      publishedAt: null,
      locator:
        'Published Canadian builder carousel: explicit model years/CACodes, active flags and base MSRP separately from all-inclusive price and fees. Overview families and duplicate electric-model references reconcile.',
    },
    {
      id: stockId,
      title: 'MINI Canada national new-inventory model-year identities',
      publisher: 'MINI Canada',
      url: miniStockUrl,
      reviewedAt: stockDate,
      publishedAt: null,
      locator:
        'All reported national new-stock pages, MINI/status N, no demos, with offers optional. Province/retailer, mileage, photo, year/price and geographic filters cleared. Reported counts, page rows and distinct vehicle identities reconcile. This is dated listing evidence, not a live inventory or exact equipped-stock guarantee.',
    },
  ];
  const models = new Map(snapshot.models.map((m) => [m.key, m])),
    refs = new Map(snapshot.inventory.references.map((r) => [miniModelKey(r), r]));
  for (const m of snapshot.models) {
    sources.push({
      id: baseId(m),
      title: `${m.year} MINI ${m.code} Canadian factory base price and equipment lines`,
      publisher: 'MINI Canada',
      url: miniLineUrl(m.code),
      reviewedAt: date,
      publishedAt: null,
      locator:
        'Exact Canadian CACode. Price is base MSRP; each LineList price is its separate equipment increment. Older ordering may be absent or conflict with stock transmissions. Failed sources and supplier base prices do not establish MSRP.',
    });
    sources.push({
      id: specId(m),
      title: `${m.year} MINI ${m.code} model-code technical table`,
      publisher: 'MINI Canada',
      url: miniSpecUrl(m.code),
      reviewedAt: date,
      publishedAt: null,
      locator:
        'Exact published CACode technical request. Explicit hp/mm/L units and luggage arrangements are retained only when model/stock identities reconcile. Stale manual-transmission tables, AG conflicts, unspecified energy cycles and ambiguous charging formats remain unknown.',
    });
  }
  const styleIds = new Set<string>(),
    cars: Car[] = [];
  for (const row of snapshot.records) {
    const m = models.get(row.modelKey)!,
      stock = refs.get(row.modelKey),
      identity = miniIdentity(m, stock);
    const line = m.lines?.LineList.find((l) => l.lineid === row.lineId);
    const sourceIds = [baseId(m), specId(m), m.current ? carouselId : stockId];
    if (m.current && stock) sourceIds.push(stockId);
    if (row.styleSource) {
      const id = `mini-ca-${m.year}-${slug(m.code)}-line-${row.lineId}-styles`;
      sourceIds.push(id);
      if (!styleIds.has(id)) {
        styleIds.add(id);
        sources.push({
          id,
          title: `${m.year} MINI ${m.code} ${line!.Name} style prices`,
          publisher: 'MINI Canada',
          url: row.styleSource.url,
          reviewedAt: date,
          publishedAt: null,
          locator:
            'Exact CACode and equipment line. Response base Price must match the model/line price. Each named StyleID retains its own increment; a published empty list means no separate style choice.',
        });
      }
    }
    if (row.navSource) {
      const id = `${contextId(row)}-selection`;
      sourceIds.push(id);
      sources.push({
        id,
        title: `${m.year} MINI ${m.code} ${line!.Name} ${row.style?.Name ?? 'standard style'} package prices`,
        publisher: 'MINI Canada',
        url: row.navSource.url,
        reviewedAt: date,
        publishedAt: null,
        locator:
          'Exact model/line/style selection. Non-accessory named package choices retain their separate published prices and package constraints. Vehicle MSRP combines factory model, line, style and selected package increments; other optional products, paint, all-inclusive fees and dealer selling prices are excluded.',
      });
    }
    for (const packages of miniPackageSelections(row, snapshot.rules[m.code] ?? [])) {
      const codes = packages.map((p) => p.code),
        id = miniRecordId(row, codes);
      cars.push({
        id,
        make: 'MINI',
        model: identity.model,
        trim: [identity.name, line?.Name, row.style?.Name].filter(Boolean).join(' · '),
        year: m.year,
        market: 'CA',
        bodyStyle: identity.bodyStyle,
        fuel: identity.fuel,
        drivetrain: identity.drivetrain,
        recordKind: 'retail-trim',
        variant: [
          identity.transmission,
          ...packages.map((p) => p.name),
          ...(row.stockBaseOnly ? ['Stock base profile; equipment not verified'] : []),
        ].join(' · '),
        manufacturerConfiguration: {
          id: `${miniRecordKey(row)}/${codes.sort().join(',') || 'standard'}`,
          code: m.code,
          transmission: identity.transmission,
          specificationsUrl: miniSpecUrl(m.code),
        },
        availability: {
          status: 'manufacturer-listed',
          checkedAt: m.current ? date : stockDate,
          source: m.current ? carouselId : stockId,
          note: m.current
            ? 'Active in the dated Canadian public builder. Exact published line/style/package selections are retained; individual paint/options, factory order acceptance and dealer-stock matching remain to reconcile.'
            : 'Explicit Canadian model/year code appears in dated national new stock. Current ordering and exact equipped stock variants remain unverified; this base profile does not establish every line/style/option choice.',
        },
        sourceIds,
        facts: miniFacts(m, row, packages, stock),
      });
    }
  }
  return validateCatalog({
    ...base,
    reviewedAt: date > base.reviewedAt ? date : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
