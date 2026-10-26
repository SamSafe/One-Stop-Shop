import { describe, expect, it } from 'vitest';
import data from '../data/manufacturers/porsche.json';
import { catalog } from './index';
import {
  porscheBuilderLoader,
  porscheFactory,
  porscheFactorySchema,
  porscheLineup,
  porscheDetail,
  porscheNoRegression,
  porscheSelectionUrl,
  validatePorscheSnapshot,
} from './porsche-import';
import { porscheRecordId, porscheReviewGaps } from './porsche';
const snapshot = validatePorscheSnapshot(data);
function island(props: Record<string, unknown>) {
  function encode(v: unknown): unknown {
    return v === undefined
      ? [0]
      : Array.isArray(v)
        ? [1, v.map(encode)]
        : [
            0,
            v && typeof v === 'object'
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)]))
              : v,
          ];
  }
  return `<astro-island props="${JSON.stringify(
    Object.fromEntries(Object.entries(props).map(([k, v]) => [k, encode(v)])),
  )
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')}"></astro-island>`;
}
const model = (code: string) => snapshot.models.find((m) => m.reference.code === code)!;
const car = (code: string, rear = false, trans?: string) =>
  catalog.cars.find(
    (c) =>
      c.id ===
      porscheRecordId(
        model(code).profiles.find(
          (p) =>
            Boolean(p.data.rearSeatOption?.selected) === rear &&
            (!trans || p.data.transmission?.id === trans),
        )!.data,
      ),
  )!;
