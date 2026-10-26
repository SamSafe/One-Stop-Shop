import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Fact, Source } from './schema';
import { mclarenPageUrl } from './mclaren-import';
import type { MclarenSnapshot } from './mclaren-import';

export const mclarenRecordId = (id: string, year: number) => `mclaren-ca-${id}-${year}`;
export function addMclarenRetail(base: Catalog, snapshot: MclarenSnapshot): Catalog {
  const on = snapshot.retrievedAt.slice(0, 10);
  const sources: Source[] = snapshot.profiles.map((p) => ({
    id: `mclaren-ca-${p.id}-factory-identity`,
    publisher: 'McLaren',
    title: `${p.year} ${p.name} Canadian public configuration identity`,
    url: mclarenPageUrl(p.id),
    reviewedAt: on,
    publishedAt: null,
    locator: `Choose Canada, then Configure from Base Model. The ordinary response's General characteristics explicitly identify CH_GEN_COUNTRY=CA, CH_GEN_MODEL_YEAR=${p.year}, model=${p.modelCode} and body=${p.body}. The model year is not inferred from copyright, vehicle codes or dealer inventory. Canadian profile metadata disables price display. Factory defaults can contain optional equipment; an exact base MSRP is not established.`,
  }));
  const cars: Car[] = snapshot.profiles.map((p) => {
    const id = mclarenRecordId(p.id, p.year),
      source = `mclaren-ca-${p.id}-factory-identity`;
    const facts = Object.fromEntries(
      Object.keys(metricDefinitions).map((key) => [
        key,
        {
          value: null,
          source: null,
          note: 'Not verified for this exact Canadian model year and equipment. Global model tables without an exact-year qualification, EU WLTP figures and other model years are not substituted.',
        } satisfies Fact,
      ]),
    ) as Car['facts'];
    facts.msrpCad.note =
      'The Canadian factory profile explicitly disables price display. Its preselected equipment is not proof of base equipment or base MSRP. No zero price, foreign-market amount, configured dealer quote or incentive is substituted.';
    return {
      id,
      make: 'McLaren',
      model: p.modelCode === 'P16' ? 'Artura' : p.modelCode === 'P28' ? '750S' : 'GTS',
      trim:
        p.body === 'GT'
          ? 'Factory defaults'
          : `${p.body === 'COUPE' ? 'Coupe' : 'Spider'} · factory defaults`,
      year: p.year,
      market: 'CA',
      recordKind: 'retail-trim',
      bodyStyle: p.body === 'SPIDER' ? 'Convertible' : 'Coupe',
      fuel: p.hybrid ? 'Plug-in hybrid' : 'Gasoline',
      drivetrain: 'Not verified',
      variant: 'Canadian public configuration · equipment and price unverified',
      manufacturerConfiguration: {
        id: p.profileName,
        code: `${p.modelCode}/${p.body}`,
        transmission: 'Not verified',
        specificationsUrl: mclarenPageUrl(p.id),
      },
      availability: {
        status: 'manufacturer-listed',
        checkedAt: on,
        source,
        note: 'Current public Canadian configurator accepts this profile and explicitly identifies its model year. This is a configured-default profile, not a quotation or confirmed stock vehicle. Alternate interiors, packages, exact standard equipment, allocations, order acceptance, delivery and older new stock remain unverified.',
      },
      sourceIds: [source],
      facts,
    };
  });
  return validateCatalog({
    ...base,
    reviewedAt: on > base.reviewedAt ? on : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars: [...base.cars, ...cars],
  });
}
export function mclarenReviewGaps(snapshot: MclarenSnapshot) {
  return [
    {
      brand: 'McLaren',
      field: 'scope',
      reason:
        'Five Canadian year-qualified factory profiles are represented. The global navigation is not a complete Canadian market denominator. Independent national lineups, every retail trim/equipment combination, current allocations and current/older new stock remain open.',
    },
    {
      brand: 'McLaren',
      field: 'price-and-equipment',
      reason:
        'Canada price-display flags are false. Factory defaults include selected equipment; their price and exact standard-equipment basis remain unknown. Artura Performance and TechLux interiors and further equipment/package choices require resolved selections. The GPU preview error affected further tab capture; it does not establish unavailable equipment.',
    },
    {
      brand: 'McLaren',
      field: 'older-new-stock',
      reason:
        'A separate fresh Toronto new-stock capture lists a 2026 GTS alongside 2027 750S Spider vehicles. It is not assigned to the current 2027 GTS factory profile. Exact older-year trim, equipment, Canadian base MSRP and national inventory reconciliation remain open.',
    },
    {
      brand: 'McLaren',
      field: 'technical-specifications',
      reason:
        'Current global model tables publish power, luggage figures and EU WLTP economy. Their exact Canadian model-year and equipment joins remain unverified, so they are not copied into these year-qualified profiles.',
    },
    ...snapshot.navigation
      .filter((n) => !n.profile && n.category !== 'Motorsport')
      .map((n) => ({
        brand: 'McLaren',
        configuration: n.name,
        field: 'canadian-offering',
        reason:
          'Listed in global road-car navigation without a public Canadian configuration profile. Current Canadian offering/allocation and model year require verification; global menu presence alone is insufficient.',
      })),
  ];
}
