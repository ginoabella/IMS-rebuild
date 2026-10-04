import { expect, test } from '@playwright/test';

for (const [app, port] of [
  ['Command center', 3200],
  ['Platform console', 3201],
] as const) {
  test(`${app}: shared theme and local typography`, async ({ page }) => {
    await page.goto(`http://localhost:${port}`);
    await expect(
      page.getByRole('heading', { name: app, exact: true }),
    ).toBeVisible();
    const styles = await page.evaluate(async () => {
      await document.fonts.ready;
      const body = getComputedStyle(document.body);
      const heading = getComputedStyle(document.querySelector('h1')!);
      return {
        background: body.backgroundColor,
        color: body.color,
        font: body.fontFamily,
        heading: heading.fontFamily,
        fonts: Array.from(document.fonts)
          .filter((font) => font.status === 'loaded')
          .map((font) => font.family),
      };
    });
    expect(styles.background).toBe('rgb(9, 17, 27)');
    expect(styles.color).toBe('rgb(232, 240, 247)');
    expect(styles.font).toContain('Inter');
    expect(styles.heading).toContain('Barlow Semi Condensed');
    expect(styles.fonts).toEqual(
      expect.arrayContaining([
        'Inter',
        'Barlow Semi Condensed',
        'JetBrains Mono',
      ]),
    );
    const panel = page.locator('section').first();
    await expect(panel).toHaveCSS('background-color', 'rgb(19, 33, 49)');
    await expect(panel).toHaveCSS('border-radius', '12px');
  });
}
