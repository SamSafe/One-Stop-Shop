import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = await realpath(fileURLToPath(new URL('../dist', import.meta.url)));
// Refuse to advertise readiness for an absent or incomplete build.
if (!(await stat(path.join(root, 'index.html'))).isFile()) {
  throw new Error('Build index.html is missing. Run npm run build before starting.');
}
const port = Number(process.env.PORT ?? 8080);
const host = process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be an integer from 1 to 65535.');
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
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : '{"status":"ok"}');
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
    const candidate = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
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
      // Generated assets are small and immutable; gzip is streamed, never buffered.
      const acceptsGzip =
        /(?:^|,)\s*gzip\s*(?:;\s*q=(?!0(?:\.0*)?(?:\s*,|\s*$))[0-9.]+)?\s*(?:,|$)/i.test(
          request.headers['accept-encoding'] ?? '',
        );
      const compress =
        acceptsGzip &&
        info.size > 1024 &&
        ['.js', '.css', '.html', '.svg', '.json'].includes(extension);
      if (compress) response.setHeader('Content-Encoding', 'gzip');
      else response.setHeader('Content-Length', info.size);
      if (request.method === 'HEAD') {
        response.writeHead(200);
        response.end();
        return;
      }
      const file = createReadStream(filename);
      if (compress) await pipeline(file, createGzip(), response);
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
server.listen(port, host, () => console.log(`OSS production server: http://${host}:${port}`));
const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
