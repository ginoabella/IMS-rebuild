import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type {
  PbxObservationFailure,
  PbxRegistrationFact,
} from '@myims/contracts';
import { Transaction } from '../../../../infrastructure/database/transaction';
import { SafeLogger } from '../../../../infrastructure/execution/logging';
import type { PbxNodeDto } from '@myims/contracts';
import type { PbxDesiredChangePort } from '../../application/pbx-ports';
import type {
  PbxOwnership,
  PbxOwnershipToken,
  ObservationTarget,
} from '../../application/observation-ports';
import type { ObservationSettings } from '../../domain/observation-settings';

/** Registry -> observation -> ownership, also used by the HTTP edit hook. */
export async function lockObservation(tx: Transaction, nodeId: string) {
  const desired = await tx.query<{ version: number }>(
    'SELECT version FROM public.pbx_nodes WHERE id=$1 FOR UPDATE',
    [nodeId],
  );
  if (!desired.rows[0]) return null;
  await tx.query(
    'SELECT node_id FROM public.pbx_observations WHERE node_id=$1 FOR UPDATE',
    [nodeId],
  );
  await tx.query(
    'SELECT node_id FROM public.pbx_ownership WHERE node_id=$1 FOR UPDATE',
    [nodeId],
  );
  return desired.rows[0].version;
}
export class ObservationDesiredChanges implements PbxDesiredChangePort {
  async onCreate(tx: Transaction, node: PbxNodeDto) {
    await tx.query(
      'INSERT INTO public.pbx_observations(node_id,desired_version) VALUES($1,$2)',
      [node.id, node.version],
    );
    await tx.query(
      'INSERT INTO public.pbx_ownership(node_id,desired_version) VALUES($1,$2)',
      [node.id, node.version],
    );
  }
  async onChange(
    tx: Transaction,
    change: {
      nodeId: string;
      previousVersion: number;
      nextVersion: number;
      connectivityChanged: boolean;
    },
  ) {
    await lockObservation(tx, change.nodeId);
    if (change.connectivityChanged) {
      await tx.query(
        `UPDATE public.pbx_observations SET desired_version=$2,connection='unknown',reconciliation='reconciling',failure=NULL,coverage='unknown',updated_at=clock_timestamp() WHERE node_id=$1`,
        [change.nodeId, change.nextVersion],
      );
      await tx.query(
        `UPDATE public.pbx_ownership SET desired_version=$2,incarnation=NULL,expires_at='-infinity' WHERE node_id=$1`,
        [change.nodeId, change.nextVersion],
      );
    } else {
      await tx.query(
        'UPDATE public.pbx_observations SET desired_version=$2 WHERE node_id=$1',
        [change.nodeId, change.nextVersion],
      );
      await tx.query(
        'UPDATE public.pbx_ownership SET desired_version=$2 WHERE node_id=$1',
        [change.nodeId, change.nextVersion],
      );
    }
  }
}
class FenceExpired extends Error {}
class PublicationCancelled extends Error {}
export class ObservationRepository implements PbxOwnership {
  private readonly pool: Pool;
  constructor(
    url: string,
    private readonly settings: Readonly<ObservationSettings>,
    private readonly logger = new SafeLogger('telephony'),
  ) {
    this.pool = new Pool({
      connectionString: url,
      max: 4,
      connectionTimeoutMillis: settings.databaseMs,
      statement_timeout: settings.databaseMs,
      lock_timeout: settings.databaseMs,
      idle_in_transaction_session_timeout: 5000,
    });
    this.pool.on('error', () => {});
    this.pool.on('connect', (client) => client.on('error', () => {}));
  }
  private async run<T>(
    nodeId: string,
    incarnation: string,
    action: (tx: Transaction) => Promise<T>,
    epoch?: string,
  ) {
    const correlationId = randomUUID();
    const diagnostic = (
      outcome: 'committed' | 'failed',
      generation?: string,
      error?: unknown,
    ) => {
      try {
        this.logger.write({
          operation: 'telephony.ownership',
          correlationId,
          outcome,
          actorKind: 'system',
          actorReference: incarnation,
          targetReference: nodeId,
          ...(generation ? { workId: `epoch-${generation}` } : {}),
          ...(error ? { error } : {}),
        });
      } catch {
        /* Logging cannot change a committed or rejected outcome. */
      }
    };
    try {
      const result = await Transaction.run(
        this.pool,
        {
          actor: {
            kind: 'system',
            plane: 'system',
            reference: incarnation,
            tenantId: null,
            reason: 'pbx-observation',
          },
          target: { type: 'pbx-node', reference: nodeId, tenantId: null },
          correlationId,
        },
        'telephony.observation',
        this.logger,
        action,
      );
      const generation =
        epoch ??
        (result &&
        typeof result === 'object' &&
        'epoch' in result &&
        typeof result.epoch === 'string'
          ? result.epoch
          : undefined);
      diagnostic('committed', generation);
      return result;
    } catch (error) {
      diagnostic('failed', epoch, error);
      throw error;
    }
  }
  async discover(after: string | null = null): Promise<ObservationTarget[]> {
    const r = await this.pool.query(
      'SELECT id,version,installation_id,target_alias,credential_alias FROM public.pbx_nodes WHERE ($1::uuid IS NULL OR id>$1) ORDER BY id LIMIT 100',
      [after],
    );
    return r.rows.map((row) => ({
      id: row.id,
      version: row.version,
      installationId: row.installation_id,
      targetAlias: row.target_alias,
      credentialAlias: row.credential_alias,
    }));
  }
  async acquire(
    nodeId: string,
    incarnation: string,
  ): Promise<PbxOwnershipToken | null> {
    return this.run(nodeId, incarnation, async (tx) => {
      const version = await lockObservation(tx, nodeId);
      if (!version) return null;
      // Reacquisition, even by the same incarnation after expiry, is a new epoch.
      const r = await tx.query<{ epoch: string }>(
        `UPDATE public.pbx_ownership SET incarnation=$2,epoch=epoch+1,desired_version=$3,expires_at=clock_timestamp()+$4*interval '1 millisecond' WHERE node_id=$1 AND expires_at<=clock_timestamp() RETURNING epoch`,
        [nodeId, incarnation, version, this.settings.leaseMs],
      );
      if (!r.rows[0]) return null;
      await tx.query(
        `UPDATE public.pbx_observations SET desired_version=$2,epoch=$3,sequence=0,connection='unknown',reconciliation='reconciling',failure=NULL,coverage='unknown',updated_at=clock_timestamp() WHERE node_id=$1`,
        [nodeId, version, r.rows[0].epoch],
      );
      return {
        nodeId,
        incarnation,
        epoch: r.rows[0].epoch,
        desiredVersion: version,
      };
    });
  }
  async renew(t: PbxOwnershipToken) {
    return this.run(
      t.nodeId,
      t.incarnation,
      async (tx) => {
        const version = await lockObservation(tx, t.nodeId);
        const r = await tx.query(
          `UPDATE public.pbx_ownership SET expires_at=clock_timestamp()+$4*interval '1 millisecond' WHERE node_id=$1 AND incarnation=$2 AND epoch=$3 AND desired_version=$5 AND expires_at>clock_timestamp() RETURNING epoch`,
          [t.nodeId, t.incarnation, t.epoch, this.settings.leaseMs, version],
        );
        return r.rows[0] && version ? { ...t, desiredVersion: version } : null;
      },
      t.epoch,
    );
  }
  async release(t: PbxOwnershipToken) {
    return this.run(
      t.nodeId,
      t.incarnation,
      async (tx) => {
        await lockObservation(tx, t.nodeId);
        const r = await tx.query(
          `UPDATE public.pbx_ownership SET incarnation=NULL,expires_at='-infinity' WHERE node_id=$1 AND incarnation=$2 AND epoch=$3 RETURNING node_id`,
          [t.nodeId, t.incarnation, t.epoch],
        );
        if (r.rows[0])
          await tx.query(
            `UPDATE public.pbx_observations SET connection='disconnected',reconciliation='reconciling',failure='ownership_lost',updated_at=clock_timestamp() WHERE node_id=$1`,
            [t.nodeId],
          );
        return !!r.rows[0];
      },
      t.epoch,
    );
  }
  /** Must run on the very transaction that writes a callback or durable intent. */
  async fenced<T>(
    t: PbxOwnershipToken,
    action: (tx: Transaction) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<{ accepted: false } | { accepted: true; value: T }> {
    try {
      return await this.run(
        t.nodeId,
        t.incarnation,
        async (tx) => {
          if (signal?.aborted) throw new PublicationCancelled();
          const version = await lockObservation(tx, t.nodeId);
          if (signal?.aborted) throw new PublicationCancelled();
          if (version !== t.desiredVersion) return { accepted: false };
          const r = await tx.query(
            `SELECT node_id FROM public.pbx_ownership WHERE node_id=$1 AND incarnation=$2 AND epoch=$3 AND desired_version=$4 AND expires_at>clock_timestamp()`,
            [t.nodeId, t.incarnation, t.epoch, t.desiredVersion],
          );
          if (!r.rows[0]) return { accepted: false };
          const value = await tx.required(() => action(tx));
          if (signal?.aborted) throw new PublicationCancelled();
          const final = await tx.query(
            'SELECT node_id FROM public.pbx_ownership WHERE node_id=$1 AND expires_at>clock_timestamp()',
            [t.nodeId],
          );
          if (!final.rows[0]) throw new FenceExpired();
          if (signal?.aborted) throw new PublicationCancelled();
          return { accepted: true, value };
        },
        t.epoch,
      );
    } catch (error) {
      if (
        error instanceof FenceExpired ||
        error instanceof PublicationCancelled
      )
        return { accepted: false };
      throw error;
    }
  }
  async verify(t: PbxOwnershipToken) {
    return (await this.fenced(t, async () => true)).accepted;
  }
  async publish(
    t: PbxOwnershipToken,
    sequence: number,
    registrations: PbxRegistrationFact[],
    signal?: AbortSignal,
  ) {
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 1 ||
      registrations.length > this.settings.endpoints ||
      registrations.some(
        (f) =>
          !/^[a-zA-Z0-9_.:-]{1,128}$/.test(f.endpoint) ||
          typeof f.registered !== 'boolean' ||
          !Number.isInteger(f.contacts) ||
          f.contacts < 0 ||
          f.contacts > this.settings.contacts ||
          !Number.isInteger(f.reachableContacts) ||
          f.reachableContacts < 0 ||
          f.reachableContacts > f.contacts ||
          f.registered !== f.contacts > 0,
      ) ||
      new Set(registrations.map((f) => f.endpoint)).size !==
        registrations.length ||
      registrations.reduce((n, f) => n + f.contacts, 0) > this.settings.contacts
    )
      throw new Error('Invalid bounded observation');
    const result = await this.fenced(
      t,
      async (tx) => {
        const r = await tx.query(
          `UPDATE public.pbx_observations SET sequence=$2,last_success_at=clock_timestamp(),connection='reachable',reconciliation='complete',failure=NULL,coverage='pjsip-dynamic-contacts',registrations=$3::jsonb,updated_at=clock_timestamp() WHERE node_id=$1 AND epoch=$4 AND desired_version=$5 AND sequence=$2-1 RETURNING node_id`,
          [
            t.nodeId,
            sequence,
            JSON.stringify(
              registrations.map((f) => ({
                endpoint: f.endpoint,
                registered: f.registered,
                contacts: f.contacts,
                reachableContacts: f.reachableContacts,
              })),
            ),
            t.epoch,
            t.desiredVersion,
          ],
        );
        return !!r.rows[0];
      },
      signal,
    );
    return result.accepted && result.value;
  }
  async fail(t: PbxOwnershipToken, failure: PbxObservationFailure) {
    return (
      await this.fenced(t, async (tx) => {
        await tx.query(
          `UPDATE public.pbx_observations SET connection='disconnected',reconciliation='reconciling',failure=$2,updated_at=clock_timestamp() WHERE node_id=$1`,
          [t.nodeId, failure],
        );
      })
    ).accepted;
  }
  async close() {
    await this.pool.end();
  }
}
