import { metricDefinitions, validateCatalog } from './schema';
import type { Car, Catalog, Metric, Source } from './schema';
import type {
  SubaruSpecificationsModel,
  SubaruSpecificationsSnapshot,
} from './subaru-specifications-import';

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export const subaruSpecificationSourceId = (
  model: Pick<SubaruSpecificationsModel, 'model' | 'year'>,
) => `subaru-ca-${model.year}-${slug(model.model)}-trim-specifications`;

export function subaruSpecificationRows(model: SubaruSpecificationsModel, manufacturerId: number) {
  return model.rows.map((row) => {
    const cell = row.cells.find((cell) => cell.manufacturerId === manufacturerId);
    if (!cell)
      throw new Error(`Missing Subaru specification column: ${manufacturerId}, ${row.label}.`);
    return { label: row.label, ...cell };
  });
}

export function subaruPowertrainEvidence(model: SubaruSpecificationsModel, manufacturerId: number) {
  const rows = subaruSpecificationRows(model, manufacturerId).filter((row) => row.status === 'S');
  const unique = (pattern: RegExp) => {
    const labels = rows.filter((row) => pattern.test(row.label)).map((row) => row.label);
    return labels.length === 1 ? labels[0] : undefined;
  };
  return {
    engine: unique(/^Engine:.*\b\d+(?:\.\d+)?-L\b/),
    layout: unique(/^Engine layout:.*\b\d+-cylinder\b/),
    transmission: unique(/^Transmission:/),
    drivetrain: unique(/^Drivetrain:.*\((?:AWD|FWD|RWD|4WD)\)/),
  };
}

export function subaruSpecNumber(raw: string) {
  return /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)
    ? Number(raw.replaceAll(',', ''))
    : null;
}

export function assertSubaruRatingEvidence(
  cars: Car[],
  snapshot: SubaruSpecificationsSnapshot,
  link: {
    retailId: string;
    manufacturerSource: string;
    engineEvidence: string;
    engineLayoutEvidence?: string;
    transmissionEvidence?: string;
    drivetrainEvidence?: string;
  },
) {
  const car = cars.find((car) => car.id === link.retailId);
  const id = Number(car?.manufacturerConfiguration?.id);
  const model = snapshot.models.find((model) =>
    model.trims.some((trim) => trim.manufacturerId === id),
  );
  const evidence = model ? subaruPowertrainEvidence(model, id) : undefined;
  if (
    car?.make !== 'Subaru' ||
    !model ||
    !evidence ||
    link.manufacturerSource !== subaruSpecificationSourceId(model) ||
    link.engineEvidence !== evidence.engine ||
    link.engineLayoutEvidence !== evidence.layout ||
    link.transmissionEvidence !== evidence.transmission ||
    link.drivetrainEvidence !== evidence.drivetrain
  )
    throw new Error(`Review the manufacturer powertrain evidence for ${link.retailId}.`);
}

// NRCan's imperial conversion is mpg = 282.48 / (L/100 km).
// Compare rounding intervals; do not calculate a replacement fuel rating.
export function compatibleSubaruFuelUnits(litres: string, mpg: string) {
  const metric = subaruSpecNumber(litres),
    imperial = subaruSpecNumber(mpg);
  if (metric === null || imperial === null || metric <= 0 || imperial <= 0) return false;
  const halfStep = 0.5 * 10 ** -(mpg.split('.')[1]?.length ?? 0);
  return (
    metric + 0.050001 >= 282.48 / (imperial + halfStep) &&
    metric - 0.050001 <= 282.48 / (imperial - halfStep)
  );
}

export function subaruFuelConflicts(model: SubaruSpecificationsModel, manufacturerId: number) {
  const rows = subaruSpecificationRows(model, manufacturerId);
  return rows.flatMap((row) => {
    if (
      !/^(?:Automatic|Manual) transmission \((?:City|Hwy)\) \(L\/100 km\)$/.test(row.label) ||
      row.status !== null ||
      subaruSpecNumber(row.value) === null
    )
      return [];
    const imperial = rows.find(
      (other) => other.label === row.label.replace('(L/100 km)', '(Imperial MPG)'),
    );
    if (
      !imperial ||
      imperial.status !== null ||
      subaruSpecNumber(imperial.value) === null ||
      compatibleSubaruFuelUnits(row.value, imperial.value)
    )
      return [];
    return [{ label: row.label, metric: row.value, imperial: imperial.value }];
  });
}

