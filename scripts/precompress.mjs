import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';
import { manifestName } from './release-integrity.mjs';

// Writes maximum-effort Brotli and gzip siblings for compressible build output,
// so the server sends prepared bytes instead of compressing each response.
// Both encoders are deterministic, keeping release hashes reproducible.
// Keep the extensions and size threshold in step with scripts/serve.mjs.
const compressibleExtensions = ['.js', '.css', '.html', '.svg', '.json'];
const minimumCompressedSize = 1024;

const brotli = promisify(brotliCompress),
  gzipBytes = promisify(gzip);

export async function precompress(directory) {
  const written = [];
  for (const entry of await readdir(directory, { withFileTypes: true, recursive: true })) {
    const filename = path.join(entry.parentPath, entry.name);
    if (
      !entry.isFile() ||
      entry.name === manifestName ||
      !compressibleExtensions.includes(path.extname(entry.name))
    )
      continue;
    const bytes = await readFile(filename);
    if (bytes.length <= minimumCompressedSize) continue;
    const variants = {
      '.br': await brotli(bytes, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
          [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
        },
      }),
      '.gz': await gzipBytes(bytes, { level: constants.Z_BEST_COMPRESSION }),
    };
    for (const [suffix, compressed] of Object.entries(variants))
      if (compressed.length < bytes.length) {
        await writeFile(filename + suffix, compressed);
        written.push(filename + suffix);
      }
  }
  return written;
}
