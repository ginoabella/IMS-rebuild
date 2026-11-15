// Canonical ordinary HTTPS controls only. Dedicated 7701 transfer A -> B.
import assert from 'node:assert/strict';
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 30000 });
export async function setOrdinaryExtensionStatus(
  { page, p, origin, query, button },
  extensionId,
  number,
  status,
) {
  const [before] = await query(
    'SELECT id,number,version,administrative_status,credential_generation_id FROM public.extensions WHERE id=$1 AND node_id=$2',
    [extensionId, p.nodeId],
  );
  assert.equal(before?.number, number);
  assert.notEqual(before.administrative_status, status);
  await page.goto(`${origin}/pbx-nodes/${p.nodeId}/inventory`);
  await expect(
    page.getByRole('region', {
      name: 'Canonical extension inventory',
      exact: true,
    }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
  for (let pages = 0; pages < 16; pages++) {
    const summary = page.locator(`summary[aria-label="Extension ${number}"]`);
    if (await summary.count()) {
      await summary.click();
      break;
    }
    const next = button('Next inventory page');
    await expect(next).toBeEnabled();
    await next.click();
    await page.waitForLoadState('networkidle');
  }
  await button(`Inspect extension ${number}`).click();
  const detail = page.getByRole('region', {
    name: `Extension ${number} details`,
    exact: true,
  });
  await expect(detail).toBeVisible();
  const change = button(
    status === 'disabled'
      ? 'Disable desired extension'
      : 'Re-enable desired extension',
  );
  await expect(change).toBeEnabled();
  await change.click();
  await expect
    .poll(
      async () =>
        (
          await query(
            'SELECT administrative_status FROM public.extensions WHERE id=$1',
            [extensionId],
          )
        )[0]?.administrative_status,
    )
    .toBe(status);
  const [after] = await query(
    'SELECT version,credential_generation_id FROM public.extensions WHERE id=$1',
    [extensionId],
  );
  assert.equal(after.version, before.version + 1);
  assert.equal(after.credential_generation_id, before.credential_generation_id);
}
export async function checkOrdinaryTransfer(s) {
  const {
    page,
    p,
    origin,
    query,
    button,
    tenants,
    resources,
    journal,
    save,
    apply,
    openTenant,
    bind,
    readStage,
    stage,
  } = s;
  const returning = stage.startsWith('return-');
  const phase = (
    returning ? stage.replace('return-', 'transfer-') : stage
  ).replace(/-(resume|rebind)$/, '');
  if (stage.endsWith('-resume')) {
    const prior = readStage(returning ? 'return-route' : 'transfer-route');
    assert.equal(prior.state, 'incomplete_requires_exact_review');
    assert.equal(
      prior.requests.length,
      0,
      'Inspect/recover committed writes rather than repeat the route stage',
    );
    assert.equal(prior.startArtifact, journal.startArtifact);
  }
  if (stage === 'transfer-route-rebind') {
    const prior = readStage('transfer-route-resume');
    assert.equal(prior.state, 'incomplete_requires_exact_review');
    assert.equal(prior.startArtifact, journal.startArtifact);
    assert.equal(prior.requests.length, 1);
    const request = prior.requests[0];
    assert.equal(request.method, 'PATCH');
    assert.equal(
      request.path,
      `/platform/pbx-nodes/${p.nodeId}/routing/inbound/${resources.routeIds[2]}`,
    );
    assert.ok(
      prior.failedResponses.some(
        (r) => r.path === request.path && r.status === 409,
      ),
    );
    const [unchanged] = await query(
      'SELECT version,destination_extension_id FROM public.inbound_rules WHERE id=$1 AND node_id=$2 AND removed_at IS NULL',
      [resources.routeIds[2], p.nodeId],
    );
    assert.equal(unchanged.version, request.body.expectedVersion);
    assert.equal(unchanged.destination_extension_id, resources.extensionIds[1]);
  }
  const oldTenant = tenants[returning ? 1 : 0],
    newTenant = tenants[returning ? 0 : 1];
  const previous = (suffix) =>
    readStage(`${returning ? 'return' : 'transfer'}-${suffix}`);
  const extensionId = resources.extensionIds[0],
    number = p.tenants[0].extensionNumber;
  const [claim] = await query(
    "SELECT id,tenant_id,version,state FROM public.tenant_inventory_claims WHERE node_id=$1 AND extension_id=$2 AND state<>'released'",
    [p.nodeId, extensionId],
  );
  const [lifecycle] = await query(
    'SELECT action FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
    [p.requestId],
  );
  assert.equal(lifecycle?.action, 'stop');
  const active = await query(
    'SELECT 1 FROM public.tenant_verification_grants g WHERE node_id=$1 AND expires_at>statement_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations v WHERE v.grant_id=g.id)',
    [p.nodeId],
  );
  assert.equal(active.length, 0);
  async function allocation(tenant) {
    await page.goto(`${origin}/tenants/${tenant.id}`);
    await button('Expand Extension allocation').click();
    await page.getByLabel(/^PBX node/).selectOption(p.nodeId);
    await expect(button('Reload saved ownership')).toBeEnabled();
    await page.waitForLoadState('networkidle');
  }
  async function retargetB(destinationId) {
    await openTenant(tenants[1]);
    const bindings = await query(
      "SELECT id FROM public.tenant_route_authorizations WHERE tenant_id=$1 AND node_id=$2 AND kind='inbound' AND resource_id=$3 AND state='active'",
      [tenants[1].id, p.nodeId, resources.routeIds[2]],
    );
    assert.ok(bindings.length <= 1);
    for (const binding of bindings) {
      await page
        .locator(`#route-binding-${binding.id}`)
        .getByRole('button', { name: /^Revoke / })
        .click();
      await expect
        .poll(
          async () =>
            (
              await query(
                'SELECT state FROM public.tenant_route_authorizations WHERE id=$1',
                [binding.id],
              )
            )[0]?.state,
        )
        .toBe('revoked');
    }
    await page.goto(
      `${origin}/pbx-nodes/${p.nodeId}/routing?kind=inbound&resource=${resources.routeIds[2]}`,
    );
    await button('Edit inbound rule').click();
    await page.waitForLoadState('networkidle');
    await page.getByLabel(/^Inbound destination/).selectOption('extension');
    await page.waitForLoadState('networkidle');
    const destination = page.getByLabel(/^Destination resource/);
    for (let pages = 0; pages < 16; pages++) {
      if (await destination.locator(`option[value="${destinationId}"]`).count())
        break;
      await button('More extensions').click();
      await page.waitForLoadState('networkidle');
    }
    await destination.selectOption(destinationId);
    await button('Save inbound rule').click();
    await expect
      .poll(
        async () =>
          (
            await query(
              'SELECT destination_extension_id FROM public.inbound_rules WHERE id=$1',
              [resources.routeIds[2]],
            )
          )[0]?.destination_extension_id,
      )
      .toBe(destinationId);
    await openTenant(tenants[1]);
    await bind('inbound', 'inbound', resources.routeIds[2]);
  }
  if (phase === 'transfer-remove') {
    assert.equal(claim?.tenant_id, oldTenant.id);
    await allocation(oldTenant);
    await expect(button(`Release extension ${number}`)).toBeDisabled();
    journal.releaseBlockedWhileInstalled = true;
    journal.supersededArtifact = journal.startArtifact;
    journal.removedExtensionId = extensionId;
    save();
    if (returning) await retargetB(resources.extensionIds[1]);
    await setOrdinaryExtensionStatus(s, extensionId, number, 'disabled');
    await apply();
  } else if (phase === 'transfer-retire') {
    const removed = previous('remove');
    assert.equal(removed.state, 'stage_passed');
    assert.equal(removed.appliedArtifact, journal.startArtifact);
    assert.equal(removed.removedExtensionId, extensionId);
    const artifacts = await query(
      "SELECT DISTINCT a.id FROM public.pbx_live_artifacts a JOIN public.pbx_live_pins pin ON pin.revision_id=a.revision_id WHERE a.node_id=$1 AND pin.kind='extensions' AND pin.resource_id=$2 AND pin.released_at IS NULL AND NOT EXISTS(SELECT 1 FROM public.pbx_artifact_retirements r WHERE r.artifact_id=a.id) ORDER BY a.id",
      [p.nodeId, extensionId],
    );
    assert.deepEqual(
      artifacts.map((a) => a.id),
      [removed.supersededArtifact],
    );
    await page.goto(`${origin}/pbx-nodes/${p.nodeId}/revisions`);
    const panel = page.getByRole('region', {
      name: 'Superseded artifact retirement',
      exact: true,
    });
    await panel
      .getByLabel(/^Superseded artifact/)
      .selectOption(removed.supersededArtifact);
    const stock = panel.getByLabel(/^Extension removed from runtime/);
    for (let pages = 0; pages < 16; pages++) {
      if (await stock.locator(`option[value="${extensionId}"]`).count()) break;
      await panel
        .getByRole('button', { name: 'More extensions', exact: true })
        .click();
      await page.waitForLoadState('networkidle');
    }
    await stock.selectOption(extensionId);
    await panel
      .getByRole('checkbox', { name: /I reviewed the replacement artifact/ })
      .check();
    await panel
      .getByRole('button', {
        name: 'Request exact artifact retirement',
        exact: true,
      })
      .click();
    await expect
      .poll(
        async () =>
          (
            await query(
              'SELECT p.state FROM public.pbx_artifact_retirement_intents i JOIN public.pbx_artifact_retirement_progress p ON p.intent_id=i.id WHERE i.artifact_id=$1 AND i.resource_id=$2 ORDER BY i.created_at DESC LIMIT 1',
              [removed.supersededArtifact, extensionId],
            )
          )[0]?.state,
        { timeout: 45000 },
      )
      .toBe('retired');
    assert.equal(
      (
        await query(
          'SELECT 1 FROM public.pbx_live_pins WHERE revision_id=$1 AND released_at IS NULL',
          [removed.supersededArtifact],
        )
      ).length,
      0,
    );
    journal.retiredArtifact = removed.supersededArtifact;
    save();
    await allocation(oldTenant);
    if (returning)
      await expect(button(`Release extension ${number}`)).toBeEnabled();
    else await expect(button(`Release extension ${number}`)).toBeDisabled();
    journal.desiredReferenceStillBlocksRelease = !returning;
    save();
  } else if (phase === 'transfer-allocate') {
    const retired = previous('retire');
    assert.equal(retired.state, 'stage_passed');
    assert.equal(retired.startArtifact, journal.startArtifact);
    assert.equal(claim?.tenant_id, oldTenant.id);
    if (!returning) {
      await openTenant(oldTenant);
      const [authorization] = await query(
        "SELECT id FROM public.tenant_route_authorizations WHERE tenant_id=$1 AND node_id=$2 AND kind='inbound' AND resource_id=$3 AND state='active'",
        [oldTenant.id, p.nodeId, resources.routeIds[0]],
      );
      assert.ok(authorization);
      await page
        .locator(`#route-binding-${authorization.id}`)
        .getByRole('button', { name: /^Revoke / })
        .click();
      await expect
        .poll(
          async () =>
            (
              await query(
                'SELECT state FROM public.tenant_route_authorizations WHERE id=$1',
                [authorization.id],
              )
            )[0]?.state,
        )
        .toBe('revoked');
      await page.goto(
        `${origin}/pbx-nodes/${p.nodeId}/routing?kind=inbound&resource=${resources.routeIds[0]}`,
      );
      await button('Remove inbound rule').click();
      await button('Confirm removal').click();
      await expect
        .poll(
          async () =>
            !!(
              await query(
                'SELECT removed_at FROM public.inbound_rules WHERE id=$1',
                [resources.routeIds[0]],
              )
            )[0]?.removed_at,
        )
        .toBe(true);
    }
    await allocation(oldTenant);
    await expect(button(`Release extension ${number}`)).toBeEnabled();
    await button(`Release extension ${number}`).click();
    await expect
      .poll(
        async () =>
          (
            await query(
              'SELECT state FROM public.tenant_inventory_claims WHERE id=$1',
              [claim.id],
            )
          )[0]?.state,
      )
      .toBe('released');
    journal.oldClaim = {
      id: claim.id,
      version: claim.version,
      tenantId: claim.tenant_id,
    };
    save();
    await setOrdinaryExtensionStatus(s, extensionId, number, 'enabled');
    await allocation(newTenant);
    await page.getByLabel(/^Selection method/).selectOption('individual');
    const search = page.getByRole('search', {
      name: 'Find stock extensions',
      exact: true,
    });
    await search.getByLabel(/^Extension number/).fill(number);
    await search
      .getByRole('button', { name: 'Find extensions', exact: true })
      .click();
    const choice = page.getByRole('checkbox', {
      name: new RegExp(`^Extension ${number} ·`),
    });
    await expect(choice).toBeEnabled();
    await choice.check();
    await page.getByLabel(/^Ownership state/).selectOption('allocated');
    await button('Preview selection').click();
    await expect(button('Save allocation')).toBeEnabled();
    await button('Save allocation').click();
    await expect
      .poll(
        async () =>
          (
            await query(
              "SELECT tenant_id FROM public.tenant_inventory_claims WHERE extension_id=$1 AND state='allocated'",
              [extensionId],
            )
          )[0]?.tenant_id,
      )
      .toBe(newTenant.id);
    const [next] = await query(
      "SELECT id,tenant_id,version FROM public.tenant_inventory_claims WHERE extension_id=$1 AND state='allocated'",
      [extensionId],
    );
    assert.notEqual(next.id, claim.id);
    journal.newClaim = next;
    save();
  } else {
    assert.equal(phase, 'transfer-route');
    const allocated = previous('allocate');
    assert.equal(allocated.state, 'stage_passed');
    assert.equal(claim?.tenant_id, newTenant.id);
    assert.equal(claim.id, allocated.newClaim.id);
    if (returning) {
      const [did] = await query(
        'SELECT id FROM public.sip_dids WHERE node_id=$1 AND number=$2 AND removed_at IS NULL',
        [p.nodeId, p.tenants[0].inboundNumber],
      );
      assert.ok(did);
      assert.equal(
        (
          await query(
            'SELECT id FROM public.inbound_rules WHERE node_id=$1 AND did_id=$2 AND removed_at IS NULL',
            [p.nodeId, did.id],
          )
        ).length,
        0,
      );
      await page.goto(`${origin}/pbx-nodes/${p.nodeId}/routing?kind=inbound`);
      await button('Create inbound rule').click();
      const form = page.getByRole('region', {
        name: 'Resource form',
        exact: true,
      });
      const name = 'P4 controlled development A restored ingress';
      await form.getByLabel(/^Name/).fill(name);
      await form
        .getByLabel(/^Trusted gateway/)
        .selectOption(resources.gatewayId);
      await form.getByLabel(/^DID selector/).selectOption(did.id);
      await form.getByLabel(/^Inbound destination/).selectOption('extension');
      const destination = form.getByLabel(/^Destination resource/);
      await page.waitForLoadState('networkidle');
      for (let pages = 0; pages < 16; pages++) {
        if (await destination.locator(`option[value="${extensionId}"]`).count())
          break;
        await button('More extensions').click();
        await page.waitForLoadState('networkidle');
      }
      await destination.selectOption(extensionId);
      await form
        .getByRole('button', { name: 'Save inbound rule', exact: true })
        .click();
      await expect
        .poll(
          async () =>
            (
              await query(
                'SELECT id FROM public.inbound_rules WHERE node_id=$1 AND name=$2 AND removed_at IS NULL',
                [p.nodeId, name],
              )
            ).length,
        )
        .toBe(1);
      const [rule] = await query(
        'SELECT id,enabled FROM public.inbound_rules WHERE node_id=$1 AND name=$2 AND removed_at IS NULL',
        [p.nodeId, name],
      );
      assert.equal(rule.enabled, false);
      await button('Enable inbound rule').click();
      await expect
        .poll(
          async () =>
            (
              await query(
                'SELECT enabled FROM public.inbound_rules WHERE id=$1',
                [rule.id],
              )
            )[0]?.enabled,
        )
        .toBe(true);
      await openTenant(newTenant);
      await bind('inbound', 'inbound', rule.id);
      journal.restoredInboundRuleId = rule.id;
      save();
    } else await retargetB(extensionId);
    await apply();
    journal.transferredExtension = {
      id: extensionId,
      number,
      oldTenantId: oldTenant.id,
      newTenantId: newTenant.id,
      newClaimId: claim.id,
      inboundRuleId: returning
        ? journal.restoredInboundRuleId
        : resources.routeIds[2],
    };
    save();
  }
}
