import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { manifestName, verifyBuiltRelease, releaseIsReady } from './release-integrity.mjs';

const releaseRoot = fileURLToPath(new URL('..', import.meta.url));
const release = await verifyBuiltRelease(releaseRoot);
const knownFiles = new Set([...Object.keys(release.files), manifestName]);
// The build writes Brotli and gzip siblings for compressible files. They are
// sent in place of the original when accepted and are never served directly.
const encodings = [
  { name: 'br', suffix: '.br' },
  { name: 'gzip', suffix: '.gz' },
];
const precompressed = new Set(
  [...knownFiles].filter((name) =>
    encodings.some(
      ({ suffix }) => name.endsWith(suffix) && knownFiles.has(name.slice(0, -suffix.length)),
    ),
  ),
);
// True when Accept-Encoding lists the coding without a zero quality value.
const accepts = (header, coding) =>
  new RegExp(
    `(?:^|,)\\s*${coding}\\s*(?:;\\s*q=(?!0(?:\\.0*)?(?:\\s*,|\\s*$))[0-9.]+)?\\s*(?:,|$)`,
    'i',
  ).test(header ?? '');
const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
// Refuse to advertise readiness for an absent or incomplete build.
if (!(await stat(path.join(root, 'index.html'))).isFile()) {
  throw new Error('Build index.html is missing. Run npm run build before starting.');
}
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 0 || port > 65535)
  throw new Error('PORT must be an integer from 0 to 65535.');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.webp': 'image/webp',
};
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'camera=(), microphone=(), geolocation=(), payment=(), clipboard-write=(self)',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000',
};

const server = createServer(
  { requestTimeout: 10000, headersTimeout: 10000, maxHeaderSize: 16384 },
  async (request, response) => {
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
    response.setHeader('Cache-Control', 'no-store');
    const reply = (status, text) => {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : text);
    };
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.setHeader('Allow', 'GET, HEAD');
      reply(405, 'Method not allowed');
      return;
    }
    if (!request.url || request.url.length > 4096) {
      reply(414, 'URL too long');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      reply(400, 'Invalid URL');
      return;
    }
    if (pathname === '/healthz') {
      const ready = await releaseIsReady(releaseRoot, release);
      response.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(
        request.method === 'HEAD'
          ? undefined
          : JSON.stringify({ status: ready ? 'ok' : 'unavailable' }),
      );
      return;
    }
    if (
      pathname.includes('\0') ||
      pathname.includes('\\') ||
      pathname.split('/').some((part) => part.startsWith('.'))
    ) {
      reply(404, 'Not found');
      return;
    }
    const appPage = ['/', '/garage', '/garage/'].includes(pathname);
    const candidate = path.resolve(root, `.${appPage ? '/index.html' : pathname}`);
    const relative = appPage ? 'index.html' : pathname.slice(1);
    if (!knownFiles.has(relative) || precompressed.has(relative)) {
      reply(404, 'Not found');
      return;
    }
    if (!candidate.startsWith(root + path.sep)) {
      reply(404, 'Not found');
      return;
    }
    try {
      const filename = await realpath(candidate);
      if (!filename.startsWith(root + path.sep)) {
        reply(404, 'Not found');
        return;
      }
      const info = await stat(filename);
      if (!info.isFile()) {
        reply(404, 'Not found');
        return;
      }
      const extension = path.extname(filename);
      const cache =
        pathname.startsWith('/assets/') && /-[a-zA-Z0-9_-]{8,}\./.test(filename)
          ? 'public, max-age=31536000, immutable'
          : extension === '.html'
            ? 'no-cache'
            : 'public, max-age=3600';
      response.setHeader('Content-Type', types[extension] ?? 'application/octet-stream');
      response.setHeader('Cache-Control', cache);
      response.setHeader('Vary', 'Accept-Encoding');
      const compressible =
        info.size > 1024 && ['.js', '.css', '.html', '.svg', '.json'].includes(extension);
      const accepted = request.headers['accept-encoding'];
      const prepared = compressible
        ? encodings.find(
            ({ name, suffix }) => accepts(accepted, name) && knownFiles.has(relative + suffix),
          )
        : undefined;
      // Files without a prepared sibling are gzip-streamed, never buffered.
      const streamGzip = compressible && !prepared && accepts(accepted, 'gzip');
      const body = prepared ? `${filename}${prepared.suffix}` : filename;
      if (prepared) {
        response.setHeader('Content-Encoding', prepared.name);
        response.setHeader('Content-Length', (await stat(body)).size);
      } else if (streamGzip) response.setHeader('Content-Encoding', 'gzip');
      else response.setHeader('Content-Length', info.size);
      if (request.method === 'HEAD') {
        response.writeHead(200);
        response.end();
        return;
      }
      const file = createReadStream(body);
      if (streamGzip) await pipeline(file, createGzip(), response);
      else await pipeline(file, response);
    } catch (error) {
      if (!response.headersSent && !response.destroyed) {
        const missing = ['ENOENT', 'ENOTDIR'].includes(error.code);
        if (!missing) console.error('Static response failed.', error.code ?? 'unknown');
        reply(missing ? 404 : 500, missing ? 'Not found' : 'Unable to serve the request');
      } else if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') response.destroy();
    }
  },
);
server.maxRequestsPerSocket = 1000;
server.listen(port, host, () =>
  console.log(`OSS production server: http://${host}:${server.address().port}`),
);
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