function stream(value: unknown, locale = 'en-CA') {
  const table: unknown[] = [],
    seen = new WeakMap<object, number>();
  function encode(v: unknown): number {
    if (v === null) return -5;
    if (v === undefined) return -7;
    if (typeof v === 'object' && seen.has(v)) return seen.get(v)!;
    const i = table.length;
    table.push(null);
    if (typeof v === 'object') seen.set(v!, i);
    table[i] =
      v instanceof Set
        ? ['S', ...[...v].map(encode)]
        : Array.isArray(v)
          ? v.map(encode)
          : v && typeof v === 'object'
            ? Object.fromEntries(Object.entries(v).map(([k, x]) => [`_${encode(k)}`, encode(x)]))
            : v;
    return i;
  }
  encode({ loaderData: { root: { locale }, 'customer-configurator': value } });
  return `<script>window.__reactRouterContext.streamController.enqueue(${JSON.stringify(JSON.stringify(table))})</script>`;
}
function factoryFixture() {
  const m = model('9921B2'),
    p = m.initial!.data;
  return {
    market: { locale: 'en-CA', currency: 'CAD' },
    catalog: {
      orderType: p.code,
      modelYear: p.year,
      modelName: p.name,
      engineType: p.engineType,
      disclaimer: p.disclaimer,
    },
    configuration: {
      prices: { main: structuredClone(p.prices) },
      options: [...p.selectedOptions],
      transmissionOption: p.transmission,
    },
    views: {
      optionsList: [
        {
          categories: [
            {
              groups: [
                {
                  title: 'Transmission',
                  selectedOptions: [p.transmission!.id],
                  items: p.transmissionChoices.map((t) => ({
                    id: t.id,
                    title: t.title,
                    priceNumeric: t.priceCad,
                    isSelected: t.id === p.transmission!.id,
                  })),
                },
                {
                  title: 'Rear seating',
                  selectedOptions: [],
                  items: [
                    {
                      id: '3UG',
                      title: 'Rear Seats',
                      priceNumeric: 0,
                      isSelected: false,
                      description: p.rearSeatOption!.description,
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}
describe('Canadian Porsche exact model years and native equipment selections', () => {
  it('parses the Canadian menu without guessing identities from images or links', () => {
    const m = model('9921B2').reference;
    const raw = {
      id: m.id,
      model: {
        modelType: m.code,
        modelName: m.name,
        modelYear: String(m.year),
        bodyType: m.body,
        modelRangeId: m.familyId,
        modelRange: m.family,
        modelSeriesId: 'carrera-models',
        wheelDrive: 'Rear-wheel drive',
        seats: m.seatingLabel,
        fuelType: m.fuel,
        gearType: m.transmissionChoice,
        powerHp: { ...m.power, unit: 'hp' },
      },
      props: {
        actions: [
          { type: 'changeModel', href: m.detailUrl },
          { type: 'configurator', href: m.builderUrl },
        ],
      },
    };
    const html = island({ locale: 'en-CA', modelCards: [raw] });
    expect(porscheLineup(html)[0]!.id).toBe(m.id);
    expect(() => porscheLineup(island({ locale: 'en-US', modelCards: [raw] }))).toThrow(/Canadian/);
    expect(() => porscheLineup(html + html)).toThrow(/duplicated/);
    raw.id = '9921B2-2026';
    expect(() => porscheLineup(island({ locale: 'en-CA', modelCards: [raw] }))).toThrow(
      /identities/,
    );
  });
  it('requires matching Canadian model-year metadata for technical facts', () => {
    const m = model('9921B2').reference,
      meta = {
        locale: 'en-CA',
        modelYear: '2027',
        modelCode: m.code,
        countrySpecificationCode: 'C36',
      };
    const technical = island({
      headingTechnicalData: 'Technical Data',
      initial: {
        modelVariantCode: m.code,
        technicalData: {
          name: m.name,
          categories: [
            {
              id: 'bodyCategory',
              attributes: [
                { id: 'width-G1F', label: 'Width (not incl. mirrors)', value: '1,852 mm' },
              ],
            },
          ],
        },
        standardEquipment: { name: m.name, categories: [] },
      },
    });
    expect(porscheDetail(island(meta) + technical, m).rows[0]!.value).toBe('1,852 mm');
    expect(() => porscheDetail(island({ ...meta, modelYear: '2026' }) + technical, m)).toThrow(
      /model\/year/,
    );
    expect(() =>
      porscheDetail(island({ ...meta, countrySpecificationCode: 'C00' }) + technical, m),
    ).toThrow();
    expect(() => porscheDetail(technical, m)).toThrow(/identity/);
  });
  it('leaves technical tables without an exact-year identity unqualified on menu-only models', () => {
    const m = model('992902').reference;
    expect(
      porscheDetail('<main>Limited collector model; no year-qualified table.</main>', m),
    ).toMatchObject({ identityKind: 'menu-only', rows: [], equipment: [] });
    expect(() => porscheDetail('<main>Missing table</main>', model('9921B2').reference)).toThrow(
      /identity/,
    );
  });
  it('reconciles every current menu identity and all captured transmission/rear-seat combinations', () => {
    expect(snapshot.models).toHaveLength(74);
    expect(snapshot.models.filter((m) => m.initial)).toHaveLength(73);
    expect(snapshot.models.reduce((n, m) => n + m.profiles.length, 0)).toBe(93);
    expect(snapshot.models.flatMap((m) => m.profiles).filter((p) => p.selection)).toHaveLength(22);
    expect(
      snapshot.models
        .filter((m) => m.initial?.data.transmission === null)
        .map((m) => m.reference.code),
    ).toEqual(['982110', '982310']);
    expect(
      catalog.cars.filter((c) => c.make === 'Porsche' && c.recordKind === 'retail-trim'),
    ).toHaveLength(94);
    expect(new Set(snapshot.models.map((m) => m.reference.year))).toEqual(
      new Set([2025, 2026, 2027]),
    );
    expect(JSON.stringify(snapshot)).not.toMatch(
      /"(?:vin|headers|cookie|email|authToken|accessToken|porscheCode)"/i,
    );
  });
  it('preserves selected two/four-seat layouts without treating an unselected no-cost option as standard', () => {
    expect(car('9921B2').facts.seats.value).toBe(2);
    expect(car('9921B2', true).facts.seats.value).toBe(4);
    expect(car('9921B2').facts.msrpCad.value).toBe(144900);
    expect(car('9921B2', true).facts.msrpCad.value).toBe(144900);
    expect(car('9921B2').facts.seats.note).toContain('deleted');
    expect(model('992822').profiles).toHaveLength(4);
  });
  it('uses completed explicit manual/PDK selections when an initializer has no transmission', () => {
    expect(model('982110').initial!.data.transmission).toBeNull();
    expect(model('982110').reference.name).toBe('718 Cayman Style Edition');
    expect(model('982310').reference.name).toBe('718 Boxster Style Edition');
    expect(model('982110').profiles).toHaveLength(2);
    expect(car('982110', false, '250').variant).toContain('PDK');
    expect(car('982110', false, '480').variant).toContain('manual');
    expect(car('982110', false, '480').facts.msrpCad.value).toBe(87100);
    expect(car('982110', false, '250').facts.msrpCad.value).toBe(87100);
    expect(car('982110', false, '250').id).not.toBe(car('982110', false, '480').id);
  });
  it('separates ordinary/combined power from engine-only, motor-only and Launch Control output', () => {
    expect(car('XABBB1').facts.horsepower.value).toBe(382);
    expect(car('XABBB1').facts.horsepower.note).toContain('non-overboost');
    expect(car('992142').fuel).toBe('Hybrid');
    expect(car('992142').facts.horsepower.value).toBe(532);
    expect(car('YAABE1').fuel).toBe('Plug-in hybrid');
    expect(car('YAABE1').facts.horsepower.value).toBe(463);
    expect(car('YAABE1').facts.horsepower.value).not.toBe(300);
    expect(car('XABBB1').facts.widthMm.value).toBeGreaterThan(1900);
    expect(car('XABBB1').facts.widthMm.note).toContain('excludes mirrors');
    expect(car('XABBB1').facts.heightMm.value).toBe(1623);
  });
  it('keeps fees, tax, unqualified cargo, partial charging and energy cycles outside comparable facts', () => {
    const p = model('9921B2').initial!.data;
    expect(p.prices.base.raw).toBe(144900);
    expect(p.prices.luxuryTax.raw).toBe(10197);
    expect(car('9921B2').facts.msrpCad.value).not.toBe(161182);
    for (const c of catalog.cars.filter(
      (c) => c.make === 'Porsche' && c.recordKind === 'retail-trim',
    )) {
      expect(c.publishedPrice).toBeUndefined();
      expect(c.governmentRating).toBeUndefined();
      expect(c.facts.rechargeHours.value).toBeNull();
      expect(c.facts.cargoSeatsUpL.value).toBeNull();
      expect(c.facts.electricCombinedKwh100km.value).toBeNull();
    }
  });
  it('keeps the limited menu-only model visible with explicit price, allocation and technical gaps', () => {
    const m = model('992902');
    expect(m.initial).toBeNull();
    expect(m.detail.data.identityKind).toBe('menu-only');
    const c = catalog.cars.find((c) => c.id === 'porsche-ca-992902-2027-menu')!;
    expect(c.year).toBe(2027);
    expect(c.facts.msrpCad.value).toBeNull();
    expect(c.facts.horsepower.value).toBe(502);
    expect(c.facts.horsepower.source).toBe('porsche-ca-current-menu');
    expect(c.facts.lengthMm.value).toBeNull();
    expect(c.availability.note).toContain('allocation');
    expect(porscheReviewGaps(snapshot).some((g) => g.field === 'menu-only-model')).toBe(true);
  });
  it('decodes JSON references, sets, null and omitted values without executing scripts', () => {
    expect(porscheBuilderLoader(stream({ n: null, u: undefined, s: new Set(['a']) }))).toEqual({
      n: null,
      u: undefined,
      s: new Set(['a']),
    });
    expect(() => porscheBuilderLoader(stream({}, 'en-US'))).toThrow(/Canadian/);
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    expect(() => porscheBuilderLoader(stream(cycle))).toThrow(/reference/);
    expect(() => porscheBuilderLoader(stream({}) + stream({}))).toThrow(/stream/);
    expect(() => porscheBuilderLoader(stream(Object.fromEntries([['__proto__', {}]])))).toThrow(
      /Unsafe/,
    );
  });
  it('requires the exact Canadian model/year, CAD price basis and selected option reconciliation', () => {
    const fixture = factoryFixture();
    expect(porscheFactory(stream(fixture), model('9921B2').reference).transmission!.id).toBe('G1F');
    fixture.catalog.modelYear = 2026;
    expect(() => porscheFactory(stream(fixture), model('9921B2').reference)).toThrow(/model\/year/);
    fixture.catalog.modelYear = 2027;
    fixture.configuration.prices.main.options.raw = 500;
    fixture.configuration.prices.main.options.gross = '$500';
    expect(() => porscheFactory(stream(fixture), model('9921B2').reference)).toThrow(
      /unreviewed priced equipment/,
    );
  });
  it('accepts displayed whole-dollar tax rounding while rejecting source price conflicts', () => {
    const f = structuredClone(model('992442').initial!.data);
    expect(f.prices.luxuryTax).toMatchObject({ raw: 20448.5, gross: '$20,449' });
    expect(() => porscheFactorySchema.parse(f)).not.toThrow();
    f.prices.base.gross = '$1';
    expect(() => porscheFactorySchema.parse(f)).toThrow(/amount conflicts/);
  });
  it('rejects missing profiles, broken native URLs, wrong years, lost client proof and re-dated captures', () => {
    for (const change of [
      (s: typeof snapshot) => s.models[0]!.profiles.pop(),
      (s: typeof snapshot) => (s.models[0]!.profiles[1]!.source.url += '&unreviewed=1'),
      (s: typeof snapshot) => s.models[0]!.profiles[0]!.data.year++,
      (s: typeof snapshot) => (s.models[0]!.initial!.data.code = '992000'),
      (s: typeof snapshot) => (s.models[0]!.reference.fuel = 'HYBRID'),
      (s: typeof snapshot) => s.clients.pop(),
      (s: typeof snapshot) => (s.clients[0]!.sha256 = '0'.repeat(64)),
      (s: typeof snapshot) => (s.retrievedAt = '2026-10-27T01:00:00.000Z'),
      (s: typeof snapshot) => (s.models[0]!.detail.source.status = 403),
      (s: typeof snapshot) => (s.overviewSource.capturedAt = '2026-10-20T00:00:00.000Z'),
    ]) {
      const copy = structuredClone(snapshot);
      change(copy);
      expect(() => validatePorscheSnapshot(copy)).toThrow();
    }
  });
  it('rejects invented selected codes, incompatible prices and menu-only technical facts', () => {
    const duplicate = structuredClone(model('9921B2').profiles[0]!.data);
    duplicate.selectedOptions.push(duplicate.selectedOptions[0]!);
    expect(() => porscheFactorySchema.parse(duplicate)).toThrow(/selected codes/);
    const unknown = structuredClone(snapshot);
    unknown.models
      .find((m) => m.reference.code === '992902')!
      .detail.data.rows.push({
        category: 'body',
        id: 'width',
        label: 'Width',
        value: '1900 mm',
        annotation: null,
      });
    expect(() => validatePorscheSnapshot(unknown)).toThrow(/unsupported facts/);
    const p = model('9921B2').initial!.data;
    expect(() => porscheSelectionUrl(p, 'unreviewed')).toThrow(/Unsupported/);
    expect(porscheSelectionUrl(p, '3UG')).toContain('optionAdded=3UG');
  });
  it('prevents a refresh from losing a model year, selected profile or newer evidence', () => {
    expect(() => porscheNoRegression(snapshot, snapshot)).not.toThrow();
    const missing = structuredClone(snapshot);
    missing.models.pop();
    expect(() => porscheNoRegression(snapshot, missing)).toThrow(/lose/);
    const profile = structuredClone(snapshot);
    profile.models[0]!.profiles.pop();
    expect(() => porscheNoRegression(snapshot, profile)).toThrow(/lose/);
    const older = structuredClone(snapshot);
    older.retrievedAt = '2026-10-23T00:00:00.000Z';
    expect(() => porscheNoRegression(snapshot, older)).toThrow(/older/);
  });
});
