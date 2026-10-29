import { metricDefinitions, validateCatalog } from './schema';
import type { Catalog, Car, Fact, Source } from './schema';
import type { SubaruSnapshot } from './subaru-import';

const originalIds: Record<number, string> = {
  1562: 'subaru-forester-2026-convenience-awd',
  1563: 'subaru-forester-2026-touring-awd',
};

export function addSubaruRetail(base: Catalog, snapshot: SubaruSnapshot): Catalog {
  const reviewedAt = snapshot.retrievedAt.slice(0, 10);
  const lineupSource = `subaru-ca-lineup-${reviewedAt}`;
  const sources: Source[] = [
    {
      id: lineupSource,
      title: 'Current Subaru Canada retail lineup',
      publisher: 'Subaru Canada',
      url: snapshot.lineup.url,
      reviewedAt,
      publishedAt: null,
      locator:
        'Embedded Cars and Models JSON: exact model years, retail trim IDs, model codes, seating and powertrain flags. The header selling prices are not used as base MSRP. Listed models do not guarantee dealer stock or delivery times.',
    },
  ];
  const pricingSources = new Map<string, string>();
  for (const model of snapshot.models) {
    const id = `subaru-ca-${model.year}-${model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-retail-pricing`;
    pricingSources.set(model.pricingUrl, id);
    sources.push({
      id,
      title: `${model.year} ${model.name} Canadian retail pricing`,
      publisher: 'Subaru Canada',
      url: model.pricingUrl,
      reviewedAt,
      publishedAt: null,
      locator:
        'Embedded preloadedTrimData: each listed trim and transmission ID, Transmissions.MSRP in CAD. Excludes freight/PDI, taxes, fees, colours, accessories and optional packages.',
    });
  }
  const existing = new Map(base.cars.map((car) => [car.id, car]));
  const additions: Car[] = snapshot.trims.map((trim) => {
    const id = originalIds[trim.manufacturerId] ?? `subaru-ca-${trim.manufacturerId}`;
    const previous = existing.get(id);
    const pricingSource = pricingSources.get(trim.pricingUrl)!;
    const unknown = (): Fact => ({
      value: null,
      source: null,
      note: 'Exact Canadian trim specifications have not yet been verified. See the manufacturer specification link; no rating variant has been assumed.',
    });
    const facts = previous
      ? { ...previous.facts }
      : (Object.fromEntries(
          Object.keys(metricDefinitions).map((key) => [key, unknown()]),
        ) as Car['facts']);
    facts.msrpCad = {
      value: trim.msrpCad,
      source: pricingSource,
      sourceUrl: `${trim.pricingUrl}&CarID=${trim.manufacturerId}`,
      note: 'Current manufacturer-listed base MSRP in CAD, before freight/PDI, taxes, fees, colours, accessories and optional packages. Confirm current pricing with the retailer.',
    };
    facts.seats = {
      value: trim.seats,
      source: lineupSource,
      note: 'Manufacturer seating count for this exact retail configuration.',
    };
    return {
      ...(previous ?? {}),
      id,
      make: 'Subaru',
      model: trim.model,
      trim: trim.trim,
      year: trim.year,
      market: 'CA',
      bodyStyle: previous?.bodyStyle ?? 'Not verified',
      fuel: trim.powertrain,
      drivetrain: previous?.drivetrain ?? (/^FWD\b/.test(trim.trim) ? 'FWD' : 'Not verified'),
      recordKind: 'retail-trim',
      manufacturerConfiguration: {
        id: String(trim.manufacturerId),
        code: trim.modelCode,
        transmission: trim.transmission,
        specificationsUrl: trim.specificationsUrl,
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: reviewedAt,
        source: lineupSource,
        note: 'Listed in Subaru Canada’s current model/trim lineup with manufacturer pricing. Dealer stock, older model-year stock and delivery dates are not established by this listing.',
      },
      sourceIds: [...new Set([...(previous?.sourceIds ?? []), lineupSource, pricingSource])],
      facts,
    };
  });
  const replaced = new Set(additions.map((car) => car.id));
  return validateCatalog({
    ...base,
    reviewedAt: reviewedAt > base.reviewedAt ? reviewedAt : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars.filter((car) => !replaced.has(car.id)), ...additions],
  });
}
