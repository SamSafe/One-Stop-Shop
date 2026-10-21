import { mkdir, writeFile } from 'node:fs/promises';
import { catalog, nrcanSnapshot } from '../packages/car-catalog/src/index.ts';
import { catalogCoverage } from '../packages/car-catalog/src/coverage.ts';

const report = catalogCoverage(catalog, nrcanSnapshot);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/catalog-coverage.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--require-complete') && !report.fullMarketCoverageVerified) {
  console.error(
    'Full Canadian market coverage has not been verified. See the remaining work in artifacts/catalog-coverage.json.',
  );
  process.exitCode = 1;
}
