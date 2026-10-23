import { describe, expect, it } from 'vitest';
import { catalog, mercedesSnapshot as snapshot } from './index';
import {
  mercedesContext,
  mercedesJson,
  mercedesModelPage,
  mercedesOptionTree,
  mercedesPrice,
  mercedesReceiptSchema,
  mercedesRequireNoRegression,
  mercedesText,
  validateMercedesSnapshot,
} from './mercedes-import';
import { mercedesCarFacts, mercedesCarFuel, mercedesReviewGaps } from './mercedes';

const row = (key: string) => snapshot.cars.find((r) => r.key === key)!;
const reference = (key: string) => snapshot.menu.find((r) => r.key === key)!;
const facts = (key: string) => mercedesCarFacts(row(key), reference(key));
const retail = catalog.cars.filter(
  (c) => c.make === 'Mercedes-Benz' && c.recordKind === 'retail-trim',
);
const context = "mbNafta.ns('pageData').country = 'ca'; mbNafta.ns('pageData').currency = 'CAD';";
describe('Canadian Mercedes-Benz base model years, passenger and crew vans', () => {
  it('retains all explicit menu identities and both separate passenger-van selectors without claiming expansion completeness', () => {
    expect(validateMercedesSnapshot(snapshot).cars).toHaveLength(66);
    expect(snapshot.cars.filter((r) => r.builder)).toHaveLength(48);
    expect(snapshot.vans).toHaveLength(11);
    expect(snapshot.selectors.map((s) => [s.kind, s.models.length])).toEqual([
      ['passenger-van', 5],
      ['crew-van', 6],
    ]);
    expect(retail).toHaveLength(77);
    expect(retail.filter((c) => c.facts.msrpCad.value !== null)).toHaveLength(76);
    expect(new Set(retail.map((c) => c.year))).toEqual(new Set([2025, 2026, 2027]));
    expect(snapshot.placeholders).toEqual([
      'https://www.mercedes-benz.ca/en/vehicles/class/maybach-eqs/suv',
    ]);
    expect(
      mercedesReviewGaps(snapshot).some(
        (g) => g.field === 'scope' && g.reason.includes('Initial import'),
      ),
    ).toBe(true);
    expect(JSON.stringify(snapshot)).not.toMatch(/"(?:VIN|cookie|headers|x-api-key|email)"/i);
  });
  it('uses the active legacy MSRP basis with exact CCS defaults instead of the CCS default-model price', () => {
    const b = row('2027/GLC300W4').builder!.data;
    expect(b.content.useCCS).toBe(true);
    expect(b.content.useCCSPrice).toBe(false);
    expect(b.selected).toHaveLength(4);
    expect(b.tree.baseMsrpCad).toBe(61000);
    expect(mercedesPrice(b.tree, b.selected)).toBe(61000);
    expect(facts('2027/GLC300W4').msrpCad.value).toBe(61000);
    expect(facts('2027/CLA250E').msrpCad.value).toBe(49900);
    expect(facts('2027/GLC350E4').msrpCad.value).toBe(67300);
    expect(facts('2025/EQE350V4').msrpCad.value).toBe(85600);
    expect(reference('2025/EQE350V4').builder).toBeNull();
  });
  it('withholds the reviewed C 300 source conflict and rejects changed or newly conflicting candidates', () => {
    const c300 = row('2026/C300W4');
    expect(c300.vehicle.msrp).toBe(51650);
    expect(c300.builder!.data.msrpCad).toBe(62250);
    expect(facts(c300.key).msrpCad.value).toBeNull();
    expect(facts(c300.key).msrpCad.note).toContain('source conflict');
    const changed = structuredClone(snapshot);
    changed.cars.find((c) => c.key === c300.key)!.vehicle.msrp++;
    expect(() => validateMercedesSnapshot(changed)).toThrow(/Unreviewed.*conflict/);
    const newConflict = structuredClone(snapshot);
    newConflict.cars.find((c) => c.key === '2027/GLC300W4')!.vehicle.msrp++;
    expect(() => validateMercedesSnapshot(newConflict)).toThrow(/Unreviewed.*conflict/);
  });
  it('preserves standard seating, metric mirror conventions and published power instead of boost/optional maxima', () => {
    const glc = facts('2027/GLC300W4');
    expect(glc.seats.value).toBe(5);
    expect(glc.widthMm.value).toBe(1920);
    expect(glc.widthMm.note).toContain('excludes mirrors');
    expect(glc.lengthMm.value).toBe(4716);
    expect(glc.frontHeadroomMm.value).toBe(1048);
    expect(glc.frontLegroomMm.value).toBeNull();
    expect(glc.cargoSeatsUpL.value).toBeNull();
    expect(glc.cargoSeatsDownL.value).toBeNull();
    expect(facts('2025/AMGEQEV4').horsepower.value).toBe(617);
    expect(facts('2025/AMGEQEV4').horsepower.note).toContain('677');
    expect(facts('2025/EQS580X4').seats.value).toBe(5);
    expect(facts('2025/EQS580X4').seats.note).toContain('7 optional');
    expect(facts('2027/E53EW4').horsepower.value).toBe(577);
    expect(facts('2027/AMGGT63X').horsepower.value).toBe(603);
    expect(facts('2026/GT63C4SE').horsepower.value).toBeNull();
    for (const r of snapshot.cars) {
      const f = mercedesCarFacts(r, reference(r.key));
      expect(f.electricRangeKm.value).toBeNull();
      expect(f.rechargeHours.value).toBeNull();
      expect(f.fuelCombinedL100km.value).toBeNull();
    }
  });
  it('distinguishes mild hybrids, PHEVs and BEVs using explicit fuel/engine fields', () => {
    const fuel = (key: string) => mercedesCarFuel(reference(key), row(key));
    expect(fuel('2027/GLC300W4')).toBe('Hybrid');
    expect(fuel('2026/G550W4')).toBe('Hybrid');
    expect(fuel('2027/GLC350E4')).toBe('Plug-in hybrid');
    expect(fuel('2026/GT63C4SE')).toBe('Plug-in hybrid');
    expect(fuel('2027/CLA250E')).toBe('Electric');
    expect(fuel('2025/EQS580X4')).toBe('Electric');
    expect(fuel('2027/GT63R4')).toBe('Gasoline');
  });
  it('joins Sprinter seating by exact year/roof and preserves unknown crew capacity and non-AWD drive', () => {
    const car = (code: string) => retail.find((c) => c.manufacturerConfiguration?.code === code)!;
    expect(car('DPVH2S').facts.seats.value).toBe(12);
    expect(car('DPVH2L').facts.seats.value).toBe(15);
    expect(car('DPVH2S').facts.msrpCad.value).toBe(82420);
    expect(car('DPVA2S').facts.msrpCad.value).toBe(92130);
    expect(car('DPVA2S').drivetrain).toBe('AWD');
    expect(car('DPVH2S').drivetrain).toBe('Not verified');
    expect(car('DCVS2S').facts.msrpCad.value).toBe(68530);
    expect(car('DCVS2S').facts.seats.value).toBeNull();
    expect(car('DCVS2S').facts.seats.note).toContain('Mixed-year');
    expect(retail.filter((c) => c.bodyStyle === 'Van')).toHaveLength(11);
  });
  it('rejects missing menu/builder/van entries, duplicate identities, altered years and foreign receipts', () => {
    const omitted = structuredClone(snapshot);
    omitted.cars.pop();
    expect(() => validateMercedesSnapshot(omitted)).toThrow(/coverage/);
    const factory = structuredClone(snapshot);
    factory.cars.find((c) => c.builder)!.builder = null;
    expect(() => validateMercedesSnapshot(factory)).toThrow(/builder coverage/);
    const vans = structuredClone(snapshot);
    vans.vans.pop();
    expect(() => validateMercedesSnapshot(vans)).toThrow(/van.*coverage/);
    const selector = structuredClone(snapshot);
    selector.selectors.pop();
    expect(() => validateMercedesSnapshot(selector)).toThrow(/selector coverage/);
    const duplicate = structuredClone(snapshot);
    duplicate.cars.push(duplicate.cars[0]!);
    expect(() => validateMercedesSnapshot(duplicate)).toThrow(/duplicated/);
    const year = structuredClone(snapshot);
    year.cars[0]!.vehicle.year--;
    expect(() => validateMercedesSnapshot(year)).toThrow(/year\/body identity/);
    const wrongUrl = structuredClone(snapshot);
    wrongUrl.cars[0]!.source.url = 'https://www.mercedes-benz.ca/en/home';
    expect(() => validateMercedesSnapshot(wrongUrl)).toThrow(/source URL/);
    expect(() =>
      mercedesReceiptSchema.parse({
        ...snapshot.overviewSource,
        url: 'https://www.mbusa.com/en/home',
      }),
    ).toThrow();
    expect(() =>
      mercedesReceiptSchema.parse({
        ...snapshot.overviewSource,
        url: 'https://user@www.mercedes-benz.ca/en/home',
      }),
    ).toThrow();
    const lost = structuredClone(snapshot);
    lost.cars.pop();
    expect(() => mercedesRequireNoRegression(snapshot, lost)).toThrow(
      /previously represented model year/,
    );
  });
  it('rejects unknown/missing price components and prevents double counting included package children', () => {
    const b = row('2027/GLC300W4').builder!.data;
    // Price arithmetic alone does not verify package compatibility or orderability.
    expect(mercedesPrice(b.tree, [...b.selected, '9:DP1'])).toBe(64300);
    expect(mercedesPrice(b.tree, [...b.selected, '9:DP1', '0:810'])).toBe(64300);
    expect(() => mercedesPrice(b.tree, [...b.selected, 'MISSING'])).toThrow(/missing/);
    expect(() => mercedesPrice(b.tree, [...b.selected, b.selected[0]!])).toThrow(/duplicated/);
    const unknown = structuredClone(b.tree);
    unknown.options.find((o) => o.id === b.selected[0])!.price = null;
    expect(mercedesPrice(unknown, b.selected)).toBeNull();
    const cycle = structuredClone(b.tree);
    cycle.options.find((o) => o.id === b.selected[0])!.implied.push(b.selected[0]!);
    expect(() => mercedesPrice(cycle, b.selected)).toThrow(/Cyclic/);
    const group = b.tree.options.find((o) => o.type === 'PICK_LIST')!;
    expect(() => mercedesPrice(b.tree, [group.id])).toThrow(/abstract choice group/);
    const raw = {
      Response: {
        value: {
          'ns2:model': {
            'ns2:id': '2027-FIXTURE',
            'ns2:type': 'MODEL',
            'ns2:price': { 'ns2:amount': '61000', 'ns2:type': 'MSRP' },
          },
          'ns2:options': [
            {
              'ns2:id': 'PKG',
              'ns2:type': 'PACKAGE',
              'ns2:price': { 'ns2:amount': '-1', 'ns2:type': 'ITEM' },
              'ns2:implied': {
                'ns2:id': 'CHILD',
                'ns2:type': 'BOOLEAN',
                'ns2:price': { 'ns2:amount': '0', 'ns2:type': 'ITEM' },
              },
            },
          ],
        },
      },
    };
    const tree = mercedesOptionTree(raw, 'FIXTURE', 2027);
    expect(tree.options).toHaveLength(2);
    expect(mercedesPrice(tree, ['PKG'])).toBeNull();
    expect(() => mercedesOptionTree(raw, 'FIXTURE', 2026)).toThrow(/year mismatch/);
  });
  it('reads JSON literals and the reviewed bare metadata fields without evaluating surrounding scripts', () => {
    const value = { nested: ['brace } in string', { escaped: '\\"' }] };
    expect(
      mercedesJson(`untrusted(); MODEL: ${JSON.stringify(value)}; other();`, /MODEL:\s*/),
    ).toEqual(value);
    expect(() => mercedesJson('MODEL: (() => process.exit())()', /MODEL:\s*/)).toThrow(
      /JSON container/,
    );
    expect(() => mercedesJson('MODEL: {"a":[]', /MODEL:\s*/)).toThrow(/Truncated/);
    const metadata = `${context} mbNafta.ns('pageData').vehicle = { model: "FIXTURE", name: "Fixture", class: "TEST", year: "2027", bodyStyle: "SUV", msrp: "61000", unsafe: process.exit(), };`;
    const item = (tag: 'li' | 'div', name: string, value: string) =>
      `<${tag} class="model-specs-list__item"><span class="model-specs-list__item-name">${name}</span><span class="model-specs-list__item-value">${value}</span></${tag}>`;
    const html =
      metadata + item('li', 'Overall length (B)', '4,716&nbsp;mm') + item('div', 'Power', '255 hp');
    const parsed = mercedesModelPage(html, 'FIXTURE', 2027);
    expect(parsed.specifications).toEqual([
      { name: 'Overall length (B)', value: '4,716 mm' },
      { name: 'Power', value: '255 hp' },
    ]);
    expect(() => mercedesModelPage(html, 'FIXTURE', 2026)).toThrow(/year\/model mismatch/);
    expect(() => mercedesModelPage(metadata, 'FIXTURE', 2027)).toThrow(/specifications are empty/);
    expect(() => mercedesContext(context.replace("'ca'", "'us'"), false)).toThrow(
      /Canadian country/,
    );
    expect(() => mercedesContext(context.replace("'CAD'", "'USD'"), false)).toThrow(
      /Canadian currency/,
    );
    expect(mercedesText('&#xE9;&amp;&nbsp;<b>roof</b>')).toBe('é& roof');
  });
});
