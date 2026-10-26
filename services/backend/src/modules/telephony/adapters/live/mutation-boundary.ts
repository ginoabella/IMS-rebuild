import {
  constants,
  openSync,
  closeSync,
  fstatSync,
  readFileSync,
  writeFileSync,
  fsyncSync,
  renameSync,
  lstatSync,
} from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PbxOwnershipToken } from '../../application/observation-ports';
import { canonical } from '../../domain/revision-snapshot';
import { uuid } from '../../../identity/domain/storage';
export class MutationBoundaryFailure extends Error {
  constructor(
    readonly code:
      | 'stale_owner'
      | 'out_of_order'
      | 'request_conflict'
      | 'reconciliation_required'
      | 'boundary_unavailable'
      | 'stale_baseline',
  ) {
    super('PBX mutation boundary rejected');
  }
}
export interface BoundaryIntent {
  operationId: string;
  revisionId: string;
  sequence: number;
  expectedBaselineId: string;
  fingerprint: string;
}
export interface BoundaryResult {
  kind:
    | 'verified'
    | 'recovered'
    | 'validation_failed'
    | 'revoked'
    | 'failed'
    | 'unknown';
  installedId: string | null;
  verifiedId: string | null;
  failure?:
    | 'validation_failed'
    | 'stale_dependencies'
    | 'material_invalid'
    | 'material_missing'
    | 'material_denied'
    | 'material_unavailable'
    | 'originator_revoked'
    | 'install_failed'
    | 'reload_failed'
    | 'verification_failed';
}
const failures = [
  'validation_failed',
  'stale_dependencies',
  'material_invalid',
  'material_missing',
  'material_denied',
  'material_unavailable',
  'originator_revoked',
  'install_failed',
  'reload_failed',
  'verification_failed',
];
function record(
  value: unknown,
  keys: string[],
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}
function validIntent(value: unknown): value is BoundaryIntent {
  if (
    !record(value, [
      'operationId',
      'revisionId',
      'sequence',
      'expectedBaselineId',
      'fingerprint',
    ]) ||
    Object.keys(value).length !== 5
  )
    return false;
  return (
    uuid(value.operationId) &&
    uuid(value.revisionId) &&
    uuid(value.expectedBaselineId) &&
    Number.isSafeInteger(value.sequence) &&
    Number(value.sequence) > 0 &&
    Number(value.sequence) <= 2147483647 &&
    typeof value.fingerprint === 'string' &&
    /^[a-f0-9]{64}$/.test(value.fingerprint)
  );
}
function validResult(value: unknown): value is BoundaryResult {
  if (
    !record(value, ['kind', 'installedId', 'verifiedId', 'failure']) ||
    typeof value.kind !== 'string' ||
    ![
      'verified',
      'recovered',
      'validation_failed',
      'revoked',
      'failed',
      'unknown',
    ].includes(value.kind) ||
    (value.failure !== undefined && !failures.includes(String(value.failure)))
  )
    return false;
  if (value.kind === 'verified' || value.kind === 'recovered')
    return uuid(value.verifiedId) && value.installedId === value.verifiedId;
  if (value.verifiedId !== null) return false;
  return value.kind === 'validation_failed' || value.kind === 'revoked'
    ? value.installedId === null
    : value.installedId === null || uuid(value.installedId);
}
interface Journal {
  version: 1;
  nodeId: string;
  installationId: string;
  epoch: string;
  incarnation: string | null;
  sequence: number;
  verifiedId: string | null;
  pending: BoundaryIntent | null;
  receipts: { intent: BoundaryIntent; result: BoundaryResult }[];
}
export interface BoundaryAuthority {
  current(token: PbxOwnershipToken): Promise<boolean>;
  drain?(): Promise<void>;
}
/**
 * Native installation helper only, started under a process-lifetime flock on this
 * installation's lock file. There is exactly one physical dispatch queue across
 * owners. A SQL lease acquisition is incomplete for live execution until takeover
 * is acknowledged here, after every already-admitted command has completed.
 * Ordinary callers never receive this object or the native command driver.
 */