export function subaruSpecificationsReviewGaps(snapshot: SubaruSpecificationsSnapshot) {
  return snapshot.models.flatMap((model) =>
    model.trims.flatMap((trim) => {
      const conflicts = subaruFuelConflicts(model, trim.manufacturerId);
      const gaps: {
        model: string;
        year: number;
        manufacturerId: number;
        trim: string;
        sourceUrl: string;
        reason: string;
        conflicts?: typeof conflicts;
      }[] = [];
      if (conflicts.length)
        gaps.push({
          model: model.model,
          year: model.year,
          manufacturerId: trim.manufacturerId,
          trim: trim.name,
          sourceUrl: model.source.url,
          conflicts,
          reason:
            'Published L/100 km and imperial MPG do not agree after rounding. Fuel figures remain unverified; values are not swapped or converted into replacement ratings.',
        });
      const evidence = subaruPowertrainEvidence(model, trim.manufacturerId);
      if (evidence.engine && !evidence.layout)
        gaps.push({
          model: model.model,
          year: model.year,
          manufacturerId: trim.manufacturerId,
          trim: trim.name,
          sourceUrl: model.source.url,
          reason:
            'The exact column does not mark its cylinder-layout row as standard. A rating join is withheld until cylinder evidence is reconciled.',
        });
      return gaps;
    }),
  );
}

