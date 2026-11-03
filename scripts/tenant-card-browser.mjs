import { expect } from '@playwright/test';
// Existing editing journeys explicitly open cards, as an operator now does.
export async function expandTenantCards(page) {
  await expect(
    page.getByRole('button', {
      name: /^(Expand|Collapse) Organization name$/,
    }),
  ).toBeVisible({ timeout: 15000 });
  const collapsed = page.locator(
    '[data-disclosure-toggle][aria-expanded="false"]:visible',
  );
  while (await collapsed.count()) await collapsed.first().click();
}