export class PhysicalMutationBoundary {
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;
  constructor(
    private readonly root: string,
    private readonly nodeId: string,
    private readonly installationId: string,
    private readonly authority: BoundaryAuthority,
  ) {
    const s = lstatSync(root);
    if (
      !s.isDirectory() ||
      s.isSymbolicLink() ||
      s.uid !== process.getuid?.() ||
      s.mode & 0o077 ||
      !uuid(nodeId) ||
      !uuid(installationId)
    )
      throw new MutationBoundaryFailure('boundary_unavailable');
  }
  private async serial<T>(action: () => Promise<T>): Promise<T> {
    if (this.queued >= 8)
      throw new MutationBoundaryFailure('boundary_unavailable');
    this.queued++;
    const before = this.tail;
    let release = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await before;
    try {
      return await action();
    } finally {
      await this.authority.drain?.();
      this.queued--;
      release();
    }
  }
  private load(): Journal {
    try {
      const fd = openSync(
        join(this.root, 'boundary.json'),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = fstatSync(fd);
        if (
          !stat.isFile() ||
          stat.nlink !== 1 ||
          stat.uid !== process.getuid?.() ||
          stat.mode & 0o077 ||
          stat.size > 1048576
        )
          throw new Error();
        const value: unknown = JSON.parse(readFileSync(fd, 'utf8'));
        if (
          !record(value, [
            'version',
            'nodeId',
            'installationId',
            'epoch',
            'incarnation',
            'sequence',
            'verifiedId',
            'pending',
            'receipts',
          ]) ||
          Object.keys(value).length !== 9
        )
          throw new Error();
        const s = value as unknown as Journal;
        if (
          s.version !== 1 ||
          s.nodeId !== this.nodeId ||
          s.installationId !== this.installationId ||
          !/^(0|[1-9][0-9]{0,18})$/.test(s.epoch) ||
          !Number.isSafeInteger(s.sequence) ||
          s.sequence < 0 ||
          s.sequence > 2147483647 ||
          !Array.isArray(s.receipts) ||
          s.receipts.length > 128 ||
          (s.incarnation !== null && !uuid(s.incarnation)) ||
          !uuid(s.verifiedId) ||
          (s.epoch === '0') !== (s.incarnation === null) ||
          (s.pending !== null &&
            (!validIntent(s.pending) ||
              s.pending.sequence !== s.sequence + 1)) ||
          s.receipts.some(
            (entry, index) =>
              !record(entry, ['intent', 'result']) ||
              !validIntent(entry.intent) ||
              !validResult(entry.result) ||
              ['unknown', 'failed'].includes(entry.result.kind) ||
              entry.intent.sequence > s.sequence ||
              (index > 0 &&
                entry.intent.sequence !==
                  s.receipts[index - 1]!.intent.sequence + 1),
          ) ||
          new Set(s.receipts.map((entry) => entry.intent.operationId)).size !==
            s.receipts.length ||
          (s.sequence > 0 &&
            s.receipts.at(-1)?.intent.sequence !== s.sequence) ||
          (s.sequence === 0 && s.receipts.length !== 0)
        )
          throw new Error();
        return s;
      } finally {
        closeSync(fd);
      }
    } catch {
      throw new MutationBoundaryFailure('boundary_unavailable');
    }
  }
  private save(state: Journal) {
    const temporary = join(this.root, `.journal-${randomUUID()}`);
    try {
      const fd = openSync(
        temporary,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        0o600,
      );
      try {
        writeFileSync(fd, canonical(state));
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temporary, join(this.root, 'boundary.json'));
      const directory = openSync(
        this.root,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      try {
        fsyncSync(directory);
      } finally {
        closeSync(directory);
      }
    } catch {
      throw new MutationBoundaryFailure('boundary_unavailable');
    }
  }
  /** Deployment bootstrap alone supplies an independently verified original baseline. */
  initialize(verifyBaseline: () => Promise<string>): Promise<void> {
    return this.serial(async () => {
      try {
        lstatSync(join(this.root, 'boundary.json'));
        this.load();
        return;
      } catch (e) {
        if (e instanceof MutationBoundaryFailure) throw e;
        if (
          !e ||
          typeof e !== 'object' ||
          !('code' in e) ||
          e.code !== 'ENOENT'
        )
          throw new MutationBoundaryFailure('boundary_unavailable');
      }
      const baseline = await verifyBaseline();
      if (!uuid(baseline))
        throw new MutationBoundaryFailure('boundary_unavailable');
      this.save({
        version: 1,
        nodeId: this.nodeId,
        installationId: this.installationId,
        epoch: '0',
        incarnation: null,
        sequence: 0,
        verifiedId: baseline,
        pending: null,
        receipts: [],
      });
    });
  }
  private async current(state: Journal, token: PbxOwnershipToken) {
    if (
      token.nodeId !== this.nodeId ||
      token.epoch !== state.epoch ||
      token.incarnation !== state.incarnation ||
      !(await this.authority.current(token))
    )
      throw new MutationBoundaryFailure('stale_owner');
  }
  takeover(token: PbxOwnershipToken): Promise<void> {
    return this.serial(async () => {
      const state = this.load();
      if (
        token.nodeId !== this.nodeId ||
        !uuid(token.incarnation) ||
        !/^[1-9][0-9]{0,18}$/.test(token.epoch) ||
        BigInt(token.epoch) < BigInt(state.epoch) ||
        !(await this.authority.current(token))
      )
        throw new MutationBoundaryFailure('stale_owner');
      if (
        token.epoch === state.epoch &&
        token.incarnation !== state.incarnation
      )
        throw new MutationBoundaryFailure('stale_owner');
      if (
        token.epoch === state.epoch &&
        token.incarnation === state.incarnation
      )
        return;
      this.save({
        ...state,
        epoch: token.epoch,
        incarnation: token.incarnation,
      });
    });
  }
  async inspect(
    token: PbxOwnershipToken,
    operationId: string,
  ): Promise<{
    state: 'not_started' | 'pending' | 'complete';
    result?: BoundaryResult;
    pending?: BoundaryIntent;
  }> {
    if (!uuid(operationId))
      throw new MutationBoundaryFailure('request_conflict');
    const state = this.load();
    await this.current(state, token);
    const receipt = state.receipts.find(
      (r) => r.intent.operationId === operationId,
    );
    if (receipt) return { state: 'complete', result: { ...receipt.result } };
    if (state.pending)
      return { state: 'pending', pending: { ...state.pending } };
    return { state: 'not_started' };
  }
  execute(
    token: PbxOwnershipToken,
    intent: BoundaryIntent,
    apply: (guard: () => Promise<void>) => Promise<BoundaryResult>,
    reconcile: (guard: () => Promise<void>) => Promise<BoundaryResult>,
    reconciliationOf?: string,
  ): Promise<BoundaryResult> {
    return this.serial(async () => {
      const state = this.load();
      await this.current(state, token);
      if (
        !validIntent(intent) ||
        (reconciliationOf !== undefined && !uuid(reconciliationOf))
      )
        throw new MutationBoundaryFailure('request_conflict');
      const receipt = state.receipts.find(
        (r) => r.intent.operationId === intent.operationId,
      );
      if (receipt) {
        if (canonical(receipt.intent) !== canonical(intent))
          throw new MutationBoundaryFailure('request_conflict');
        return { ...receipt.result };
      }
      if (state.pending && canonical(state.pending) !== canonical(intent))
        throw new MutationBoundaryFailure('reconciliation_required');
      if (!state.pending && intent.sequence !== state.sequence + 1)
        throw new MutationBoundaryFailure('out_of_order');
      if (!state.pending && intent.expectedBaselineId !== state.verifiedId) {
        // An explicit audited successor may restore the previously reviewed
        // baseline after its exact predecessor independently verified a newer set
        // but lost SQL acknowledgement. Never grant this exception to ordinary apply.
        const predecessor =
          reconciliationOf &&
          state.receipts.find(
            (entry) =>
              entry.intent.operationId === reconciliationOf &&
              entry.intent.sequence === state.sequence &&
              entry.intent.expectedBaselineId === intent.expectedBaselineId &&
              entry.result.verifiedId === state.verifiedId,
          );
        if (!predecessor) throw new MutationBoundaryFailure('stale_baseline');
      }
      const guard = () => this.current(this.load(), token);
      const wasPending = state.pending !== null;
      state.pending = { ...intent };
      this.save(state); // Uncertainty is durable BEFORE any external effect.
      let result: BoundaryResult;
      try {
        result = await (wasPending ? reconcile(guard) : apply(guard));
      } catch {
        throw new MutationBoundaryFailure('reconciliation_required');
      }
      if (!validResult(result))
        throw new MutationBoundaryFailure('reconciliation_required');
      await guard();
      if (result.kind === 'unknown' || result.kind === 'failed')
        return { ...result }; // Retain pending, baseline and all pins.
      state.pending = null;
      state.sequence = intent.sequence;
      state.verifiedId = result.verifiedId ?? state.verifiedId;
      state.receipts.push({ intent: { ...intent }, result: { ...result } });
      state.receipts = state.receipts.slice(-128);
      this.save(state);
      return { ...result };
    });
  }
}