export function addSubaruSpecifications(
  base: Catalog,
  snapshot: SubaruSpecificationsSnapshot,
): Catalog {
  const date = snapshot.retrievedAt.slice(0, 10);
  const modelsById = new Map(
    snapshot.models.flatMap((model) =>
      model.trims.map((trim) => [String(trim.manufacturerId), model] as const),
    ),
  );
  const found = new Set<string>();
  const sources: Source[] = snapshot.models.map((model) => ({
    id: subaruSpecificationSourceId(model),
    title: `${model.year} Subaru ${model.model} exact-trim Canadian specifications`,
    publisher: 'Subaru Canada',
    url: model.source.url,
    reviewedAt: date,
    publishedAt: null,
    locator:
      'Rendered specification table: factory CarID/model-code columns, selected standard powertrain rows and explicitly unit-labelled measurements. Optional/unavailable features are not treated as standard. Up-to range retains its qualifier; energy consumption is not inferred from range or battery size.',
  }));
  const cars = base.cars.map((car) => {
    const id = car.manufacturerConfiguration?.id;
    const model = car.make === 'Subaru' && id ? modelsById.get(id) : undefined;
    if (!model || !id) return car;
    const trim = model.trims.find((trim) => String(trim.manufacturerId) === id)!;
    if (
      car.year !== model.year ||
      car.model !== model.model ||
      car.manufacturerConfiguration?.code !== trim.modelCode ||
      found.has(id)
    )
      throw new Error(`Review the Subaru specification identity for ${car.id}.`);
    found.add(id);
    const rows = subaruSpecificationRows(model, trim.manufacturerId),
      evidence = subaruPowertrainEvidence(model, trim.manufacturerId);
    const source = subaruSpecificationSourceId(model),
      facts = { ...car.facts };
    function set(
      metric: Metric,
      value: number | null,
      label: string,
      raw: string,
      note = '',
      qualifier?: 'up-to',
    ) {
      const definition = metricDefinitions[metric];
      if (value === null || value < definition.min || value > definition.max) return;
      const previous = facts[metric];
      if (previous.value !== null) {
        if (previous.value !== value || previous.qualifier !== qualifier)
          throw new Error(`Review the changed Subaru specification for ${car.id}: ${metric}.`);
        return;
      }
      facts[metric] = {
        value,
        source,
        sourceUrl: model!.source.url,
        note: `${model!.year} ${model!.model}, ${trim.name}, ${trim.modelCode} (CarID ${id}). ${label}: ${raw}. ${note}`.trim(),
        ...(qualifier ? { qualifier } : {}),
      };
    }
    function measurement(metric: Metric, pattern: RegExp, note = '', qualifier?: 'up-to') {
      const selected = rows.filter(
        (row) =>
          row.status === null && pattern.test(row.label) && subaruSpecNumber(row.value) !== null,
      );
      if (selected.length !== 1) return;
      const row = selected[0]!;
      set(metric, subaruSpecNumber(row.value), row.label, row.value, note, qualifier);
    }
    for (const [metric, pattern] of [
      ['lengthMm', /^Length \(mm\)$/],
      ['heightMm', /^Height \(mm\)$/],
      ['widthMm', /^Width \(mm\): Body$/],
      ['frontHeadroomMm', /^Headroom \(mm\): Front$/],
      ['rearHeadroomMm', /^Headroom \(mm\): Rear$/],
      ['frontLegroomMm', /^Legroom \(mm\): Front$/],
      ['rearLegroomMm', /^Legroom \(mm\): Rear$/],
      ['cargoSeatsUpL', /^Cargo volume \(L\): Seats up$/],
      ['cargoSeatsDownL', /^Cargo volume \(L\): Seats folded$/],
    ] as const)
      measurement(
        metric,
        pattern,
        metric === 'widthMm'
          ? 'Body width, excluding mirrors.'
          : metric.startsWith('cargo')
            ? 'Published seating arrangement; measurement standards can differ between manufacturers.'
            : metric.startsWith('rear')
              ? 'Rear means the second seating row.'
              : '',
      );
    const powers = rows.filter(
      (row) =>
        row.status === 'S' &&
        /^(?:Output \(max\): \d+(?:\.\d+)? hp\b|Horsepower \(peak\) \(hp\): \d+(?:\.\d+)?$)/.test(
          row.label,
        ),
    );
    const powerValues = [
      ...new Set(
        powers.map((row) =>
          Number(
            row.label.match(/(?:Output \(max\): |Horsepower \(peak\) \(hp\): )(\d+(?:\.\d+)?)/)![1],
          ),
        ),
      ),
    ];
    if (powerValues.length === 1) {
      const row = powers[0]!;
      set(
        'horsepower',
        powerValues[0]!,
        row.label,
        'Standard',
        'Manufacturer maximum/peak output as stated; separate motor figures are not added.',
      );
    } else if (powerValues.length > 1) {
      if (facts.horsepower.value !== null)
        throw new Error(`Review the Subaru power conflict for ${car.id}.`);
      facts.horsepower = {
        value: null,
        source,
        sourceUrl: model.source.url,
        note: 'Source conflict: multiple different maximum/peak horsepower figures are marked standard for this exact trim. Power remains unverified pending reconciliation.',
      };
    } else if (powers.length === 0 && evidence.engine) {
      const power = evidence.engine.match(/^Engine: (\d+)-hp,/);
      if (power)
        set(
          'horsepower',
          Number(power[1]),
          evidence.engine,
          'Standard',
          'Manufacturer stated engine/system output; no engine and motor sum is calculated.',
        );
    }
    measurement(
      'electricRangeKm',
      /^All-electric range \(AER\): Up to \(km\) in ideal conditions\*\*$/,
      'Manufacturer up-to range in ideal conditions; no NRCan test standard is stated in this row. Actual range varies.',
      'up-to',
    );
    const conflicts = subaruFuelConflicts(model, trim.manufacturerId);
    if (conflicts.length) {
      for (const metric of ['fuelCityL100km', 'fuelHighwayL100km'] as const) {
        if (facts[metric].value !== null)
          throw new Error(`Review the Subaru fuel-unit conflict for ${car.id}.`);
        facts[metric] = {
          value: null,
          source,
          sourceUrl: model.source.url,
          note: `Source conflict for ${trim.name} (CarID ${id}): labelled metric and imperial MPG values disagree. City/highway values remain unverified pending reconciliation; ${conflicts.map((row) => `${row.label}: ${row.metric}, imperial MPG: ${row.imperial}`).join('; ')}.`,
        };
      }
    } else if (car.fuel !== 'Electric') {
      measurement(
        'fuelCityL100km',
        /^(?:Automatic|Manual) transmission \(City\) \(L\/100 km\)$/,
        'Exact transmission column. Actual fuel consumption varies.',
      );
      measurement(
        'fuelHighwayL100km',
        /^(?:Automatic|Manual) transmission \(Hwy\) \(L\/100 km\)$/,
        'Exact transmission column. Actual fuel consumption varies.',
      );
    }
    if (facts.fuelCombinedL100km.value === null && car.fuel !== 'Electric')
      facts.fuelCombinedL100km = {
        value: null,
        source,
        sourceUrl: model.source.url,
        note: 'Exact-trim combined consumption is unverified. The captured manufacturer table publishes city/highway figures only.',
      };
    if (car.fuel === 'Electric' && facts.electricCombinedKwh100km.value === null)
      facts.electricCombinedKwh100km = {
        value: null,
        source,
        sourceUrl: model.source.url,
        note: 'The captured manufacturer table publishes range and peak output but no kWh/100 km consumption. Energy cost remains unavailable until consumption is verified.',
      };
    if (car.fuel === 'Electric')
      for (const metric of ['fuelCityL100km', 'fuelHighwayL100km', 'fuelCombinedL100km'] as const)
        facts[metric] = {
          value: null,
          source,
          sourceUrl: model.source.url,
          note: 'Not applicable to battery-electric propulsion.',
        };
    const drive = evidence.drivetrain?.match(/\((AWD|FWD|RWD|4WD)\)/)?.[1] as
      Car['drivetrain'] | undefined;
    if (drive && car.drivetrain !== 'Not verified' && car.drivetrain !== drive)
      throw new Error(`Review the changed Subaru drivetrain for ${car.id}.`);
    return {
      ...car,
      drivetrain: drive ?? car.drivetrain,
      sourceIds: [...new Set([...car.sourceIds, source])],
      facts,
    };
  });
  if (found.size !== modelsById.size)
    throw new Error('A Subaru specification trim has no retail configuration.');
  return validateCatalog({
    ...base,
    reviewedAt: date > base.reviewedAt ? date : base.reviewedAt,
    sources: [...base.sources, ...sources],
    cars,
  });
}
