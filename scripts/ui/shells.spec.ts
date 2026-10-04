import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const [app, port, pending] of [
  ['Command center', 3200, ['Incidents', 'Dispatch', 'Tenant administration']],
  ['Platform console', 3201, ['Asterisk', 'Tenants']],
] as const) {
  test(`${app}: home, skip link, navigation and direct refresh`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://localhost:${port}`);
    await page.keyboard.press('Tab');
    await expect(
      page.getByRole('link', { name: 'Skip to content' }),
    ).toBeFocused();
    await expect(page.getByRole('link', { name: 'Skip to content' })).toHaveCSS(
      'outline-style',
      'solid',
    );
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    const nav = page.getByRole('navigation', { name: `${app} navigation` });
    await expect(
      nav.getByRole('link', { name: 'Home', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    for (const label of pending) {
      await expect(nav.getByText(label, { exact: true })).toBeVisible();
      await expect(
        nav.getByRole('link', { name: label, exact: true }),
      ).toHaveCount(0);
    }
    await nav.getByRole('link', { name: 'UI preview', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'UI preview', exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'UI preview', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'UI preview', exact: true }),
    ).toBeVisible();
    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: app, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', { name: app, exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test(`${app}: compact navigation, viewport review and zoom`, async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}`);
    for (const [width, height, label] of [
      [1440, 900, 'desktop'],
      [768, 1024, 'tablet'],
      [390, 844, 'narrow'],
      [320, 900, 'reflow'],
    ] as const) {
      await page.setViewportSize({ width, height });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole('heading', { name: app, exact: true }),
      ).toBeVisible();
      await page.screenshot({
        path: `.local/ui-review/${port}-home-${label}.png`,
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open navigation' }).focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('dialog', { name: 'Navigation', exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole('dialog')
      .getByRole('link', { name: 'UI preview', exact: true })
      .click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'UI preview', exact: true }),
    ).toBeVisible();
    await page
      .getByLabel('Sample notes')
      .fill(
        'A long sample note that should wrap at a narrow viewport without hiding primary actions.',
      );
    await page
      .getByRole('button', { name: 'Submit sample', exact: true })
      .click();
    await expect(
      page.getByText('Enter at least three characters.', { exact: false }),
    ).toBeVisible();
    await page.screenshot({
      path: `.local/ui-review/${port}-preview-narrow-error.png`,
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2';
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Submit sample', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `.local/ui-review/${port}-preview-zoom.png`,
      fullPage: true,
    });
  });
}
