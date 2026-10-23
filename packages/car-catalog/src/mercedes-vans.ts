import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import { mercedesRecordId } from './mercedes';
import type { MercedesVanStockSnapshot } from './mercedes-vans-import';

export const mercedesVanPageSourceId = (
  group: MercedesVanStockSnapshot['groups'][number],
  page: number,
) => `mercedes-vans-stock-${group.dealerIds.join('-')}-page-${page}`;
const priceSourceId = (key: string) => `${mercedesRecordId(key)}-stock-base-msrp`;
export function addMercedesVanStock(base: Catalog, snapshot: MercedesVanStockSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10),
    sources: Source[] = [],
    stockSources = new Map<string, Set<string>>();
  const eligible = snapshot.observations.filter((r) => r.available && !r.reserved);
  for (const group of snapshot.groups)
    for (const page of group.pages) {
      const id = mercedesVanPageSourceId(group, page.page);
      sources.push({
        id,
        publisher: 'Mercedes-Benz Canada',
        title: `Canadian new passenger/crew van search, dealers ${group.dealerIds.join('/')}, page ${page.page + 1}`,
        url: page.source.url,
        reviewedAt: on,
        publishedAt: null,
        locator: `Manufacturer NEW inventory, currentDealerOnly=true, shared=true, ${snapshot.modelCodes.length} source-declared passenger/crew model codes, no year/price/equipment restrictions. Zero-based page ${page.page}, row offset ${page.offset}, capacity 12; ${page.ids.length} returned rows, group total ${group.total}. Distinct identities reconcile. Dealer directory and independent national stock completeness remain separate questions.`,
      });
      for (const observation of eligible.filter((r) => page.ids.includes(r.id))) {
        const set = stockSources.get(observation.key) ?? new Set<string>();
        set.add(id);
        stockSources.set(observation.key, set);
      }
    }
  const cars = base.cars.map((car) => {
    const key =
      car.make === 'Mercedes-Benz' && car.manufacturerConfiguration
        ? `${car.year}/${car.manufacturerConfiguration.code}`
        : '';
    const ids = stockSources.get(key);
    if (!ids) return car;
    return {
      ...car,
      sourceIds: [...new Set([...car.sourceIds, ...ids])],
      availability: {
        ...car.availability,
        note: `${car.availability.note} The same model-year/code also appears in ${eligible.filter((r) => r.key === key).length} captured new listings with varying optional equipment. This standard-equipment profile is not a priced individual stock vehicle.`,
      },
    };
  });
  for (const archive of snapshot.archives) {
    const c = archive.content,
      id = mercedesRecordId(archive.key),
      evidence = stockSources.get(archive.key);
    if (!evidence?.size || cars.some((r) => r.id === id))
      throw new Error(
        'Mercedes older stock profile is missing evidence or duplicates an existing base profile.',
      );
    sources.push({
      id: priceSourceId(archive.key),
      publisher: 'Mercedes-Benz Canada',
      title: `${c.year} Sprinter ${c.model} Canadian bare-model MSRP`,
      url: archive.source.url,
      reviewedAt: on,
      publishedAt: null,
      locator: `Public Canadian en_ca factory content: brand=mb, valid=true, exact model/year/class/body. Explicit msrp, cylinder and defaultVariant. This is bare-model MSRP; stock configured amounts, options, paint, freight/PDI, fees and incentives are not substituted or subtracted. Factory orderability and compatible package selections are not asserted.`,
    });
    const facts = Object.fromEntries(
      Object.keys(metricDefinitions).map((key) => [
        key,
        {
          value: null,
          source: null,
          note: 'Not verified for this exact older Canadian model year and base equipment. Observed stock vehicles have optional equipment; their roofs, seats and dimensions are not copied into the base profile.',
        } satisfies Fact,
      ]),
    ) as Car['facts'];
    facts.msrpCad = {
      value: c.msrp,
      source: priceSourceId(archive.key),
      note: `Manufacturer-published bare-model MSRP for exact ${archive.key}, before optional equipment, paint, freight/PDI, fees, levies, sales taxes and incentives. This model-year/code appears in Canadian new stock, whose configured price can be higher. This is not an individual stock vehicle's selling price; confirm the selected equipment and dealer price.`,
    };
    if (!['4CYLDIESELSO', '4CYLDIESELHO', '4CYLDIESELAWD'].includes(c.cylinder))
      throw new Error('Older Mercedes van fuel classification needs renewed review.');
    const output = (
      {
        '4CYLDIESELSO': 'Standard Output',
        '4CYLDIESELHO': 'High Output',
        '4CYLDIESELAWD': 'High Output AWD',
      } as Record<string, string>
    )[c.cylinder]!;
    cars.push({
      id,
      make: 'Mercedes-Benz',
      model: c.class.startsWith('SPRINTER') ? 'Sprinter' : 'Metris',
      trim: `${c.vehicleName.replace(/\b(?:Standard|High) Roof\s+/g, '')} · ${output}`,
      year: c.year,
      market: 'CA',
      bodyStyle: 'Van',
      fuel: 'Diesel',
      drivetrain: c.cylinder === '4CYLDIESELAWD' ? 'AWD' : 'Not verified',
      recordKind: 'retail-trim',
      variant: 'Base model · Observed new stock',
      manufacturerConfiguration: { id, code: c.model, transmission: 'Not independently verified' },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: on,
        source: [...evidence][0]!,
        note: `Exact year/code appears in ${eligible.filter((r) => r.key === archive.key).length} manufacturer-classified NEW, available, unreserved Canadian dealer listings. Stock vehicles have varying optional equipment. Demo status, title, condition, configured selling price and delivery require confirmation; current factory ordering is not asserted.`,
      },
      sourceIds: [priceSourceId(archive.key), ...evidence],
      facts,
    });
  }
  return validateCatalog({
    ...base,
    reviewedAt: on > base.reviewedAt ? on : base.reviewedAt,
    cars,
    sources: [...base.sources, ...sources],
  });
}
export function mercedesVanStockGaps(snapshot: MercedesVanStockSnapshot) {
  return [
    {
      brand: 'Mercedes-Benz',
      field: 'van-stock-scope',
      reason: `All ${snapshot.dealers.length} manufacturer-listed Canadian dealer contexts and their passenger/crew query pages reconcile ${snapshot.observations.length} distinct vehicle identities. The manufacturer's directory/model references may still omit independent dealer offerings. Full Mercedes-Benz stock coverage, passenger-car stock and additional equipment combinations remain unverified.`,
    },
    {
      brand: 'Mercedes-Benz',
      field: 'van-stock-equipment',
      reason:
        'Observed listings include optional packages, roofs, paint and upholstery. This milestone adds older bare-model profiles and model-level new-stock evidence; it does not price all individual equipment configurations or copy stock seating into base specifications. Published stock MSRP fields remain separate from normalized bare-model MSRP.',
    },
    {
      brand: 'Mercedes-Benz',
      configuration: 'Metris passenger van',
      field: 'van-stock-filter-only',
      reason:
        'The new-inventory filters and factory archive include a 2023 Metris passenger reference, but the captured dealer queries returned no matching vehicle. Filter metadata is not current-stock proof, and the zero observed count is not an independent nationwide absence determination.',
    },
  ];
}
