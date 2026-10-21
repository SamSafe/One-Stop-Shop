import { catalog } from '../packages/car-catalog/src/index';

const now = new Date();
for (const source of catalog.sources) {
  const age = (now.getTime() - Date.parse(source.reviewedAt)) / 86400000;
  if (age > 180)
    throw new Error(`${source.id}: review is older than 180 days; reverify the publication.`);
}
console.log(
  `Catalog valid: ${catalog.cars.length} records (${catalog.cars.filter((car) => car.recordKind === 'retail-trim').length} retail configurations), ${catalog.sources.length} official sources; latest rating review ${catalog.reviewedAt}. Full retail availability coverage is still in progress.`,
);
