import { test, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('production headers, health, asset caching and safe errors', async ({ request }) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['cache-control']).toBe('no-cache');
  const body = await home.text();
  const script = body.match(/src="([^"]+\.js)"/)?.[1];
  expect(script).toBeTruthy();
  const asset = await request.get(script!);
  expect(asset.status()).toBe(200);
  expect(asset.headers()['cache-control']).toContain('immutable');
  expect(asset.headers()['content-type']).toContain('javascript');
  const head = await request.head('/');
  expect(head.status()).toBe(200);
  expect((await head.body()).length).toBe(0);
  expect(await (await request.get('/healthz')).json()).toEqual({ status: 'ok' });
  for (const url of ['/missing.js', '/.git/config', '/%2e%2e%2fpackage.json', '/%00', '/%ZZ']) {
    expect([400, 404]).toContain((await request.get(url)).status());
  }
  expect((await request.post('/')).status()).toBe(405);
});

test('production readiness detects missing assets and startup rejects corrupted bytes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'oss-server-test-'));
  const processes: { child: ReturnType<typeof spawn>; exited: Promise<number | null> }[] = [];
  function start() {
    const child = spawn(process.execPath, [path.join(root, 'scripts/serve.mjs')], {
      env: { ...process.env, PORT: '0', HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const exited = new Promise<number | null>((resolve) => child.once('exit', resolve));
    processes.push({ child, exited });
    return { child, exited };
  }
  try {
    await cp(path.resolve('dist'), path.join(root, 'dist'), { recursive: true });
    await mkdir(path.join(root, 'scripts'));
    for (const file of ['serve.mjs', 'release-integrity.mjs'])
      await cp(path.resolve('scripts', file), path.join(root, 'scripts', file));
    const manifest = JSON.parse(
      await readFile(path.join(root, 'dist/build-manifest.json'), 'utf8'),
    );
    const asset = Object.keys(manifest.files).find((name) => name.endsWith('.js'))!;
    const assetPath = path.join(root, 'dist', asset);
    const original = await readFile(assetPath);
    const server = start();
    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Fixture server did not start.')), 10000);
      server.child.once('error', reject);
      server.child.stdout!.on('data', (chunk) => {
        const match = chunk.toString().match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });
      server.exited.then((code) => {
        clearTimeout(timeout);
        reject(new Error(`Fixture server exited: ${code}`));
      });
    });
    expect((await fetch(`${url}/healthz`)).status).toBe(200);
    await rm(assetPath);
    const unhealthy = await fetch(`${url}/healthz`);
    expect(unhealthy.status).toBe(503);
    expect(await unhealthy.json()).toEqual({ status: 'unavailable' });
    server.child.kill('SIGTERM');
    await server.exited;
    const corrupted = Buffer.from(original);
    corrupted[0] = corrupted[0]! ^ 1;
    await writeFile(assetPath, corrupted);
    const broken = start();
    let stderr = '';
    broken.child.stderr!.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    expect(await broken.exited).not.toBe(0);
    expect(stderr).toContain('Build integrity check failed');
  } finally {
    await Promise.all(
      processes.map(async ({ child, exited }) => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
        await exited;
      }),
    );
    await rm(root, { recursive: true, force: true });
  }
});
