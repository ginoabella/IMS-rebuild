import { readFileSync, lstatSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { canonical } from '../../domain/revision-snapshot';
import { runtimePins } from '../../domain/runtime-pins';
import type { Transaction } from '../../../../infrastructure/database/transaction';
import type { PbxOwnershipToken } from '../../application/observation-ports';
import type { LiveExecutionStore } from './execution-store';
import type { NativeLiveApplication } from './native-application';
import {
  nativeCli,
  moduleIsRunning,
  type NativePbxDriver,
} from './native-driver';
import type { NativeAdmissionBarrier } from './admission';
import { AdmissionFailure } from './admission';
import { ProtectedArtifactStore } from './artifact-store';
import { RetainedLivePlans } from './retained-plans';
import {
  ProtectedStaticProfiles,
  selectedStaticProfile,
  staticDigest,
  durableJson,
} from './static-profiles';
import { protectedLiveBytes } from './configuration';
import {
  materializeRevision,
  runtimeNames,
  type LiveMaterial,
} from './materialize';
import { AuditRepository } from '../../../audit/adapters/db/audit-repository';
interface ProfileIntent {
  id: string;
  node_id: string;
  installation_id: string;
  kind: 'upgrade' | 'rollback';
  predecessor_id: string | null;
  source_artifact_id: string;
  source_digest: string;
  target_artifact_id: string;
  target_digest: string;
  source_revision_id: string | null;
  expected_node_version: number;
  fingerprint: string;
  state: string;
}
const additions = [
  'bridge_simple',
  'res_speech',
  'res_agi',
  'func_channel',
  'res_pjsip_header_funcs',
  'res_pjsip_endpoint_identifier_ip',
];
export const profileAudit = {
  type: 'telephony.profile.transition',
  version: 1,
  fields: {
    operationId: { kind: 'uuid' as const },
    nodeId: { kind: 'uuid' as const },
    action: {
      kind: 'enum' as const,
      values: [
        'queued',
        'preparing',
        'prepared',
        'restart_dispatched',
        'verified',
        'rolled_back',
        'unknown',
      ],
    },
  },
};
/** The existing native owner is the sole selector. Unknown work is inspected, never replayed. */
export class NativeProfileTransitions {
  private readonly plans: RetainedLivePlans;
  private readonly profiles: ProtectedStaticProfiles;
  private busy = false;
  private verifiedBoot: string | null = null;
  constructor(
    private readonly root: string,
    private readonly nodeId: string,
    private readonly installationId: string,
    private readonly store: LiveExecutionStore,
    private readonly driver: NativePbxDriver,
    private readonly admission: NativeAdmissionBarrier,
    private readonly artifacts: ProtectedArtifactStore,
    private readonly application: NativeLiveApplication,
  ) {
    this.plans = new RetainedLivePlans(root, nodeId, installationId);
    const gid = Number(
      readFileSync('/etc/group', 'utf8')
        .split('\n')
        .find((l) => l.startsWith('asterisk:'))
        ?.split(':')[2],
    );
    this.profiles = new ProtectedStaticProfiles(root, gid);
    mkdirSync(join(root, 'profile-operations'), {
      recursive: true,
      mode: 0o700,
    });
    const stat = lstatSync(join(root, 'profile-operations'));
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== 0 ||
      stat.mode & 0o077
    )
      throw new Error('Profile custody unavailable');
    const processStat = readFileSync('/proc/self/stat', 'utf8');
    durableJson(join(root, 'profile-executor.json'), {
      version: 1,
      nodeId,
      installationId,
      pid: process.pid,
      startTicks: processStat
        .slice(processStat.lastIndexOf(')') + 2)
        .split(' ')[19],
      startedAt: new Date().toISOString(),
    });
  }
  private async phase(
    token: PbxOwnershipToken,
    row: ProfileIntent,
    state: string,
    failure: string | null = null,
  ) {
    const result = await this.store.ownership.fenced(token, async (tx) => {
      const changed = await tx.query(
        `UPDATE public.pbx_profile_progress p SET state=$3,failure=$4,owner_epoch=$5,updated_at=clock_timestamp()
        FROM public.pbx_live_runtime r WHERE p.operation_id=$2 AND r.node_id=$1 AND r.active_profile_operation_id=p.operation_id RETURNING p.operation_id`,
        [this.nodeId, row.id, state, failure, token.epoch],
      );
      if (!changed.rows.length) throw new Error('Profile intent changed');
      await new AuditRepository().append(tx, profileAudit, {
        operationId: row.id,
        nodeId: this.nodeId,
        action: state,
      });
    });
    if (!result.accepted) throw new Error('Profile owner expired');
  }
  private recordPending(operationId: string, completed = false) {
    let selectionRequired = false;
    try {
      const previous = JSON.parse(
        protectedLiveBytes(
          join(this.root, 'profile-pending.json'),
          1024,
        ).toString('utf8'),
      ) as { selectionRequired: unknown };
      if (typeof previous.selectionRequired !== 'boolean')
        throw new Error('Profile selection provenance unavailable');
      selectionRequired = previous.selectionRequired;
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
    durableJson(join(this.root, 'profile-pending.json'), {
      operationId,
      selectionRequired:
        selectionRequired || selectedStaticProfile(this.root) !== null,
      ...(completed ? { completed: true } : {}),
    });
  }
  private profile(digest: string) {
    try {
      return this.profiles.load(digest);
    } catch (e) {
      if (!(e && typeof e === 'object' && 'code' in e && e.code === 'ENOENT'))
        throw e;
      const original = this.profiles.readDirectory('/etc/asterisk');
      if (staticDigest(original) !== digest)
        throw new Error('Historical static profile unavailable', { cause: e });
      this.profiles.stage(original);
      return original;
    }
  }
  private material(artifactId: string): LiveMaterial {
    const plan = this.plans.load(artifactId),
      files = this.artifacts.load(plan.identity);
    const sections = new Map<string, Record<string, string>>();
    let section: Record<string, string> | undefined;
    for (const line of files.pjsip.toString('utf8').split('\n')) {
      const heading = /^\[([a-zA-Z0-9_.:-]{1,128})\]$/.exec(line);
      if (heading) {
        section = {};
        sections.set(heading[1]!, section);
        continue;
      }
      const pair = /^([a-z_]+)=(.*)$/.exec(line);
      if (pair && section) section[pair[1]!] = pair[2]!;
    }
    const material: LiveMaterial = { endpoints: new Map(), trunks: new Map() };
    for (const endpoint of plan.snapshot.extensions.filter(
      (e) => e.administrativeStatus === 'enabled',
    )) {
      const auth = sections.get(endpoint.authKey);
      if (
        !endpoint.generationId ||
        !auth?.password ||
        auth.username !== endpoint.endpointKey
      )
        throw new Error('Exact protected endpoint material unavailable');
      material.endpoints.set(endpoint.generationId, {
        password: auth.password,
      });
    }
    const names = runtimeNames(plan.snapshot, artifactId);
    for (const trunk of plan.snapshot.trunks) {
      const credential = trunk.settings.credential;
      if (!credential) continue;
      const auth = sections.get(names.trunk(trunk.id) + '-auth');
      if (!auth?.username || !auth.password || !auth.realm)
        throw new Error('Exact protected trunk material unavailable');
      material.trunks.set(credential.id + ':' + credential.version, {
        username: auth.username,
        password: auth.password,
        realm: auth.realm,
      });
    }
    return material;
  }
  private async canonicalCustody(tx: Pick<Transaction, 'query'>) {
    const artifacts = (
      await tx.query<{
        id: string;
        revision_id: string | null;
        initial_baseline: boolean;
        operation_id: string | null;
        compiler_version: string | null;
        policy_version: string | null;
        source_digest: string | null;
      }>(
        `SELECT a.id,a.revision_id,a.initial_baseline,a.operation_id,v.compiler_version,v.policy_version,v.source_digest FROM public.pbx_live_artifacts a LEFT JOIN public.pbx_revisions v ON v.id=a.revision_id WHERE a.node_id=$1 AND NOT EXISTS(SELECT 1 FROM public.pbx_artifact_retirements t WHERE t.artifact_id=a.id) ORDER BY a.id LIMIT 2049`,
        [this.nodeId],
      )
    ).rows;
    const pins = (
      await tx.query<{
        revision_id: string;
        kind: string;
        resource_id: string;
        version: number;
        material_kind: string | null;
        material_version: number | null;
      }>(
        'SELECT revision_id,kind,resource_id,version,material_kind,material_version FROM public.pbx_live_pins WHERE node_id=$1 AND released_at IS NULL LIMIT 2049',
        [this.nodeId],
      )
    ).rows;
    const operations = (
      await tx.query<{
        id: string;
        predecessor_id: string | null;
        sequence: number;
        installation_id: string;
      }>(
        'SELECT id,predecessor_id,sequence,installation_id FROM public.pbx_live_operations WHERE node_id=$1 LIMIT 2049',
        [this.nodeId],
      )
    ).rows;
    if ([artifacts, pins, operations].some((rows) => rows.length > 2048))
      throw new Error('Recovery inventory unavailable');
    for (const artifact of artifacts) {
      const plan = this.plans.load(artifact.id);
      this.artifacts.load(plan.identity);
      this.profiles.verifyProjection(plan.unmanaged);
      if (!artifact.initial_baseline) {
        if (
          plan.identity.compilerVersion !== artifact.compiler_version ||
          plan.identity.policyVersion !== artifact.policy_version ||
          plan.identity.sourceDigest !== artifact.source_digest ||
          createHash('sha256')
            .update(canonical(plan.snapshot))
            .digest('hex') !== artifact.source_digest
        )
          throw new Error('Recovery provenance unavailable');
        for (const entry of runtimePins(plan.snapshot)) {
          const endpoint =
            'purpose' in entry.value && entry.value.purpose === 'endpoint';
          const pin = pins.find(
            (p) =>
              p.revision_id === artifact.revision_id &&
              p.kind === entry.kind &&
              p.resource_id === entry.value.id &&
              p.version === entry.value.version,
          );
          if (
            !pin ||
            (entry.kind === 'credentials' &&
              (pin.material_kind !== (endpoint ? 'endpoint' : 'trunk') ||
                pin.material_version !== (endpoint ? 1 : entry.value.version)))
          )
            throw new Error('Recovery pin unavailable');
        }
      }
      const seen = new Set<string>();
      let parent = artifact.operation_id,
        sequence = Infinity;
      while (parent) {
        const operation = operations.find((o) => o.id === parent);
        if (
          !operation ||
          operation.installation_id !== this.installationId ||
          operation.sequence >= sequence ||
          seen.has(parent) ||
          seen.size >= 128
        )
          throw new Error('Recovery ancestry unavailable');
        seen.add(parent);
        sequence = operation.sequence;
        parent = operation.predecessor_id;
      }
    }
  }
  private async prepare(
    token: PbxOwnershipToken,
    row: ProfileIntent,
    guard: () => Promise<void>,
  ) {
    await this.application.originalCustody();
    if (token.desiredVersion !== row.expected_node_version)
      throw new Error('Profile node version changed');
    const source = this.plans.load(row.source_artifact_id);
    if (source.unmanaged !== row.source_digest)
      throw new Error('Profile source changed');
    if (!/\bAsterisk 22\.10\.1\b/.test(await nativeCli('core show version')))
      throw new Error('Runtime version unavailable');
    if (row.kind === 'upgrade') {
      await this.driver.verify(
        source.identity,
        source.snapshot,
        source.unmanaged,
      );
      if (
        source.identity.compilerVersion !== 'review-2' ||
        source.identity.policyVersion !== 'deny-unbound-1' ||
        !row.source_revision_id
      )
        throw new Error('Unsupported retained upgrade source');
    }
    await this.admission.begin(
      Date.now() + 120000,
      AbortSignal.timeout(120000),
      guard,
    );
    await guard();
    if (row.kind === 'upgrade') await this.prove(row.source_artifact_id, guard);
    const original = this.profile(row.source_digest);
    if (row.kind === 'upgrade') {
      const modules = original.get('modules.conf')!.toString('utf8');
      if (
        !/^autoload\s*=\s*no\s*$/m.test(modules) ||
        /^load\s*=\s*bridge_native_rtp\.so\s*$/m.test(modules)
      )
        throw new Error('Explicit anchored profile required');
      const next = new Map(original);
      const missing = additions.filter(
        (m) =>
          !new RegExp('^load\\s*=\\s*' + m + '\\.so\\s*$', 'm').test(modules),
      );
      if (!missing.length) throw new Error('No supported profile change');
      next.set(
        'modules.conf',
        Buffer.concat([
          original.get('modules.conf')!,
          Buffer.from(
            '\n' + missing.map((m) => 'load = ' + m + '.so').join('\n') + '\n',
          ),
        ]),
      );
      if (staticDigest(next) !== row.target_digest)
        throw new Error('Reviewed target profile differs');
      this.profiles.stage(next);
      this.profiles.project(row.target_digest);
      const identity = {
        ...source.identity,
        revisionId: row.target_artifact_id,
      };
      this.artifacts.stage(
        identity,
        materializeRevision(
          source.snapshot,
          identity.revisionId,
          this.material(row.source_artifact_id),
        ),
      );
      this.plans.save({
        identity,
        snapshot: source.snapshot,
        unmanaged: row.target_digest,
      });
    } else {
      const target = this.plans.load(row.target_artifact_id);
      if (target.unmanaged !== row.target_digest)
        throw new Error('Rollback profile differs');
      this.artifacts.load(target.identity);
      this.profile(row.target_digest);
      this.profiles.project(row.target_digest);
    }
    const retained = (
      await this.store.pool.query<{ id: string }>(
        `SELECT a.id FROM public.pbx_live_artifacts a LEFT JOIN public.pbx_artifact_retirements t ON t.artifact_id=a.id WHERE a.node_id=$1 AND t.artifact_id IS NULL ORDER BY a.id LIMIT 2049`,
        [this.nodeId],
      )
    ).rows;
    if (retained.length > 2048)
      throw new Error('Recovery inventory unavailable');
    for (const entry of retained) {
      const plan = this.plans.load(entry.id);
      this.artifacts.load(plan.identity);
      this.profile(plan.unmanaged);
      this.profiles.project(plan.unmanaged);
    }
    await this.store.ownership.fenced(token, async (tx) => {
      for (const entry of retained) {
        const plan = this.plans.load(entry.id);
        await tx.query(
          'INSERT INTO public.pbx_static_profiles(node_id,digest) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [this.nodeId, plan.unmanaged],
        );
        await tx.query(
          'INSERT INTO public.pbx_artifact_profiles(artifact_id,node_id,digest,operation_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [entry.id, this.nodeId, plan.unmanaged, row.id],
        );
        const found = await tx.query(
          'SELECT 1 FROM public.pbx_artifact_profiles WHERE artifact_id=$1 AND node_id=$2 AND digest=$3',
          [entry.id, this.nodeId, plan.unmanaged],
        );
        if (!found.rows.length)
          throw new Error('Historical compatibility conflict');
      }
      await tx.query(
        'INSERT INTO public.pbx_static_profiles(node_id,digest) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [this.nodeId, row.target_digest],
      );
    });
    await guard();
    const selected = await this.store.ownership.fenced(token, async (tx) => {
      const active = await tx.query(
        'SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND active_profile_operation_id=$2 FOR UPDATE',
        [this.nodeId, row.id],
      );
      if (!active.rows.length) throw new Error('Profile intent changed');
      await this.application.originalCustody();
      await this.canonicalCustody(tx);
      if (
        row.kind === 'upgrade' &&
        this.driver.unmanaged() !== row.source_digest
      )
        throw new Error('Profile drift before selection');
      await this.admission.assertClosed();
      if (!(await this.admission.idle())) throw new Error('Activity changed');
      // Canonical owner/node/runtime locks span this exact physical selection.
      this.profiles.select(row.target_digest, row.target_artifact_id);
      this.recordPending(row.id);
      this.driver.select(this.plans.load(row.target_artifact_id).identity);
      durableJson(join(this.root, 'profile-operations', row.id + '.json'), {
        fingerprint: row.fingerprint,
        stage: 'prepared',
      });
    });
    if (!selected.accepted) throw new Error('Profile selection owner expired');
    await this.phase(token, row, 'prepared');
  }
  private async prove(id: string, guard: () => Promise<void>) {
    if (!/\bAsterisk 22\.10\.1\b/.test(await nativeCli('core show version')))
      throw new Error('Runtime version unavailable');
    const artifact = this.plans.load(id);
    if (selectedStaticProfile(this.root))
      this.profiles.verifyProjection(artifact.unmanaged);
    const modules = this.profiles
      .readDirectory(this.driver.staticDirectory())
      .get('modules.conf')!
      .toString('utf8');
    const loaded = [
      ...modules.matchAll(/^load\s*=\s*([a-z0-9_]{1,64})\.so\s*$/gm),
    ];
    if (loaded.length > 128)
      throw new Error('Profile capability inventory unavailable');
    for (const match of loaded) {
      if (
        !moduleIsRunning(
          await nativeCli('module show like ' + match[1] + '.so'),
          match[1]!,
        )
      )
        throw new Error('Loaded profile capability unavailable');
    }
    if (
      /^bridge_native_rtp\.so\s/m.test(
        await nativeCli('module show like bridge_native_rtp.so'),
      )
    )
      throw new Error('Media anchoring unavailable');
    await this.driver.verify(
      artifact.identity,
      artifact.snapshot,
      artifact.unmanaged,
    );
    await this.admission.assertClosed();
    if (!(await this.admission.idle())) throw new Error('Activity unavailable');
    await guard();
    return artifact;
  }
  async tick() {
    if (this.busy) return;
    const token = this.application.profileOwner();
    if (!token) return;
    this.busy = true;
    let attempted: ProfileIntent | undefined;
    try {
      const row = (
        await this.store.pool.query<ProfileIntent>(
          `SELECT i.*,p.state FROM public.pbx_live_runtime r JOIN public.pbx_profile_operations i ON i.id=r.active_profile_operation_id JOIN public.pbx_profile_progress p ON p.operation_id=i.id WHERE r.node_id=$1`,
          [this.nodeId],
        )
      ).rows[0];
      attempted = row;
      if (!row) {
        if (!selectedStaticProfile(this.root)) {
          try {
            const pending = JSON.parse(
              protectedLiveBytes(
                join(this.root, 'profile-pending.json'),
                1024,
              ).toString('utf8'),
            ) as { selectionRequired: unknown };
            if (pending.selectionRequired !== false) return;
          } catch (error) {
            if (
              error &&
              typeof error === 'object' &&
              'code' in error &&
              error.code === 'ENOENT'
            )
              return;
            throw error;
          }
        }
        const boot = JSON.parse(
          protectedLiveBytes(
            join(this.root, 'profile-supervisor.json'),
            1024,
          ).toString('utf8'),
        ) as { bootId: string };
        if (boot.bootId === this.verifiedBoot) return;
        const current = (
          await this.store.pool.query<{ verified_id: string }>(
            `SELECT r.verified_id FROM public.pbx_live_runtime r WHERE r.node_id=$1 AND r.installed_id=r.verified_id AND r.known_good_id=r.verified_id AND r.active_operation_id IS NULL AND r.active_retirement_id IS NULL AND r.active_profile_operation_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.tenant_route_test_progress p WHERE p.node_id=r.node_id AND p.state IN ('queued','dispatching','admitted','unknown'))`,
            [this.nodeId],
          )
        ).rows[0];
        if (!current) return;
        await this.application.profile(
          current.verified_id,
          current.verified_id,
          async (guard) => {
            await this.admission.begin(
              Date.now() + 120000,
              AbortSignal.timeout(120000),
              guard,
            );
            await this.prove(current.verified_id, guard);
            await guard();
            const refreshed = await this.store.ownership.fenced(
              token,
              async (tx) => {
                const changed = await tx.query(
                  `UPDATE public.pbx_live_runtime SET runtime_state='verified',boundary_epoch=$3,updated_at=clock_timestamp() WHERE node_id=$1 AND verified_id=$2 AND active_profile_operation_id IS NULL AND active_operation_id IS NULL AND active_retirement_id IS NULL RETURNING node_id`,
                  [this.nodeId, current.verified_id, token.epoch],
                );
                if (!changed.rows.length)
                  throw new Error('Restart proof changed');
                await new AuditRepository().append(tx, profileAudit, {
                  operationId: boot.bootId,
                  nodeId: this.nodeId,
                  action: 'verified',
                });
              },
            );
            if (!refreshed.accepted)
              throw new Error('Restart proof owner changed');
            await guard();
            await this.admission.open();
            this.verifiedBoot = boot.bootId;
          },
        );
        return;
      }
      if (
        row.node_id !== this.nodeId ||
        row.installation_id !== this.installationId
      )
        throw new Error('Profile target unavailable');
      const ancestors: ProfileIntent[] = [];
      let predecessor = row.predecessor_id;
      const seen = new Set([row.id]);
      while (predecessor && ancestors.length < 128) {
        if (seen.has(predecessor))
          throw new Error('Profile ancestry unavailable');
        seen.add(predecessor);
        const parent = (
          await this.store.pool.query<ProfileIntent>(
            'SELECT i.*,p.state FROM public.pbx_profile_operations i JOIN public.pbx_profile_progress p ON p.operation_id=i.id WHERE i.id=$1 AND i.node_id=$2 AND i.installation_id=$3',
            [predecessor, this.nodeId, this.installationId],
          )
        ).rows[0];
        if (!parent) throw new Error('Profile ancestry unavailable');
        ancestors.push(parent);
        predecessor = parent.predecessor_id;
      }
      if (predecessor) throw new Error('Profile ancestry exceeds bound');
      await this.application.profile(
        row.source_artifact_id,
        row.target_artifact_id,
        async (guard, acknowledge) => {
          const ownerGuard = guard;
          guard = async () => {
            await ownerGuard();
            const current = await this.store.pool.query(
              `SELECT 1 FROM public.pbx_live_runtime r JOIN public.pbx_nodes n ON n.id=r.node_id WHERE r.node_id=$1 AND r.active_profile_operation_id=$2 AND r.active_operation_id IS NULL AND r.active_retirement_id IS NULL AND n.installation_id=$3 AND n.version=$4`,
              [
                this.nodeId,
                row.id,
                this.installationId,
                row.expected_node_version,
              ],
            );
            if (!current.rows.length) throw new Error('Profile intent changed');
          };
          const path = join(this.root, 'profile-operations', row.id + '.json');
          let record: { fingerprint: string; stage: string } | null = null;
          try {
            record = JSON.parse(
              protectedLiveBytes(path, 4096).toString('utf8'),
            ) as { fingerprint: string; stage: string };
          } catch (e) {
            if (!(
              e &&
              typeof e === 'object' &&
              'code' in e &&
              e.code === 'ENOENT'
            ))
              throw e;
          }
          if (record && record.fingerprint !== row.fingerprint)
            throw new Error('Profile operation conflict');
          if (!record && row.state === 'queued') {
            durableJson(path, {
              fingerprint: row.fingerprint,
              stage: 'preparing',
            });
            this.recordPending(row.id);
            await this.phase(token, row, 'preparing');
            await this.prepare(token, row, guard);
            return;
          }
          // No selection/restart is repeated in this branch, including helper loss.
          await this.application.originalCustody();
          await this.admission.begin(
            Date.now() + 120000,
            AbortSignal.timeout(120000),
            guard,
          );
          let id: string | null = null;
          for (const candidate of [
            ...new Set([row.target_artifact_id, row.source_artifact_id]),
          ]) {
            try {
              await this.prove(candidate, guard);
              id = candidate;
              break;
            } catch {
              /* An incompatible pair is never reported verified. */
            }
          }
          if (!id) {
            if (
              record?.stage === 'prepared' &&
              ['preparing', 'queued'].includes(row.state)
            )
              await this.phase(token, row, 'prepared');
            else if (!['prepared', 'unknown'].includes(row.state))
              await this.phase(
                token,
                row,
                'unknown',
                'reconciliation_required',
              );
            return;
          }
          const selected = this.plans.load(id),
            outcome =
              id === row.target_artifact_id && row.kind === 'upgrade'
                ? 'verified'
                : 'rolled_back';
          durableJson(path, {
            fingerprint: row.fingerprint,
            stage: 'proved',
            artifactId: id,
            digest: selected.unmanaged,
            epoch: token.epoch,
          });
          await guard();
          await acknowledge(id);
          await guard();
          await this.admission.open();
          const result = await this.store.ownership.fenced(
            token,
            async (tx) => {
              const active = await tx.query(
                'SELECT 1 FROM public.pbx_live_runtime WHERE node_id=$1 AND active_profile_operation_id=$2 FOR UPDATE',
                [this.nodeId, row.id],
              );
              if (!active.rows.length)
                throw new Error('Profile operation changed');
              if (outcome === 'verified') {
                await tx.query(
                  'INSERT INTO public.pbx_live_artifacts(id,node_id,revision_id,initial_baseline,verified_at,profile_operation_id) VALUES($1,$2,$3,false,clock_timestamp(),$4) ON CONFLICT DO NOTHING',
                  [id, this.nodeId, row.source_revision_id, row.id],
                );
                await tx.query(
                  'INSERT INTO public.pbx_artifact_profiles(artifact_id,node_id,digest,operation_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
                  [id, this.nodeId, selected.unmanaged, row.id],
                );
              }
              await tx.query(
                'UPDATE public.pbx_profile_progress SET state=$2,failure=NULL,owner_epoch=$3,updated_at=clock_timestamp() WHERE operation_id=$1',
                [row.id, outcome, token.epoch],
              );
              await tx.query(
                "UPDATE public.pbx_live_runtime SET installed_id=$2,verified_id=$2,known_good_id=$2,runtime_state='verified',active_profile_operation_id=NULL,boundary_epoch=$3,updated_at=clock_timestamp() WHERE node_id=$1",
                [this.nodeId, id, token.epoch],
              );
              await new AuditRepository().append(tx, profileAudit, {
                operationId: row.id,
                nodeId: this.nodeId,
                action: outcome,
              });
              for (const parent of ancestors) {
                const changed = await tx.query(
                  "UPDATE public.pbx_profile_progress SET state='rolled_back',failure=NULL,owner_epoch=$2,updated_at=clock_timestamp() WHERE operation_id=$1 AND state NOT IN ('verified','rolled_back') RETURNING operation_id",
                  [parent.id, token.epoch],
                );
                if (changed.rows.length)
                  await new AuditRepository().append(tx, profileAudit, {
                    operationId: parent.id,
                    nodeId: this.nodeId,
                    action: 'rolled_back',
                  });
              }
            },
          );
          if (!result.accepted)
            throw new Error('Profile acknowledgement unavailable');
          // Keep protected pending evidence through SQL commit. Opening is guarded
          // and requires fresh proof, so restart cannot reuse the prior proof.
          await ownerGuard();
          this.recordPending(row.id, true);
        },
        ancestors.map((parent) => parent.target_artifact_id),
      );
    } catch (error) {
      if (attempted && attempted.state !== 'unknown') {
        const failure =
          error instanceof AdmissionFailure
            ? error.code === 'activity_deadline'
              ? 'activity_busy'
              : 'activity_unknown'
            : 'reconciliation_required';
        // Failure publication is itself fenced. Losing the database/owner keeps
        // the prior uncertain durable stage; it never authorizes another effect.
        await this.phase(token, attempted, 'unknown', failure).catch(() => {});
      }
    } finally {
      this.busy = false;
    }
  }
}
