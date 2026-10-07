import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Shared primitives remain exercised in the public foundation app.
// Protected platform composition is exercised by check:platform-auth over real HTTPS.
for (const port of [3200]) {
  test(`App ${port}: forms preserve values, pending actions and retry`, async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}/ui-preview`);
    await page.getByLabel('Sample name').fill('AB');
    await page.getByLabel('Sample notes').fill('Keep these notes');
    await page
      .getByRole('button', { name: 'Submit sample', exact: true })
      .click();
    await expect(
      page.getByText('Enter at least three characters.', { exact: false }),
    ).toBeVisible();
    await expect(page.getByLabel('Sample name')).toHaveValue('AB');
    await expect(page.getByLabel('Sample notes')).toHaveValue(
      'Keep these notes',
    );
    await page.getByLabel('Sample name').fill('Sample name');
    await page
      .getByRole('button', { name: 'Submit sample', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Processing sample…', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByText('Sample complete', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Retry sample' }).click();
    await expect(
      page.getByText('Sample retry complete', { exact: true }),
    ).toBeVisible();
  });

  test(`App ${port}: overlay, tab and menu keyboard behavior`, async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}/ui-preview`);
    for (const trigger of ['Open confirmation', 'Open details']) {
      const button = page.getByRole('button', { name: trigger });
      await button.focus();
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole('button', { name: 'Close', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(
        dialog.getByRole('button', { name: 'Close', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(
        dialog.getByRole('button', { name: 'Close', exact: true }),
      ).toBeFocused();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
      await expect(button).toBeFocused();
    }
    await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(
      page.getByRole('tab', { name: 'Details', exact: true }),
    ).toHaveAttribute('aria-selected', 'true');
    await page
      .getByRole('button', { name: 'More actions for SAMPLE-001' })
      .focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('menuitem', { name: 'Copy sample reference' }),
    ).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(
      page.getByText('Sample reference selected: SAMPLE-001.'),
    ).toBeVisible();
  });

  test(`App ${port}: accessibility, responsive reflow and reduced motion`, async ({
    page,
  }) => {
    await page.goto(`http://localhost:${port}/ui-preview`);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    for (const [width, height] of [
      [1440, 900],
      [768, 1024],
      [390, 844],
      [320, 900],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole('button', { name: 'Submit sample', exact: true }),
      ).toBeVisible();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(
      page.getByRole('button', { name: 'Submit sample', exact: true }),
    ).toHaveCSS('transition-duration', '0s');
  });
}
