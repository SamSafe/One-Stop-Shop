import { test, expect } from '@playwright/test';

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
