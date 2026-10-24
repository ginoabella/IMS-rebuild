import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { expect as baseExpect } from '@playwright/test';
const expect = baseExpect.configure({ timeout: 20000 });
/** One operator traverses the actual group → inbound → outbound graph and removes dependencies. */
export async function checkIntegratedRouting({
  page,
  config,
  nodeId,
  e1,
  create,
  request,
  owner,
}) {
  console.log(
    'CHECK integrated routing: group → inbound → outbound → reservation and ordered removal',
  );
  const root = `/platform/pbx-nodes/${nodeId}`;
  const trunk = await create(`${root}/peers/trunks`, {
    requestId: randomUUID(),
    name: 'Integrated trunk',
    direction: 'both',
    settings: {
      host: 'integrated.invalid',
      port: 5060,
      transport: 'udp',
      media: 'rtp',
      codecs: ['ulaw'],
      directMedia: false,
      rtpSymmetric: true,
      forceRport: true,
      authentication: 'ip-peer',
    },
  });
  const gateway = await create(`${root}/peers/gateways`, {
    requestId: randomUUID(),
    name: 'Integrated gateway',
    kind: 'sip-device',
    trunkId: null,
    sourceAddresses: ['192.0.2.240'],
  });
  const did = await create(`${root}/peers/dids`, {
    requestId: randomUUID(),
    name: 'Integrated DID',
    number: '700000000001',
    gatewayId: gateway.id,
  });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const detail = page.getByRole('region', {
    name: 'Resource detail',
    exact: true,
  });
  const named = async (name) =>
    (
      await owner.query(
        'SELECT id FROM public.' +
          (name === 'Integrated group'
            ? 'ring_groups'
            : name === 'Integrated inbound'
              ? 'inbound_rules'
              : 'outbound_rules') +
          ' WHERE name=$1 AND removed_at IS NULL',
        [name],
      )
    ).rows[0].id;
  async function inspect(name) {
    for (let i = 0; i < 24; i++) {
      await expect
        .poll(
          async () =>
            (await button('Inspect ' + name).isVisible()) ||
            (await button('Next page').isEnabled()),
        )
        .toBe(true);
      if (await button('Inspect ' + name).isVisible()) {
        await button('Inspect ' + name).click();
        return;
      }
      const old = await page
        .getByRole('button', { name: /^Inspect / })
        .allTextContents();
      await button('Next page').click();
      await expect
        .poll(() =>
          page.getByRole('button', { name: /^Inspect / }).allTextContents(),
        )
        .not.toEqual(old);
    }
    throw new Error('Integrated resource not found: ' + name);
  }
  async function choose(label, id, more) {
    const select = page.getByLabel(label, { exact: false });
    await expect
      .poll(() => select.locator('option').count())
      .toBeGreaterThan(1);
    while (!(await select.locator(`option[value="${id}"]`).count())) {
      await expect(button(more)).toBeVisible();
      const before = await select.locator('option').count();
      await button(more).click();
      await expect
        .poll(() => select.locator('option').count())
        .toBeGreaterThan(before);
    }
    await select.selectOption(id);
  }
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}/routing`);
  await button('Create group').click();
  await page.getByLabel(/^Name/).fill('Integrated group');
  await choose('Add inventory member', e1.id, 'More extensions');
  await button('Add member').click();
  await button('Save group').click();
  await expect(detail).toContainText('Integrated group');
  const groupId = await named('Integrated group');
  await button('Edit group').click();
  await button('Preview group').click();
  await expect(page.getByText(/Advisory preview: 1 attempt/)).toBeVisible();
  await button('Cancel edit').click();
  await button('Enable group').click();
  await expect(button('Disable group')).toBeVisible();
  await button('Inbound rules').click();
  await button('Create inbound rule').click();
  await page.getByLabel(/^Name/).fill('Integrated inbound');
  await choose('Trusted gateway', gateway.id, 'More gateways');
  await choose('DID selector', did.id, 'More DIDs');
  await page
    .getByLabel('Inbound destination', { exact: false })
    .selectOption('group');
  await choose('Destination resource', groupId, 'More groups');
  await button('Save inbound rule').click();
  await expect(detail).toContainText('Integrated inbound');
  await button('Enable inbound rule').click();
  await expect(button('Disable inbound rule')).toBeVisible();
  await page
    .getByLabel('Sample dialled number', { exact: false })
    .fill(did.number);
  await button('Preview inbound match').click();
  await expect(
    page.getByRole('status').filter({ hasText: 'matched · exact' }),
  ).toBeVisible();
  await button('Outbound rules').click();
  await button('Create outbound rule').click();
  await page.getByLabel(/^Name/).fill('Integrated outbound');
  await page.getByLabel('ASCII digits').fill('69001');
  await choose('Outbound trunk', trunk.id, 'More trunks');
  await button('Save outbound rule').click();
  await expect(detail).toContainText('Integrated outbound');
  await button('Enable outbound rule').click();
  await expect(button('Disable outbound rule')).toBeVisible();
  await page.getByLabel('Sample outbound number').fill('69001');
  await button('Preview outbound match').click();
  await expect(
    page.getByText(
      /unavailable trunk.*Integrated outbound.*priority 100.*69001/,
    ),
  ).toBeVisible();
  await button('Reserved numbers').click();
  await button('Create reservation').click();
  await page.getByLabel(/^Name/).fill('Integrated protection');
  await page.getByLabel(/^Purpose/).fill('Integrated passive journey');
  await page.getByLabel('ASCII digits').fill('68001');
  await button('Save reservation').click();
  await expect(detail).toContainText('Integrated protection');
  // Actual disabled outbound dependency blocks trunk removal and links back to routing.
  await button('Outbound rules').click();
  await button('Disable outbound rule').click();
  await expect(button('Enable outbound rule')).toBeVisible();
  await page.goto(`${config.origin}/pbx-nodes/${nodeId}/peers`);
  await button('Trunks').click();
  await inspect('Integrated trunk');
  await button('Remove trunk').click();
  await button('Confirm removal').click();
  const blockers = page.getByRole('region', {
    name: 'Referencing routing rules or resources',
    exact: true,
  });
  await expect(blockers).toContainText('Integrated outbound');
  await blockers
    .getByRole('link', {
      name: 'Integrated outbound · manage in routing',
      exact: true,
    })
    .click();
  await button('Outbound rules').click();
  await inspect('Integrated outbound');
  await button('Remove outbound rule').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  // Inspect the real inbound blocker before removing ingress/group dependencies.
  await button('Ring groups').click();
  await inspect('Integrated group');
  await button('Remove group').click();
  await button('Confirm removal').click();
  await expect(
    page.getByRole('region', { name: 'Dependencies', exact: true }),
  ).toContainText('Integrated inbound');
  await button('Open inbound rule Integrated inbound').click();
  await button('Disable inbound rule').click();
  await expect(button('Enable inbound rule')).toBeVisible();
  await button('Remove inbound rule').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  await button('Ring groups').click();
  await button('Disable group').click();
  await expect(button('Enable group')).toBeVisible();
  await button('Remove group').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  await button('Reserved numbers').click();
  await inspect('Integrated protection');
  await button('Remove reservation').click();
  await button('Confirm removal').click();
  await expect(detail).toContainText('Removed');
  for (const [kind, r] of [
    ['trunks', trunk],
    ['dids', did],
    ['gateways', gateway],
  ])
    assert.equal(
      (
        await request(`${root}/peers/${kind}/${r.id}/remove`, 'POST', {
          expectedVersion: 1,
        })
      ).status,
      200,
    );
  console.log(
    'PASS integrated actual HTTPS graph: group/inbound/outbound/reservation create, previews, status, disabled trunk blocker navigation, inbound blocker inspection and dependency-ordered removal; no calls/live effects.',
  );
}
