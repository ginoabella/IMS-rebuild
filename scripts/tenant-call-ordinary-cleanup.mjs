// Reviewed ordinary cleanup/reuse controls; canonical resources and bytes are retained.
import assert from 'node:assert/strict';
import { expect as baseExpect } from '@playwright/test';
import { setOrdinaryExtensionStatus } from './tenant-call-ordinary-transfer.mjs';
const expect = baseExpect.configure({ timeout: 30000 });
export async function setControlledResourceState(s, enabled) {
  const { page, p, origin, resources, query, button, journal, save } = s;
  const [event] = await query(
    'SELECT action FROM public.tenant_call_preparation_events WHERE preparation_id=$1 ORDER BY version DESC LIMIT 1',
    [p.requestId],
  );
  assert.equal(event?.action, 'stop');
  journal.controlledStates = [];
  for (let i = 0; i < resources.extensionIds.length; i++) {
    const id = resources.extensionIds[i],
      number = i < 2 ? p.tenants[i].extensionNumber : p.unallocatedNumber;
    const [stock] = await query(
      'SELECT administrative_status FROM public.extensions WHERE id=$1 AND node_id=$2',
      [id, p.nodeId],
    );
    const status = enabled ? 'enabled' : 'disabled';
    if (stock?.administrative_status !== status)
      await setOrdinaryExtensionStatus(s, id, number, status);
    journal.controlledStates.push({ kind: 'extension', id, status });
    save();
  }
  for (const [kind, id, label] of [
    ['gateways', resources.gatewayId, 'gateway'],
    ['trunks', resources.trunkId, 'trunk'],
  ]) {
    const [peer] = await query(
      kind === 'gateways'
        ? 'SELECT enabled FROM public.sip_gateways WHERE id=$1 AND node_id=$2 AND removed_at IS NULL'
        : 'SELECT enabled FROM public.sip_trunks WHERE id=$1 AND node_id=$2 AND removed_at IS NULL',
      [id, p.nodeId],
    );
    assert.ok(peer);
    if (peer.enabled !== enabled) {
      await page.goto(
        `${origin}/pbx-nodes/${p.nodeId}/peers?kind=${kind}&resource=${id}`,
      );
      await button(`${enabled ? 'Enable' : 'Disable'} ${label}`).click();
      await expect
        .poll(
          async () =>
            (
              await query(
                kind === 'gateways'
                  ? 'SELECT enabled FROM public.sip_gateways WHERE id=$1'
                  : 'SELECT enabled FROM public.sip_trunks WHERE id=$1',
                [id],
              )
            )[0]?.enabled,
        )
        .toBe(enabled);
    }
    journal.controlledStates.push({ kind, id, enabled });
    save();
  }
}
export async function restoreControlledGraph(s) {
  const { p, tenants, resources, query, openTenant, bind, apply } = s;
  await setControlledResourceState(s, true);
  for (let i = 0; i < tenants.length; i++) {
    const tenant = tenants[i];
    await openTenant(tenant);
    const [did] = await query(
      'SELECT id FROM public.sip_dids WHERE node_id=$1 AND number=$2 AND removed_at IS NULL',
      [p.nodeId, p.tenants[i].inboundNumber],
    );
    assert.ok(did);
    await bind('inbound', 'dids', did.id);
    const rules = await query(
      'SELECT id FROM public.inbound_rules WHERE node_id=$1 AND did_id=$2 AND removed_at IS NULL',
      [p.nodeId, did.id],
    );
    assert.equal(rules.length, 1);
    await bind('inbound', 'inbound', rules[0].id);
    if (i === 0) await bind('outbound', 'trunks', resources.trunkId, 'shared');
    await bind('outbound', 'permission', resources.trunkId);
    const [outgoing] = await query(
      'SELECT id FROM public.outbound_rules WHERE node_id=$1 AND pattern_kind=$2 AND digits=$3 AND removed_at IS NULL',
      [p.nodeId, 'exact', p.tenants[i].outboundNumber],
    );
    assert.ok(outgoing);
    await bind('outbound', 'outbound', outgoing.id);
  }
  await apply();
}
