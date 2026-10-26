import { checkLiveBrowser } from './check-pbx-live-browser.mjs';
import { checkPbxLiveIntent } from './check-pbx-live-intent.mjs';
/* global structuredClone, document, innerWidth */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect as baseExpect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const expect = baseExpect.configure({ timeout: 20000 });
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { compileRevision } = backend(
  './dist/modules/telephony/domain/revision-compiler.js',
);
export async function checkPbxRevisions({
  request,
  direct,
  nodeId,
  otherNode,
  installation,
  owner,
  page,
  context,
  config,
  a,
  b,
  holdResponse,
  issue,
  staffFacts,
  expire,
  login,
  select,
}) {
  try {
    const root = `/platform/pbx-nodes/${nodeId}`,
      path = root + '/revisions';
    const capture = async (body = { requestId: randomUUID() }, replica = a) => {
      const r = await direct(replica, path, 'POST', body);
      assert.ok([200, 201].includes(r.status), JSON.stringify(r));
      return r.data.revision;
    };
    console.log(
      'CHECK revisions: immutable consistent capture, audit, receipts, compiler, diff, stale dependencies and HTTPS journey',
    );
    await owner.query(
      `INSERT INTO public.endpoint_capabilities(installation_id,revision,kinds,signaling,codecs,media) VALUES($1,1,ARRAY['sip'],ARRAY['udp'],ARRAY['ulaw','alaw'],ARRAY['none'])`,
      [installation],
    );
    const profile = (
      await request(root + '/endpoint-profiles', 'POST', {
        requestId: randomUUID(),
        name: 'Revision profile',
        template: 'sip-basic',
        expectedNodeVersion: 1,
        expectedCapabilityRevision: 1,
      })
    ).data.profile;
    assert.ok(profile);
    async function stock(number) {
      const result = await request(root + '/extensions', 'POST', {
        requestId: randomUUID(),
        kind: 'sip',
        number,
        profileId: profile.id,
        profileVersion: 1,
        expectedProfileHead: 1,
        expectedNodeVersion: 1,
        expectedCapabilityRevision: 1,
      });
      assert.equal(result.status, 201);
      return result.data.extension;
    }
    const extension = await stock('1000'),
      secondExtension = await stock('1001');
    const groupValues = {
      name: 'Review group',
      number: '2000',
      memberIds: [extension.id],
      strategy: 'sequential',
      timeout: 15,
      fallback: { kind: 'hangup' },
    };
    const group = (
      await request(root + '/routing/groups', 'POST', {
        requestId: randomUUID(),
        ...groupValues,
      })
    ).data.resource;
    assert.ok(group);
    const exact = { requestId: randomUUID() },
      [r1, r2] = await Promise.all([capture(exact, a), capture(exact, b)]);
    assert.equal(r1.id, r2.id);
    assert.equal(r1.sequence, 1);
    assert.equal(
      (await direct(b, path, 'POST', { ...exact, baselineId: r1.id })).status,
      409,
    );
    assert.equal(
      (await direct(a, path + '/receipts/' + exact.requestId)).data.revision.id,
      r1.id,
    );
    assert.equal(
      (
        await request(
          `/platform/pbx-nodes/${otherNode}/revisions/receipts/${exact.requestId}`,
        )
      ).status,
      404,
    );
    const original = (
      await owner.query(
        'SELECT snapshot,source_digest FROM public.pbx_revisions WHERE id=$1',
        [r1.id],
      )
    ).rows[0];
    assert.deepEqual(
      compileRevision(original.snapshot),
      compileRevision(structuredClone(original.snapshot)),
    );
    for (const sql of [
      'UPDATE public.pbx_revisions SET sequence=sequence+1 WHERE id=$1',
      'DELETE FROM public.pbx_revisions WHERE id=$1',
    ])
      await assert.rejects(owner.query(sql, [r1.id]));
    const eventCount = (
      await owner.query(
        "SELECT count(*)::integer AS n FROM public.audit_events WHERE event_type='telephony.revision.recorded' AND metadata->>'revisionId'=$1",
        [r1.id],
      )
    ).rows[0].n;
    assert.equal(eventCount, 1);
    const validate = await request(`${path}/${r1.id}/validate`, 'POST', {});
    assert.equal(validate.status, 201, JSON.stringify(validate));
    assert.equal(validate.data.validation.local, 'passed');
    assert.equal(validate.data.validation.applicable, true);
    assert.equal(validate.data.validation.live, 'unavailable');
    assert.ok(
      validate.data.validation.evaluatedDependencies.some(
        (x) => x.id === group.id && x.version === 1,
      ),
    );
    // A real writer races capture on another replica. Either complete version is valid;
    // neither a version/content mismatch nor mixed group/member facts is acceptable.
    const [raced, edited] = await Promise.all([
      capture({ requestId: randomUUID(), baselineId: r1.id }, b),
      direct(a, root + '/routing/groups/' + group.id, 'PATCH', {
        ...groupValues,
        name: 'Review group edited',
        memberIds: [secondExtension.id, extension.id],
        timeout: 25,
        expectedVersion: 1,
      }),
    ]);
    assert.equal(edited.status, 200, JSON.stringify(edited));
    const racedSnapshot = (
      await owner.query(
        'SELECT snapshot FROM public.pbx_revisions WHERE id=$1',
        [raced.id],
      )
    ).rows[0].snapshot;
    const g = racedSnapshot.groups.find((x) => x.id === group.id);
    assert.ok(
      (g.version === 1 &&
        g.name === 'Review group' &&
        g.timeout === 15 &&
        JSON.stringify(g.memberIds) === JSON.stringify([extension.id])) ||
        (g.version === 2 &&
          g.name === 'Review group edited' &&
          g.timeout === 25 &&
          JSON.stringify(g.memberIds) ===
            JSON.stringify([secondExtension.id, extension.id])),
    );
    const detail = await request(`${path}/${r1.id}`);
    assert.equal(detail.status, 200, JSON.stringify(detail));
    assert.equal(detail.data.sourceCurrent, false);
    assert.equal(detail.data.validation.applicable, false);
    assert.equal(detail.data.diff.runtime.kind, 'no_verified_runtime');
    assert.ok(!JSON.stringify(detail.data).includes('ims-e-'));
    assert.ok(!JSON.stringify(detail.data).includes('sourceKey'));
    const stale = await request(`${path}/${r1.id}/validate`, 'POST', {});
    assert.equal(stale.data.validation.applicable, false);
    assert.ok(
      stale.data.validation.diagnostics.some(
        (x) => x.code === 'stale_dependencies',
      ),
    );
    assert.deepEqual(
      (
        await owner.query(
          'SELECT snapshot,source_digest FROM public.pbx_revisions WHERE id=$1',
          [r1.id],
        )
      ).rows[0],
      original,
    );
    const latest = await capture({
      requestId: randomUUID(),
      baselineId: r1.id,
    });
    const diff = await request(`${path}/${latest.id}`);
    assert.ok(
      diff.data.diff.changes.some(
        (x) =>
          x.id === group.id &&
          x.change === 'edited' &&
          x.fields.includes('timeout'),
      ),
    );
    assert.equal(
      (await request(`${path}/${latest.id}?baselineId=${r1.id}`)).status,
      200,
    );
    assert.equal(
      (await request(`${path}/${latest.id}?baselineId=${randomUUID()}`)).status,
      404,
    );
    const first = await request(path + '?limit=1');
    assert.equal(first.data.items.length, 1);
    assert.ok(first.data.nextCursor);
    assert.equal(
      (await request(path + '?limit=1&after=' + first.data.nextCursor)).data
        .items.length,
      1,
    );
    for (const body of [
      { requestId: randomUUID(), command: 'reload' },
      { requestId: randomUUID(), compiler: 'raw' },
      { requestId: randomUUID(), tenantId: randomUUID() },
    ])
      assert.equal((await direct(a, path, 'POST', body)).status, 400);
    assert.equal((await request(path + '?bogus=1')).status, 400);
    assert.equal(
      (
        await request(
          path,
          'POST',
          { requestId: randomUUID() },
          { 'X-Platform-CSRF': 'invalid' },
        )
      ).status,
      403,
    );
    const staff = await issue(a, staffFacts);
    assert.equal(
      (
        await direct(
          a,
          path,
          'GET',
          undefined,
          `__Host-myims-platform=${staff.token}`,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await context.request.post(config.origin + path, {
          headers: { origin: 'https://foreign.invalid' },
          data: { requestId: randomUUID() },
        })
      ).status(),
      403,
    );
    // Audit rejection and receipt rejection both roll back the whole successful capture.
    for (const target of ['audit', 'receipt']) {
      const requestId = randomUUID(),
        before = (
          await owner.query(
            'SELECT count(*)::integer AS n FROM public.pbx_revisions WHERE node_id=$1',
            [nodeId],
          )
        ).rows[0].n;
      const beforeAudit = (
        await owner.query(
          "SELECT count(*)::integer AS n FROM public.audit_events WHERE event_type='telephony.revision.recorded' AND metadata->>'nodeId'=$1",
          [nodeId],
        )
      ).rows[0].n;
      const table =
        target === 'audit' ? 'audit_events' : 'pbx_revision_receipts';
      const condition =
        target === 'audit'
          ? "NEW.event_type='telephony.revision.recorded'"
          : 'true';
      await owner.query(
        `CREATE FUNCTION public.reject_revision_check() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'revision fault'; END IF; RETURN NEW; END $$`,
      );
      await owner.query(
        `CREATE TRIGGER revision_check_fault BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION public.reject_revision_check()`,
      );
      try {
        assert.equal(
          (await direct(a, path, 'POST', { requestId })).status,
          503,
        );
      } finally {
        await owner.query(
          `DROP TRIGGER revision_check_fault ON public.${table}`,
        );
        await owner.query('DROP FUNCTION public.reject_revision_check()');
      }
      assert.equal(
        (
          await owner.query(
            'SELECT count(*)::integer AS n FROM public.pbx_revisions WHERE node_id=$1',
            [nodeId],
          )
        ).rows[0].n,
        before,
      );
      assert.equal(
        (await direct(b, path + '/receipts/' + requestId)).status,
        404,
      );
      assert.equal(
        (
          await owner.query(
            "SELECT count(*)::integer AS n FROM public.audit_events WHERE event_type='telephony.revision.recorded' AND metadata->>'nodeId'=$1",
            [nodeId],
          )
        ).rows[0].n,
        beforeAudit,
      );
    }
    // Real database snapshot bound rejects atomically instead of returning a prefix.
    await owner.query(
      `INSERT INTO public.number_reservations(id,node_id,installation_id,name,purpose,pattern_kind,digits,min_length,max_length,created_by,updated_by) SELECT gen_random_uuid(),$1,$2,'Revision bound '||n,'Bound fixture','exact',(8000000000::bigint+n)::text,10,10,$3,$3 FROM generate_series(1,2049) n`,
      [nodeId, installation, r1.createdBy],
    );
    try {
      const requestId = randomUUID();
      const limited = await direct(a, path, 'POST', { requestId });
      assert.equal(limited.status, 409, JSON.stringify(limited));
      assert.equal(limited.data.reason, 'snapshot_limit');
      assert.equal(
        (await direct(b, path + '/receipts/' + requestId)).status,
        404,
      );
    } finally {
      await owner.query(
        `UPDATE public.number_reservations SET removed_at=clock_timestamp(),version=version+1 WHERE node_id=$1 AND name LIKE 'Revision bound %' AND removed_at IS NULL`,
        [nodeId],
      );
    }
    for (let i = 0; i < 25; i++) await capture();
    const deepLink = `/pbx-nodes/${nodeId}/revisions`;
    const entry = await context.request.get(config.origin + deepLink, {
      headers: { cookie: '', 'sec-fetch-site': 'none' },
      maxRedirects: 0,
    });
    assert.equal(entry.status(), 307);
    assert.equal(
      new URL(entry.headers().location, config.origin).searchParams.get(
        'returnTo',
      ),
      deepLink,
    );
    // Actual HTTPS UI navigation, validation, baseline comparison and response-loss recovery.
    await page.goto(`${config.origin}/pbx-nodes/${nodeId}`);
    await page
      .getByRole('link', { name: 'Configuration revisions', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Configuration revisions',
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Next revisions', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Previous revisions', exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole('button', { name: 'Next revisions', exact: true }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Previous revisions', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Next revisions', exact: true }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: 'Capture desired state', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Validate offline', exact: true }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Validate offline', exact: true })
      .click();
    await expect(page.getByText(/Local validation: passed/)).toBeVisible();
    await page.getByLabel('Captured baseline').selectOption(r1.id);
    await page
      .getByRole('button', { name: 'Compare baseline', exact: true })
      .click();
    await expect(page.getByText(/fields:.*timeout/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Apply unavailable' }),
    ).toBeDisabled();
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    assert.deepEqual(violations, []);
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByRole('button', { name: 'Reload revisions', exact: true })
      .focus();
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('button', { name: 'Reload revisions', exact: true }),
    ).toBeEnabled();
    const gate = holdResponse('POST', path);
    await page
      .getByRole('button', { name: 'Capture desired state', exact: true })
      .click();
    await gate.reached;
    await expect(
      page.getByRole('button', {
        name: 'Recover capture receipt',
        exact: true,
      }),
    ).toBeEnabled({ timeout: 15000 });
    gate.release();
    await expire('idle');
    await page
      .getByRole('button', { name: 'Recover capture receipt', exact: true })
      .click();
    await expect(
      page.getByRole('heading', {
        name: 'Platform console sign-in',
        exact: true,
      }),
    ).toBeVisible();
    await login();
    await expect(
      page.getByRole('button', {
        name: 'Recover capture receipt',
        exact: true,
      }),
    ).toBeEnabled();
    await expect(page.getByLabel('Captured baseline')).toHaveValue(r1.id);
    await page
      .getByRole('button', { name: 'Recover capture receipt', exact: true })
      .click();
    await expect(
      page.getByText('Recovered the exact capture receipt.'),
    ).toBeVisible();
    // A completed authorization reply cannot dispatch a write from an unmounted page.
    const writeCounts = async () =>
      (
        await owner.query(
          `SELECT (SELECT count(*)::integer FROM public.pbx_revisions WHERE node_id=$1) AS revisions,(SELECT count(*)::integer FROM public.pbx_revision_validations v JOIN public.pbx_revisions r ON r.id=v.revision_id WHERE r.node_id=$1) AS validations`,
          [nodeId],
        )
      ).rows[0];
    for (const action of ['Capture desired state', 'Validate offline']) {
      await page.waitForLoadState('networkidle');
      const before = await writeCounts();
      const authGate = holdResponse('GET', '/platform/auth/session');
      await page.getByRole('button', { name: action, exact: true }).click();
      await authGate.reached;
      await page.goBack();
      await expect(
        page.getByRole('heading', {
          name: 'Configuration revisions',
          exact: true,
          includeHidden: true,
        }),
      ).toHaveCount(0);
      authGate.release();
      await page.waitForLoadState('networkidle');
      assert.deepEqual(await writeCounts(), before);
      await page
        .getByRole('link', { name: 'Configuration revisions', exact: true })
        .click();
      await expect(
        page.getByRole('button', { name: 'Validate offline', exact: true }),
      ).toBeVisible();
    }
    assert.equal((await direct(b, path)).status, 200);
    const liveRevision = await capture();
    await checkPbxLiveIntent({
      request,
      direct,
      owner,
      nodeId,
      a,
      b,
      revision: liveRevision,
      extensionId: extension.id,
    });
    await checkLiveBrowser({
      request,
      direct,
      owner,
      page,
      config,
      a,
      b,
      holdResponse,
      expire,
      login,
      issue,
      staffFacts,
      select,
    });
    console.log(
      'PASS revisions A-01–05: immutable atomic capture/receipt/audit rollback, real concurrent edit, cross-replica retry, exact references, redacted semantic diff, stale offline validation, authority/CSRF, history, actual HTTPS review and lost-response receipt recovery, axe/reflow/keyboard; offline saves have no effects, explicit live fixture application/recovery is reported separately above',
    );
  } catch (e) {
    console.error(
      'Revision acceptance failure',
      JSON.stringify({
        location: e?.stack
          ?.split('\n')
          .find((l) => /check-pbx-revisions\.mjs:\d+/.test(l))
          ?.trim(),
        actual: ['number', 'boolean'].includes(typeof e?.actual)
          ? e.actual
          : undefined,
        expected: ['number', 'boolean'].includes(typeof e?.expected)
          ? e.expected
          : undefined,
        code: /^[A-Z0-9]{5}$/.test(e?.code ?? '') ? e.code : undefined,
      }),
    );
    throw e;
  }
}
