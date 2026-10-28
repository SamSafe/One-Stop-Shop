import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const comparison =
  '/?compare=honda-cr-v-2026-lx-fwd,honda-cr-v-2026-sport-hybrid-awd,subaru-forester-2026-touring-awd,subaru-ca-1606';

test('vehicle headings follow a partially visible table during dialog scrolling and release before the energy inputs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(comparison);
  const dialog = page.getByRole('dialog');
  const region = page.getByRole('region', { name: 'Car specifications comparison', exact: true });
  for (const [width, height] of [
    [320, 700],
    [390, 844],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await region.scrollIntoViewIfNeeded();
    await region.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.scrollLeft = element.scrollWidth;
    });
    await dialog.evaluate((element) => {
      const table = element.querySelector('.table-scroll')! as HTMLElement;
      const bar = element.querySelector('.dialog-header')!.getBoundingClientRect();
      const box = table.getBoundingClientRect();
      element.scrollTop +=
        box.top + table.clientTop - bar.bottom + Math.min(140, table.clientHeight / 3);
    });
    await expect
      .poll(() =>
        region.evaluate((element) => {
          const bar = element
            .closest('dialog')!
            .querySelector('.dialog-header')!
            .getBoundingClientRect();
          const heading = element.querySelector('thead th:last-child')!.getBoundingClientRect();
          const box = element.getBoundingClientRect();
          return (
            box.top < bar.bottom - 80 &&
            Math.abs(heading.top - bar.bottom) < 2 &&
            heading.bottom < box.bottom
          );
        }),
      )
      .toBe(true);
    await expect(region.locator('thead th').last()).toContainText('Uncharted');
    await dialog.evaluate((element) => {
      const table = element.querySelector('.table-scroll')! as HTMLElement;
      const heading = table.querySelector('thead th')!.getBoundingClientRect();
      const last = table.querySelector('tbody tr:last-child')!.getBoundingClientRect();
      const bar = element.querySelector('.dialog-header')!.getBoundingClientRect();
      const remaining = heading.height + last.height - 15;
      element.scrollTop += table.getBoundingClientRect().bottom - bar.bottom - remaining;
    });
    await expect
      .poll(() =>
        region
          .locator('tbody tr')
          .last()
          .getByRole('cell')
          .last()
          .evaluate((element) => {
            const r = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
            );
          }),
      )
      .toBe(true);
    const annual = dialog.getByLabel('Annual kilometres', { exact: true });
    await annual.scrollIntoViewIfNeeded();
    expect(
      await annual.evaluate((element) => {
        const r = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(errors).toEqual([]);
});

test('keyboard navigation from energy inputs keeps source links and vehicle context unobstructed', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(comparison);
  const dialog = page.getByRole('dialog');
  const annual = dialog.getByLabel('Annual kilometres', { exact: true });
  await annual.focus();
  await page.keyboard.press('Shift+Tab');
  const prices = dialog.getByRole('row', { name: /^Base MSRP/ }).getByRole('link');
  await prices.first().focus();
  for (let index = 0; index < 4; index++) {
    if (index) await page.keyboard.press('Tab');
    const link = prices.nth(index);
    await expect(link).toBeFocused();
    await expect
      .poll(() =>
        link.evaluate((element) => {
          const r = element.getBoundingClientRect();
          const table = element.closest('.table-scroll')!;
          const heading = table
            .querySelectorAll('thead th')
            [element.closest('td')!.cellIndex]!.getBoundingClientRect();
          return (
            element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) &&
            heading.top >=
              element.closest('dialog')!.querySelector('.dialog-header')!.getBoundingClientRect()
                .bottom -
                1
          );
        }),
      )
      .toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('vehicle headings and specification labels remain visible through two-dimensional scrolling and resizing', async ({
  page,
  browserName,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(comparison);
  const region = page.getByRole('region', { name: 'Car specifications comparison', exact: true });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [820, 900],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect
      .poll(() =>
        region.evaluate(
          (element) =>
            Number.parseFloat(element.style.getPropertyValue('--comparison-viewport-width')) ===
            element.clientWidth,
        ),
      )
      .toBe(true);
    await region.scrollIntoViewIfNeeded();
    await region.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.scrollLeft = element.scrollWidth;
    });
    await expect
      .poll(() =>
        region.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const heading = element.querySelector('thead th:last-child')!.getBoundingClientRect();
          const label = element.querySelector('tbody tr:last-child th')!.getBoundingClientRect();
          const left = box.left + element.clientLeft;
          const right = left + element.clientWidth;
          return (
            element.scrollTop > 0 &&
            Math.abs(heading.top - (box.top + element.clientTop)) < 2 &&
            Math.abs(label.left - left) < 2 &&
            heading.left >= label.right - 1 &&
            heading.right <= right + 1
          );
        }),
      )
      .toBe(true);
    await expect(region.locator('thead th').last()).toContainText('Uncharted');
    await expect(region.locator('tbody tr').last().getByRole('rowheader')).toContainText(
      'Estimated annual energy',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 320) {
      await region.focus();
      const before = await region.evaluate((element) => ({
        top: element.scrollTop,
        left: element.scrollLeft,
      }));
      await page.keyboard.press('ArrowUp');
      await expect
        .poll(() => region.evaluate((element) => element.scrollTop))
        .toBeLessThan(before.top);
      await page.keyboard.press('ArrowLeft');
      await expect
        .poll(() => region.evaluate((element) => element.scrollLeft))
        .toBeLessThan(before.left);
      if (browserName === 'chromium' && testInfo.project.use.isMobile) {
        await region.evaluate((element) => {
          element.scrollTo({
            top: Math.floor((element.scrollHeight - element.clientHeight) / 2),
            left: element.scrollWidth,
            behavior: 'instant',
          });
        });
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const position = await region.evaluate((element) => {
          const box = element.getBoundingClientRect();
          const header = element.querySelector('thead th')!.getBoundingClientRect();
          const label = element.querySelector('thead th')!.getBoundingClientRect();
          const x = label.right + (box.right - label.right) / 2;
          const y = header.bottom + 45;
          const target = document.elementFromPoint(x, y);
          return {
            x,
            y,
            targetsCell: !!target?.closest('td') && element.contains(target),
            top: element.scrollTop,
            left: element.scrollLeft,
          };
        });
        expect(position.targetsCell).toBe(true);
        const session = await page.context().newCDPSession(page);
        const swipe = async (xDistance: number, yDistance: number) => {
          await session.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: position.x, y: position.y }],
          });
          for (let step = 1; step <= 6; step++) {
            await session.send('Input.dispatchTouchEvent', {
              type: 'touchMove',
              touchPoints: [
                { x: position.x + (xDistance * step) / 6, y: position.y + (yDistance * step) / 6 },
              ],
            });
            await page.evaluate(() => new Promise(requestAnimationFrame));
          }
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        };
        try {
          await swipe(0, 100);
          await expect
            .poll(() => region.evaluate((element) => element.scrollTop))
            .toBeLessThan(position.top);
          await swipe(60, 0);
          await expect
            .poll(() => region.evaluate((element) => element.scrollLeft))
            .toBeLessThan(position.left);
        } finally {
          await session.detach();
        }
      }
    }
  }
  expect(errors).toEqual([]);
});

