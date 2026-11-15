// Explicit ordinary deployment acceptance. No disposable database/PBX or fixture writer.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { expect as baseExpect } from '@playwright/test';
import { manifest, uuid } from './tenant-call-preparation-store.mjs';
import { withOrdinaryConsole } from './tenant-call-ordinary-console.mjs';
const expect = baseExpect.configure({ timeout: 30000 });
const [file, stage, runId] = process.argv.slice(2);
const stages = [
  'configure',
  'read',
  'revoke-grants',
  'restore',
  'apply',
  'recover-apply',
  'recover-apply-read',
  'calls',
  'calls-remaining',
  'conditions',
  'restart-grant',
  'restart-check',
  'transfer-remove',
  'transfer-retire',
  'transfer-allocate',
  'transfer-route',
  'transfer-route-resume',
  'transfer-route-rebind',
  'return-remove',
  'return-retire',
  'return-allocate',
  'return-route',
  'return-route-resume',
  'cleanup',
];
let journal, journalPath;
let ownsJournal = false;
function save() {
  writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', {
    mode: 0o600,
  });
}
try {
  assert.equal(process.argv.length, 5);
  assert.ok(stages.includes(stage) && uuid(runId));
  const bytes = readFileSync(file);
  assert.ok(bytes.length <= 8192);
  const p = manifest(JSON.parse(bytes));
  const directory = `.local/verification/p4-u2-dev-c/${runId}`;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  journalPath = `${directory}/${stage}.json`;
  journal = {
    environment: 'ordinary-retained-private-https',
    stage,
    runId,
    preparationId: p.requestId,
    nodeId: p.nodeId,
    installationId: p.installationId,
    startedAt: new Date().toISOString(),
    state: 'started',
    temporaryCanonicalSession: true,
    manualPasswordSignInClaimed: false,
    integratedAcceptanceComplete: false,
    requests: [],
    results: [],
  };
  // Never repeat a stage implicitly: inspect retained exact requests/results first.
  writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', {
    mode: 0o600,
    flag: 'wx',
  });
  ownsJournal = true;
  await withOrdinaryConsole(p, async ({ page, db, origin }) => {
    const query = async (sql, args = []) =>
      (await db.read((s) => s.query(sql, args))).rows;
    const [target] = await query(
      `SELECT n.version,n.installation_id,r.runtime_state,r.installed_id,r.verified_id,r.known_good_id,r.active_operation_id,r.active_retirement_id,r.active_profile_operation_id,o.expires_at>statement_timestamp() AS owner_current,profile.digest AS unmanaged_digest FROM public.pbx_nodes n JOIN public.pbx_live_runtime r ON r.node_id=n.id JOIN public.pbx_ownership o ON o.node_id=n.id JOIN public.pbx_artifact_profiles profile ON profile.artifact_id=r.verified_id WHERE n.id=$1`,
      [p.nodeId],
    );
    assert.ok(target);
    assert.equal(target.version, p.expectedNodeVersion);
    assert.equal(target.installation_id, p.installationId);
    assert.equal(target.runtime_state, 'verified');
    assert.equal(target.installed_id, target.verified_id);
    assert.equal(target.known_good_id, target.verified_id);
    assert.equal(target.unmanaged_digest, p.expectedProfileDigest);
    assert.equal(target.owner_current, true);
    for (const key of [
      'active_operation_id',
      'active_retirement_id',
      'active_profile_operation_id',
    ])
      assert.equal(target[key], null);
    assert.equal(
      (
        await query(
          "SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown')",
          [p.nodeId],
        )
      ).length,
      0,
    );
    const tenants = await query(
      'SELECT id,normalized_code,status FROM public.tenants WHERE normalized_code=ANY($1::text[]) ORDER BY normalized_code',
      [p.tenants.map((t) => t.tenantCode)],
    );
    assert.equal(tenants.length, 2);
    assert.ok(tenants.every((t) => t.status === 'draft'));
    const [step] = await query(
      "SELECT result FROM public.tenant_call_preparation_steps WHERE preparation_id=$1 AND step='cases' AND phase='outcome'",
      [p.requestId],
    );
    assert.ok(step?.result?.resources);
    const resources = step.result.resources;
    assert.deepEqual(
      tenants.map((t) => t.id),
      resources.tenantIds,
    );
    const successor = (
      await query(
        'SELECT case_ids FROM public.tenant_call_preparation_fact_sets WHERE preparation_id=$1 ORDER BY generation DESC LIMIT 1',
        [p.requestId],
      )
    )[0];
    const approvedCases = successor
      ? await query(
          'SELECT id,tenant_id AS "tenantId" FROM public.tenant_route_test_cases WHERE id=ANY($1::uuid[]) ORDER BY id',
          [successor.case_ids],
        )
      : step.result.cases;
    assert.ok(approvedCases.length > 0 && approvedCases.length <= 32);
    journal.startArtifact = target.verified_id;
    journal.tenants = tenants.map((t) => t.id);
    save();
    page.on('request', (request) => {
      const path = new URL(request.url()).pathname;
      if (
        !['POST', 'PATCH', 'DELETE'].includes(request.method()) ||
        !path.startsWith('/platform/')
      )
        return;
      const body = request.postDataJSON();
      // Record bounded routing intent, never headers, cookies or sign-in bodies.
      if (!path.includes(p.nodeId)) return;
      assert.ok(JSON.stringify(body).length <= 65536);
      journal.requests.push({
        method: request.method(),
        path,
        body,
        at: new Date().toISOString(),
      });
      save();
    });
    page.on('response', (response) => {
      const path = new URL(response.url()).pathname;
      if (
        path.startsWith('/platform/') &&
        path.includes(p.nodeId) &&
        response.status() >= 400
      ) {
        journal.failedResponses ??= [];
        journal.failedResponses.push({ path, status: response.status() });
        save();
      }
    });
    const button = (name) => page.getByRole('button', { name, exact: true });
    async function get(path) {
      const response = await page.evaluate(async (path) => {
        const r = await fetch(path, { cache: 'no-store' });
        return {
          status: r.status,
          cache: r.headers.get('cache-control'),
          body: await r.json().catch(() => null),
        };
      }, path);
      if (response.status !== 200) {
        journal.failedRead = { path, status: response.status };
        save();
      }
      assert.equal(response.status, 200);
      assert.match(response.cache, /no-store/);
      assert.notEqual(response.body, null);
      return response.body;
    }
    async function openTenant(tenant) {
      await page.goto(`${origin}/tenants/${tenant.id}`);
      await button('Expand Tenant route bindings').click();
      await page.getByLabel(/^Routing PBX node/).selectOption(p.nodeId);
      await expect(page.getByLabel(/^Controlled call case/)).toBeVisible();
      await page.waitForLoadState('networkidle');
    }
    async function bind(direction, kind, resourceId, scope = 'owned') {
      const section = page.getByRole('region', {
        name: `${direction} tenant route configuration`,
        exact: true,
      });
      await section.getByLabel(/^Authorization/).selectOption(kind);
      await page.waitForLoadState('networkidle');
      await section.getByLabel(/^Existing resource/).selectOption(resourceId);
      if (kind === 'trunks')
        await section.getByLabel('Trunk ownership').selectOption(scope);
      await section
        .getByRole('button', {
          name: `Preview ${direction} authorization`,
          exact: true,
        })
        .click();
      const saveButton = section.getByRole('button', {
        name: `Save ${direction} authorization`,
        exact: true,
      });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      await expect(
        section.getByText(
          'Desired authorization saved. Live verification is pending.',
          { exact: true },
        ),
      ).toBeVisible();
      await page.waitForLoadState('networkidle');
    }
    async function apply() {
      // Begin the reviewed apply in a fresh ordinary protected-request window.
      // This paces acceptance only; it never retries a submitted effect.
      await delay(60000 - (Date.now() % 60000) + 1000);
      await page.goto(`${origin}/pbx-nodes/${p.nodeId}/revisions`);
      await expect(
        page.getByText('Loading history…', { exact: true }),
      ).toHaveCount(0);
      await page.waitForLoadState('networkidle');
      await button('Capture desired state').click();
      await expect(button('Validate offline')).toBeEnabled();
      await button('Validate offline').click();
      await expect(page.getByText(/Local validation: passed/)).toBeVisible();
      await page
        .getByRole('checkbox', { name: /I reviewed the runtime comparison/ })
        .check();
      await button('Apply reviewed revision').click();
      await expect(page.getByText(/^Operation .*: verified\./)).toBeVisible({
        timeout: 90000,
      });
      const live = await get(`/platform/pbx-nodes/${p.nodeId}/revisions/live`);
      assert.ok(uuid(live.verifiedId));
      journal.appliedArtifact = live.verifiedId;
      save();
    }
    if (stage === 'revoke-grants') {
      for (const tenant of tenants) {
        const grants = await query(
          'SELECT g.id FROM public.tenant_verification_grants g WHERE g.tenant_id=$1 AND g.node_id=$2 AND g.operator_id=$3 AND g.authentication_version=$4 AND g.expires_at>statement_timestamp() AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_revocations r WHERE r.grant_id=g.id) AND EXISTS(SELECT 1 FROM public.tenant_verification_grant_cases gc WHERE gc.grant_id=g.id) AND NOT EXISTS(SELECT 1 FROM public.tenant_verification_grant_cases gc WHERE gc.grant_id=g.id AND NOT EXISTS(SELECT 1 FROM public.tenant_call_preparation_cases pc WHERE pc.preparation_id=$5 AND pc.case_id=gc.case_id)) ORDER BY g.id',
          [
            tenant.id,
            p.nodeId,
            p.operatorId,
            p.authenticationVersion,
            p.requestId,
          ],
        );
        if (!grants.length) continue;
        await openTenant(tenant);
        for (const grant of grants) {
          await page
            .getByLabel(/^Draft verification grant/)
            .selectOption(grant.id);
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
          journal.results.push({ grantId: grant.id, revoked: true });
          save();
        }
      }
    } else if (stage === 'read') {
      const { checkOrdinaryRead } =
        await import('./tenant-call-ordinary-read.mjs');
      await checkOrdinaryRead({
        page,
        p,
        tenants,
        approvedCases,
        get,
        button,
        openTenant,
        journal,
        save,
      });
    } else if (stage === 'recover-apply' || stage === 'recover-apply-read') {
      const candidates = stages
        .filter(
          (name) => name !== stage && existsSync(`${directory}/${name}.json`),
        )
        .map((name) => ({
          name,
          value: JSON.parse(readFileSync(`${directory}/${name}.json`, 'utf8')),
        }))
        .filter(
          ({ value }) =>
            value.state === 'incomplete_requires_exact_review' &&
            value.requests.filter(
              (r) =>
                r.path ===
                `/platform/pbx-nodes/${p.nodeId}/revisions/live/apply`,
            ).length === 1,
        );
      assert.equal(candidates.length, 1);
      const prior = candidates[0];
      const request = prior.value.requests.find(
        (r) =>
          r.path === `/platform/pbx-nodes/${p.nodeId}/revisions/live/apply`,
      );
      assert.equal(request.body.revisionId, target.verified_id);
      await page.goto(`${origin}/pbx-nodes/${p.nodeId}/revisions`);
      const receipt = await get(
        `/platform/pbx-nodes/${p.nodeId}/revisions/live/receipts/${request.body.requestId}`,
      );
      assert.equal(receipt.operation.state, 'verified');
      assert.equal(receipt.operation.createdBy, p.operatorId);
      assert.equal(receipt.operation.nodeId, p.nodeId);
      assert.equal(
        receipt.operation.expectedBaselineId,
        request.body.expectedBaselineId,
      );
      assert.equal(receipt.operation.revisionId, request.body.revisionId);
      await page.goto(`${origin}/pbx-nodes/${p.nodeId}/revisions`);
      await button('Reload live state').click();
      const live = await get(`/platform/pbx-nodes/${p.nodeId}/revisions/live`);
      assert.equal(live.verifiedId, request.body.revisionId);
      assert.equal(live.knownGoodId, request.body.revisionId);
      assert.equal(journal.requests.length, 0);
      journal.appliedArtifact = request.body.revisionId;
      journal.recoveredApply = {
        stage: prior.name,
        requestId: request.body.requestId,
        operationId: receipt.operation.id,
        state: receipt.operation.state,
        additionalApply: false,
      };
      save();
    } else if (stage === 'restore') {
      const { restoreControlledGraph } =
        await import('./tenant-call-ordinary-cleanup.mjs');
      await restoreControlledGraph({
        page,
        p,
        origin,
        resources,
        query,
        button,
        journal,
        save,
        tenants,
        openTenant,
        bind,
        apply,
      });
    } else if (stage === 'configure') {
      assert.equal(target.verified_id, p.expectedArtifactId);
      for (let i = 0; i < tenants.length; i++) {
        const tenant = tenants[i];
        await openTenant(tenant);
        assert.equal(
          (
            await query(
              "SELECT 1 FROM public.tenant_route_authorizations WHERE tenant_id=$1 AND node_id=$2 AND state='active'",
              [tenant.id, p.nodeId],
            )
          ).length,
          0,
        );
        const [did] = await query(
          'SELECT id FROM public.sip_dids WHERE node_id=$1 AND number=$2 AND removed_at IS NULL',
          [p.nodeId, p.tenants[i].inboundNumber],
        );
        assert.ok(did);
        await bind('inbound', 'dids', did.id);
        await bind('inbound', 'inbound', resources.routeIds[i * 2]);
        if (i === 0)
          await bind('outbound', 'trunks', resources.trunkId, 'shared');
        await bind('outbound', 'permission', resources.trunkId);
        await bind('outbound', 'outbound', resources.routeIds[i * 2 + 1]);
      }
      await apply();
    } else if (stage === 'apply') {
      // Resume reviewed desired configuration without duplicating authorizations.
      for (let i = 0; i < tenants.length; i++) {
        const rows = await query(
          "SELECT kind,resource_id,scope FROM public.tenant_route_authorizations WHERE tenant_id=$1 AND node_id=$2 AND state='active' ORDER BY kind",
          [tenants[i].id, p.nodeId],
        );
        const [did] = await query(
          'SELECT id FROM public.sip_dids WHERE node_id=$1 AND number=$2 AND removed_at IS NULL',
          [p.nodeId, p.tenants[i].inboundNumber],
        );
        assert.ok(did);
        assert.deepEqual(
          rows.map((r) => [r.kind, r.resource_id, r.scope]),
          [
            ['dids', did.id, 'owned'],
            ['inbound', resources.routeIds[i * 2], 'owned'],
            ['outbound', resources.routeIds[i * 2 + 1], 'owned'],
            ['permission', resources.trunkId, 'owned'],
          ],
        );
      }
      const shared = await query(
        "SELECT resource_id FROM public.tenant_route_authorizations WHERE node_id=$1 AND kind='trunks' AND scope='shared' AND tenant_id IS NULL AND state='active' AND resource_id=$2",
        [p.nodeId, resources.trunkId],
      );
      assert.equal(shared.length, 1);
      await apply();
    } else if (stage === 'calls' || stage === 'calls-remaining') {
      const completedCases = new Set();
      if (stage === 'calls-remaining') {
        const prior = JSON.parse(
          readFileSync(`${directory}/calls.json`, 'utf8'),
        );
        assert.equal(prior.state, 'incomplete_requires_exact_review');
        assert.equal(prior.startArtifact, target.verified_id);
        const requests = prior.requests.filter((r) => r.path.endsWith('/test'));
        const ids = [...new Set(requests.map((r) => r.body.requestId))];
        assert.ok(ids.length > 0 && ids.length <= 32);
        const recovered = await query(
          "SELECT i.id,i.request_id,i.case_id,i.artifact_id,i.runtime_generation,p.state,r.outcome,r.destination_id,c.expected_outcome,c.expected_destination_id FROM public.tenant_route_test_intents i JOIN public.tenant_route_test_progress p ON p.intent_id=i.id JOIN public.tenant_route_test_results r ON r.intent_id=i.id JOIN public.tenant_route_test_cases c ON c.id=i.case_id JOIN public.pbx_live_runtime live ON live.node_id=i.node_id WHERE i.node_id=$1 AND i.operator_id=$2 AND i.request_id=ANY($3::uuid[]) AND i.artifact_id=live.verified_id AND i.source_digest=(SELECT source_digest FROM public.pbx_revisions WHERE id=i.revision_id) AND i.runtime_generation=live.routing_generation AND r.created_at>statement_timestamp()-interval '24 hours' ORDER BY i.id",
          [p.nodeId, p.operatorId, ids],
        );
        assert.equal(
          recovered.length,
          ids.length,
          'Every prior intent must have exact resolved current-generation evidence',
        );
        for (const r of recovered) {
          assert.ok(['passed', 'denied'].includes(r.state));
          assert.equal(r.outcome, r.expected_outcome);
          assert.equal(r.destination_id, r.expected_destination_id);
          assert.ok(
            requests.some(
              (q) =>
                q.body.requestId === r.request_id &&
                q.body.caseId === r.case_id,
            ),
          );
          completedCases.add(r.case_id);
        }
        journal.recoveredExactResults = recovered;
        journal.responseLoss = prior.responseLoss;
        save();
      }
      const [artifact] = await query(
        'SELECT v.compiler_version,v.policy_version FROM public.pbx_live_artifacts a JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE a.id=$1',
        [target.verified_id],
      );
      assert.equal(artifact.compiler_version, 'tenant-review-1');
      assert.equal(artifact.policy_version, 'tenant-routing-1');
      for (const tenant of tenants) {
        await openTenant(tenant);
        const path = `/platform/tenants/${tenant.id}/telephony/${p.nodeId}`;
        let view = await get(path);
        const cases = view.cases.filter((c) =>
          approvedCases.some((a) => a.id === c.id && a.tenantId === tenant.id),
        );
        assert.equal(
          cases.length,
          approvedCases.filter((c) => c.tenantId === tenant.id).length,
        );
        assert.ok(cases.every((c) => c.available === true));
        assert.equal(view.artifactId, target.verified_id);
        assert.equal(view.grants.filter((g) => g.active).length, 0);
        const selection = page.getByRole('group', {
          name: 'Cases permitted by the new grant',
          exact: true,
        });
        await expect(button('Grant verification')).toBeDisabled();
        for (const outcome of ['permitted', 'denied']) {
          const granted = cases.filter(
            (c) =>
              c.expectedOutcome === outcome &&
              c.kind !== 'expiry' &&
              !completedCases.has(c.id),
          );
          if (!granted.length) continue;
          for (const c of granted)
            await selection
              .getByRole('checkbox', {
                name: new RegExp(`^Permit case ${c.id}:`),
              })
              .check();
          await page.getByLabel(/^Verification lifetime/).selectOption('1800');
          await button('Grant verification').click();
          await expect(
            page.getByText('Intent recorded. Reload for the current outcome.', {
              exact: true,
            }),
          ).toBeVisible();
          view = await get(path);
          const grant = view.grants.find((g) => g.active);
          assert.ok(grant);
          const membership = await query(
            'SELECT case_id FROM public.tenant_verification_grant_cases WHERE grant_id=$1 ORDER BY case_id',
            [grant.id],
          );
          assert.deepEqual(
            membership.map((m) => m.case_id),
            granted.map((c) => c.id).sort(),
          );
          await page
            .getByLabel(/^Draft verification grant/)
            .selectOption(grant.id);
          try {
            for (const c of granted) {
              assert.equal(
                (
                  await query(
                    "SELECT 1 FROM public.tenant_route_test_progress WHERE node_id=$1 AND state IN ('queued','dispatching','admitted','unknown')",
                    [p.nodeId],
                  )
                ).length,
                0,
              );
              const before = new Set(view.tests.map((t) => t.id));
              await page
                .getByLabel(/^Draft verification grant/)
                .selectOption(grant.id);
              await page.getByLabel(/^Controlled call case/).selectOption(c.id);
              if (!journal.responseLoss && c.expectedOutcome === 'permitted') {
                // Drop an actual 202 response after the real backend commits it.
                // Chromium still uses the pinned ordinary TLS connection.
                const cdp = await page.context().newCDPSession(page);
                let lostResponse;
                const dropped = new Promise((resolve, reject) => {
                  cdp.on('Fetch.requestPaused', async (event) => {
                    try {
                      assert.equal(event.responseStatusCode, 202);
                      lostResponse = event.request.url;
                      await cdp.send('Fetch.failRequest', {
                        requestId: event.requestId,
                        errorReason: 'ConnectionClosed',
                      });
                      resolve();
                    } catch (error) {
                      reject(error);
                    }
                  });
                });
                try {
                  await cdp.send('Fetch.enable', {
                    patterns: [
                      {
                        urlPattern: `${origin}${path}/test`,
                        requestStage: 'Response',
                      },
                    ],
                  });
                  await button('Run controlled call test').click();
                  await Promise.race([
                    dropped,
                    delay(45000).then(() => {
                      throw new Error('Response-loss boundary unavailable');
                    }),
                  ]);
                  assert.equal(lostResponse, `${origin}${path}/test`);
                  await cdp.send('Fetch.disable');
                  await expect(button('Retry access')).toBeEnabled();
                  await delay(1100);
                  await button('Retry access').click();
                  await expect(
                    button('Recover exact verification intent'),
                  ).toBeEnabled();
                  await button('Recover exact verification intent').click();
                  await expect(
                    page.getByText(
                      'Intent recorded. Reload for the current outcome.',
                      { exact: true },
                    ),
                  ).toBeVisible();
                  const retries = journal.requests.filter(
                    (r) => r.path === `${path}/test`,
                  );
                  assert.equal(retries.length, 2);
                  assert.deepEqual(retries[0].body, retries[1].body);
                  const intents = await query(
                    'SELECT id FROM public.tenant_route_test_intents WHERE node_id=$1 AND request_id=$2',
                    [p.nodeId, retries[0].body.requestId],
                  );
                  assert.equal(intents.length, 1);
                  journal.responseLoss = {
                    boundary: 'injected_browser_response_loss_after_actual_202',
                    exactRequestId: retries[0].body.requestId,
                    intentId: intents[0].id,
                    exactRetryCreatedAdditionalIntent: false,
                  };
                  save();
                } finally {
                  await cdp.send('Fetch.disable').catch(() => {});
                  await cdp.detach();
                }
              } else await button('Run controlled call test').click();
              let result;
              for (const until = Date.now() + 45000; Date.now() < until;) {
                view = await get(path);
                result = view.tests.find(
                  (t) => t.caseId === c.id && !before.has(t.id),
                );
                if (result?.outcome || result?.state === 'unknown') break;
                await delay(1000);
              }
              journal.results.push({ caseId: c.id, result: result ?? null });
              save();
              assert.equal(result?.outcome, c.expectedOutcome);
              assert.equal(result?.destinationId, c.expectedDestinationId);
              assert.equal(result?.current, true);
            }
          } finally {
            // Revocation retains failure provenance; never interrupts an active call.
            await page
              .getByLabel(/^Draft verification grant/)
              .selectOption(grant.id);
            await button('Revoke selected grant').click();
            await expect(
              page.getByText(
                'Intent recorded. Reload for the current outcome.',
                {
                  exact: true,
                },
              ),
            ).toBeVisible();
            const after = await get(path);
            assert.equal(
              after.grants.find((g) => g.id === grant.id)?.active,
              false,
            );
          }
          if (await button('Clear grant selection').isEnabled())
            await button('Clear grant selection').click();
        }
      }
    } else if (stage.startsWith('restart-')) {
      const { checkOrdinaryRestart } =
        await import('./tenant-call-ordinary-restart.mjs');
      const readStage = (name) =>
        JSON.parse(readFileSync(`${directory}/${name}.json`, 'utf8'));
      await checkOrdinaryRestart({
        stage,
        page,
        p,
        tenants,
        query,
        get,
        button,
        openTenant,
        journal,
        save,
        readStage,
      });
    } else if (stage.startsWith('transfer-') || stage.startsWith('return-')) {
      const { checkOrdinaryTransfer } =
        await import('./tenant-call-ordinary-transfer.mjs');
      const readStage = (name) =>
        JSON.parse(readFileSync(`${directory}/${name}.json`, 'utf8'));
      await checkOrdinaryTransfer({
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
      });
    } else if (stage === 'conditions') {
      const { checkOrdinaryConditions } =
        await import('./tenant-call-ordinary-conditions.mjs');
      await checkOrdinaryConditions({
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
      });
    } else {
      const activeRoutes = await query(
        'SELECT route_id FROM public.tenant_route_test_cases WHERE id=ANY($1::uuid[])',
        [approvedCases.map((c) => c.id)],
      );
      const cleanupResources = [
        ...new Set([
          ...resources.routeIds,
          ...activeRoutes.map((r) => r.route_id),
          resources.trunkId,
        ]),
      ];
      for (const tenant of tenants) {
        await openTenant(tenant);
        const view = await get(
          `/platform/tenants/${tenant.id}/telephony/${p.nodeId}`,
        );
        assert.equal(
          view.grants.filter((g) => g.active).length,
          0,
          'Revoke owned grants explicitly before cleanup',
        );
        // Retain DID ownership and shared classification with reusable desired stock.
        // Revoke only approved verification paths, never unrelated authorizations.
        const owned = await query(
          "SELECT id,kind,resource_id FROM public.tenant_route_authorizations WHERE tenant_id=$1 AND node_id=$2 AND state='active' AND kind IN ('inbound','outbound','permission') AND resource_id=ANY($3::uuid[]) ORDER BY CASE kind WHEN 'outbound' THEN 0 WHEN 'inbound' THEN 1 ELSE 2 END,id",
          [tenant.id, p.nodeId, cleanupResources],
        );
        for (const authorization of owned) {
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
          await page.waitForLoadState('networkidle');
        }
      }
      const { setControlledResourceState } =
        await import('./tenant-call-ordinary-cleanup.mjs');
      await setControlledResourceState(
        { page, p, origin, resources, query, button, journal, save },
        false,
      );
      await apply();
    }
    journal.state = 'stage_passed';
    journal.finishedAt = new Date().toISOString();
    save();
    console.log(
      JSON.stringify({
        state: journal.state,
        stage,
        environment: journal.environment,
        runId,
        nodeId: p.nodeId,
        installationId: p.installationId,
        integratedAcceptanceComplete: false,
        journal: journalPath,
      }),
    );
  });
} catch (error) {
  if (ownsJournal && journal.state === 'started') {
    journal.state = 'incomplete_requires_exact_review';
    journal.failureLocation = error?.stack
      ?.split('\n')
      .find((line) => /tenant-call-ordinary-[a-z-]+\.mjs:\d+/.test(line))
      ?.trim();
    save();
  }
  console.error(
    'Ordinary acceptance incomplete. Inspect retained exact journal and canonical outcomes before any retry; no automatic redial or fixture fallback.',
  );
  process.exitCode = 1;
}
