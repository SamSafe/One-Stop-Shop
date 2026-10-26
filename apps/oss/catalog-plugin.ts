import type { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RuntimeCatalog } from '../../packages/car-catalog/src/runtime.ts';

export async function validatedCatalogPlugin(command: 'build' | 'serve'): Promise<Plugin> {
  const id = '\0oss-validated-catalog',
    root = fileURLToPath(new URL('../..', import.meta.url)),
    prepare = fileURLToPath(new URL('../../scripts/prepare-runtime-catalog.ts', import.meta.url)),
    catalogDirectory = fileURLToPath(new URL('../../packages/car-catalog/', import.meta.url));
  // A fresh process keeps config loading independent of tsx/JSON resolution and
  // avoids stale manufacturer modules after a development-server restart.
  let generated: { packed: RuntimeCatalog; governmentRatingCount: number };
  const temporary = await mkdtemp(join(tmpdir(), 'oss-runtime-catalog-'));
  try {
    const filename = join(temporary, 'catalog.json');
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', prepare, filename], {
        cwd: root,
        stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('exit', (code, signal) =>
        code === 0
          ? resolve()
          : reject(new Error(`Catalog preparation failed (${signal ?? code}).`)),
      );
    });
    generated = JSON.parse(await readFile(filename, 'utf8')) as typeof generated;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  const payload = JSON.stringify(generated.packed);
  return {
    name: 'vite-plugin-validated-catalog',
    enforce: 'pre',
    resolveId(source) {
      if (source === '@oss/car-catalog') return id;
    },
    load(source) {
      if (source !== id) return;
      const read =
        command === 'build'
          ? (() => {
              const reference = this.emitFile({
                type: 'asset',
                name: 'catalog.json',
                source: payload,
              });
              return `const response = await fetch(import.meta.ROLLDOWN_FILE_URL_${reference});
if (!response.ok) throw new Error('The vehicle catalog could not be loaded.');
const packed = await response.json();`;
            })()
          : `const packed = ${payload};`;
      return `import { decodeRuntimeCatalog } from '@oss/car-catalog/runtime';
export { metricDefinitions } from '@oss/car-catalog/metrics';
export { ratingUrl } from '@oss/car-catalog/rating-url';
${read}
export const catalog = decodeRuntimeCatalog(packed);
export const governmentRatingCount = ${generated.governmentRatingCount};`;
    },
    configureServer(server) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const source = (file: string) =>
        file === prepare ||
        (file.startsWith(catalogDirectory) &&
          /\.(?:ts|json)$/.test(file) &&
          !file.endsWith('.test.ts'));
      const refresh = (file: string) => {
        if (!source(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          void server
            .restart()
            .catch((error: unknown) => server.config.logger.error(String(error)));
        }, 100);
      };
      server.watcher.add([`${catalogDirectory}src`, `${catalogDirectory}data`, prepare]);
      for (const event of ['change', 'add', 'unlink']) server.watcher.on(event, refresh);
      server.httpServer?.once('close', () => {
        clearTimeout(timer);
        for (const event of ['change', 'add', 'unlink']) server.watcher.off(event, refresh);
      });
    },
    generateBundle(_options, bundle) {
      const allowed = new Set(['metrics.ts', 'rating-url.ts', 'runtime.ts', 'maintenance.ts']);
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        for (const module of Object.keys(output.modules)) {
          const marker = '/packages/car-catalog/';
          if (!module.includes(marker)) continue;
          const relative = module.slice(module.indexOf(marker) + marker.length);
          if (!relative.startsWith('src/') || !allowed.has(relative.slice(4)))
            throw new Error(
              `Server-side catalog ingestion entered the browser bundle: ${relative}`,
            );
        }
      }
    },
  };
}
