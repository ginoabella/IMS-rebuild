// Real ordinary expiry/revocation SIP: explicit short grants, one intent per case.
import assert from 'node:assert/strict';
import { expect as baseExpect } from '@playwright/test';
import { setTimeout as delay } from 'node:timers/promises';
const expect = baseExpect.configure({ timeout: 30000 });
export async function checkOrdinaryConditions({
  page,
  db,
  p,
  tenants,
  approvedCases,
  get,
  button,
  openTenant,
  journal,
  save,
}) {
  const query = async (sql, args) =>
    (await db.read((s) => s.query(sql, args))).rows;
  for (const tenant of tenants) {
    await openTenant(tenant);
    const path = `/platform/tenants/${tenant.id}/telephony/${p.nodeId}`;
    let view = await get(path);
    const candidate = view.cases.find(
      (c) =>
        c.kind === 'expiry' &&
        c.available === true &&
        approvedCases.some((a) => a.id === c.id),
    );
    if (!candidate) continue;
    assert.equal(view.grants.filter((g) => g.active).length, 0);
    for (const scenario of ['expiry', 'revocation']) {
      await page
        .getByRole('checkbox', {
          name: new RegExp(`^Permit case ${candidate.id}:`),
        })
        .check();
      await page.getByLabel(/^Verification lifetime/).selectOption('10');
      await button('Grant verification').click();
      await expect(
        page.getByText('Intent recorded. Reload for the current outcome.', {
          exact: true,
        }),
      ).toBeVisible();
      view = await get(path);
      const grant = view.grants.find((g) => g.active);
      assert.ok(grant);
      assert.ok(
        Date.parse(grant.expiresAt) - Date.parse(grant.createdAt) <= 10000,
      );
      const membership = await query(
        'SELECT case_id FROM public.tenant_verification_grant_cases WHERE grant_id=$1',
        [grant.id],
      );
      assert.deepEqual(
        membership.map((m) => m.case_id),
        [candidate.id],
      );
      const before = new Set(view.tests.map((t) => t.id));
      await page.getByLabel(/^Draft verification grant/).selectOption(grant.id);
      await page.getByLabel(/^Controlled call case/).selectOption(candidate.id);
      let result;
      try {
        await button('Run controlled call test').click();
        if (scenario === 'revocation') {
          await expect
            .poll(
              async () =>
                (
                  await query(
                    'SELECT p.state FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_progress p ON p.intent_id=i.id WHERE i.grant_id=$1 ORDER BY i.created_at DESC LIMIT 1',
                    [grant.id],
                  )
                )[0]?.state,
            )
            .toBe('dispatching');
          await expect(button('Revoke selected grant')).toBeEnabled();
          await button('Revoke selected grant').click();
        }
        for (const until = Date.now() + 45000; Date.now() < until;) {
          view = await get(path);
          result = view.tests.find(
            (t) => t.caseId === candidate.id && !before.has(t.id),
          );
          if (result?.outcome || result?.state === 'unknown') break;
          await delay(1000);
        }
        journal.conditions ??= [];
        journal.conditions.push({
          scenario,
          grant,
          caseId: candidate.id,
          result: result ?? null,
        });
        save();
        assert.equal(result?.outcome, 'denied');
        assert.equal(result.destinationId, null);
        assert.equal(result.current, false);
        assert.equal(
          view.cases.find((c) => c.id === candidate.id)?.available,
          true,
        );
        assert.equal(view.artifactId, grant.artifactId);
        assert.ok(!view.readiness.blockers.includes('runtime_not_current'));
        assert.equal(view.readiness.state, 'incomplete');
        assert.equal(view.grants.find((g) => g.id === grant.id)?.active, false);
        if (scenario === 'expiry')
          assert.ok(
            Date.parse(result.finishedAt) >= Date.parse(grant.expiresAt),
          );
        else
          assert.ok(
            Date.parse(result.finishedAt) < Date.parse(grant.expiresAt),
            'Revocation must deny before natural expiry',
          );
        assert.equal(
          (
            await query(
              'SELECT id FROM public.tenant_route_test_intents WHERE grant_id=$1',
              [grant.id],
            )
          ).length,
          1,
        );
      } finally {
        await button('Reload evidence').click();
        await page
          .getByLabel(/^Draft verification grant/)
          .selectOption(grant.id);
        await expect(button('Revoke selected grant')).toBeEnabled();
        await button('Revoke selected grant').click();
        await expect
          .poll(
            async () =>
              (
                await query(
                  'SELECT grant_id FROM public.tenant_verification_revocations WHERE grant_id=$1',
                  [grant.id],
                )
              ).length,
          )
          .toBe(1);
        if (await button('Clear grant selection').isEnabled())
          await button('Clear grant selection').click();
      }
    }
    return;
  }
  throw new Error('No approved current conditional grant case');
}