test('keyboard source navigation reveals each full vehicle column without covering focus and pointer source links still open', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(comparison);
  const dialog = page.getByRole('dialog');
  const region = page.getByRole('region', { name: 'Car specifications comparison', exact: true });
  await region.scrollIntoViewIfNeeded();
  await region.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.scrollLeft = element.scrollWidth;
  });
  await region.focus();
  await page.keyboard.press('Tab');
  const prices = dialog.getByRole('row', { name: /^Base MSRP/ }).getByRole('link');
  await prices.first().focus();
  for (let index = 0; index < 4; index++) {
    if (index) await page.keyboard.press('Tab');
    const link = prices.nth(index);
    await expect(link).toBeFocused();
    await expect
      .poll(() =>
        link.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const scroll = element.closest('.table-scroll')! as HTMLElement;
          const box = scroll.getBoundingClientRect();
          const label = scroll.querySelector('thead th')!.getBoundingClientRect();
          const column = element.closest('td')!.getBoundingClientRect();
          return (
            element.contains(
              document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
            ) &&
            column.left >= label.right - 1 &&
            column.right <= box.left + scroll.clientLeft + scroll.clientWidth + 1
          );
        }),
      )
      .toBe(true);
  }
  const close = dialog.getByRole('button', { name: 'Close comparison', exact: true });
  expect(
    await close.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return element.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
      );
    }),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await context.route('https://**/*', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Source link check</title>' }),
  );
  const href = await prices.first().getAttribute('href');
  const [source] = await Promise.all([page.waitForEvent('popup'), prices.first().click()]);
  await expect(source).toHaveURL(href!);
  expect(await source.evaluate(() => window.opener)).toBeNull();
  await source.close();
});

test('removing comparison columns restores focus to a remaining vehicle or the empty-state return control', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(comparison);
  const dialog = page.getByRole('dialog');
  const region = page.getByRole('region', { name: 'Car specifications comparison', exact: true });
  await region.scrollIntoViewIfNeeded();
  await region.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.scrollLeft = element.scrollWidth;
  });
  for (const remaining of [3, 2]) {
    await region.locator('thead button').last().click();
    await expect(region.locator('thead button')).toHaveCount(remaining);
    await expect(region.locator('thead button').last()).toBeFocused();
  }
  await region.locator('thead button').last().click();
  await expect(region).toHaveCount(0);
  const back = dialog.getByRole('button', { name: 'Back to cars', exact: true });
  await expect(back).toBeFocused();
  expect(new URL(page.url()).searchParams.get('compare')).toBe('honda-cr-v-2026-lx-fwd');
  await back.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Compare 1 car', exact: true })).toBeDisabled();
});
