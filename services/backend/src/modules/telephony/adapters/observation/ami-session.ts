import type { TLSSocket } from 'node:tls';
import type {
  PbxRegistrationFact,
  PbxObservationFailure,
} from '@myims/contracts';
import type {
  PbxObservationSession,
  ObservationSnapshot,
} from '../../application/observation-ports';
import type { ObservationSettings } from '../../domain/observation-settings';
type Frame = Readonly<Record<string, string>>;
type Action =
  'Login' | 'Logoff' | 'Ping' | 'PJSIPShowEndpoints' | 'PJSIPShowContacts';
const actions: ReadonlySet<string> = new Set<Action>([
  'Login',
  'Logoff',
  'Ping',
  'PJSIPShowEndpoints',
  'PJSIPShowContacts',
]);
export class AmiFailure extends Error {
  constructor(readonly failure: PbxObservationFailure) {
    super('PBX observation failed');
  }
}
interface Pending {
  id: string;
  frames: Frame[];
  event?: string;
  complete?: string;
  resolve: (frames: Frame[]) => void;
  reject: (error: AmiFailure) => void;
}
/** Internal protocol implementation; only PbxObservationSession leaves the adapter. */
export class AmiSession implements PbxObservationSession {
  private readonly ending = new AbortController();
  readonly ended = this.ending.signal;
  private buffer = Buffer.alloc(0);
  private pending?: Pending;
  private serial = 0;
  private changes = 0;
  private bytes = 0;
  private failed?: PbxObservationFailure;
  private busy = false;
  constructor(
    private readonly socket: TLSSocket,
    private readonly settings: Readonly<ObservationSettings>,
  ) {
    socket.on('data', (bytes) => this.receive(bytes));
    socket.on('error', () => this.break('disconnected'));
    socket.on('close', () => this.break('disconnected'));
  }
  private break(failure: PbxObservationFailure) {
    this.failed ??= failure;
    this.ending.abort();
    this.pending?.reject(new AmiFailure(this.failed));
    this.pending = undefined;
    this.socket.destroy();
  }
  private receive(data: Buffer) {
    if (this.failed) return;
    this.bytes += data.length;
    if (this.bytes > this.settings.snapshotBytes) {
      this.break('resource_limit');
      return;
    }
    this.buffer = Buffer.concat([this.buffer, data]);
    try {
      // Consume the AMI greeting, which is not a header frame.
      if (
        this.buffer
          .subarray(0, 22)
          .toString()
          .startsWith('Asterisk Call Manager/')
      ) {
        const end = this.buffer.indexOf('\r\n');
        if (end < 0) return;
        this.buffer = this.buffer.subarray(end + 2);
      }
      while (this.buffer.length) {
        const end = this.buffer.indexOf('\r\n\r\n');
        if (end < 0) {
          if (this.buffer.length > this.settings.frameBytes)
            throw new AmiFailure('resource_limit');
          return;
        }
        if (end > this.settings.frameBytes)
          throw new AmiFailure('resource_limit');
        const raw = this.buffer.subarray(0, end).toString('utf8');
        this.buffer = this.buffer.subarray(end + 4);
        const frame: Record<string, string> = {};
        for (const line of raw.split('\r\n')) {
          const at = line.indexOf(':');
          if (at < 1) throw new AmiFailure('protocol_failed');
          const key = line.slice(0, at).toLowerCase(),
            value = line.slice(at + 1).trim();
          if (!/^[a-z][a-z0-9-]*$/.test(key) || Object.hasOwn(frame, key))
            throw new AmiFailure('protocol_failed');
          frame[key] = value;
        }
        if (
          frame.event === 'ContactStatus' ||
          frame.event === 'EndpointDetail'
        ) {
          this.changes++;
          continue;
        }
        const p = this.pending;
        if (!p || frame.actionid !== p.id) continue;
        if (
          frame.response === 'Error' &&
          p.frames.length === 0 &&
          ((p.event === 'EndpointList' &&
            frame.message === 'No endpoints found') ||
            (p.event === 'ContactList' &&
              frame.message === 'No Contacts found'))
        ) {
          // Pinned Asterisk reports its authoritative empty collections as these
          // exact error responses. Never interpret any other error as empty.
          this.pending = undefined;
          p.resolve([]);
          continue;
        }
        if (frame.response === 'Error')
          throw new AmiFailure(p.event ? 'snapshot_incomplete' : 'auth_failed');
        if (frame.response === 'Success' && !p.event) {
          this.pending = undefined;
          p.resolve([frame]);
          continue;
        }
        if (frame.event === p.complete) {
          if (
            frame.eventlist !== 'Complete' ||
            !/^\d+$/.test(frame.listitems ?? '') ||
            Number(frame.listitems) !== p.frames.length
          )
            throw new AmiFailure('snapshot_incomplete');
          this.pending = undefined;
          p.resolve(p.frames);
          continue;
        }
        if (frame.event === p.event) {
          p.frames.push(frame);
          const limit =
            p.event === 'EndpointList'
              ? this.settings.endpoints
              : this.settings.contacts;
          if (p.frames.length > limit) throw new AmiFailure('resource_limit');
        } else if (frame.event) throw new AmiFailure('snapshot_incomplete');
      }
    } catch (error) {
      this.break(
        error instanceof AmiFailure ? error.failure : 'protocol_failed',
      );
    }
  }
  private async request(
    action: Action,
    signal: AbortSignal,
    fields: Record<string, string> = {},
    event?: string,
    complete?: string,
  ): Promise<Frame[]> {
    // Runtime allowlist is also enforced before any bytes can reach the socket.
    if (!actions.has(action) || this.pending || this.failed || signal.aborted)
      throw new AmiFailure(this.failed ?? 'disconnected');
    const id = String(++this.serial);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => this.break('timeout');
    signal.addEventListener('abort', abort, { once: true });
    try {
      return await new Promise<Frame[]>((resolve, reject) => {
        this.pending = { id, event, complete, frames: [], resolve, reject };
        timer = setTimeout(abort, this.settings.ioMs);
        const payload = { ...fields, Action: action, ActionID: id };
        if (Object.values(payload).some((v) => /[\r\n\0]/.test(v))) {
          this.break('protocol_failed');
          return;
        }
        this.socket.write(
          Object.entries(payload)
            .map(([k, v]) => `${k}: ${v}\r\n`)
            .join('') + '\r\n',
        );
      });
    } finally {
      if (timer) clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  }
  async authenticate(username: string, password: string, signal: AbortSignal) {
    await this.request('Login', signal, {
      Username: username,
      Secret: password,
      Events: 'on',
    });
    // Authentication response alone is not a health or registration snapshot.
    await this.request('Ping', signal);
  }
  async snapshot(signal: AbortSignal): Promise<ObservationSnapshot> {
    if (this.busy) return { kind: 'failed', failure: 'snapshot_incomplete' };
    this.busy = true;
    this.bytes = 0;
    const before = this.changes;
    const timeout = AbortSignal.timeout(this.settings.snapshotMs);
    const bounded = AbortSignal.any([signal, timeout]);
    try {
      const endpoints = await this.request(
        'PJSIPShowEndpoints',
        bounded,
        {},
        'EndpointList',
        'EndpointListComplete',
      );
      const contacts = await this.request(
        'PJSIPShowContacts',
        bounded,
        {},
        'ContactList',
        'ContactListComplete',
      );
      if (before !== this.changes)
        return { kind: 'failed', failure: 'snapshot_incomplete' };
      const facts = new Map<string, PbxRegistrationFact>();
      for (const endpoint of endpoints) {
        const name = endpoint.objectname ?? '';
        if (!/^[a-zA-Z0-9_.:-]{1,128}$/.test(name) || facts.has(name))
          throw new AmiFailure('snapshot_incomplete');
        facts.set(name, {
          endpoint: name,
          registered: false,
          contacts: 0,
          reachableContacts: 0,
        });
      }
      const seen = new Set<string>();
      for (const contact of contacts) {
        const name = contact.objectname ?? '',
          endpoint = contact.endpoint ?? '';
        if (!name || seen.has(name) || !facts.has(endpoint))
          throw new AmiFailure('snapshot_incomplete');
        seen.add(name);
        // Static contacts have no finite dynamic-registration expiry.
        if (!/^\d+$/.test(contact.expirationtime ?? ''))
          throw new AmiFailure('snapshot_incomplete');
        if (Number(contact.expirationtime) === 0) continue;
        const fact = facts.get(endpoint);
        if (!fact) throw new AmiFailure('snapshot_incomplete');
        fact.contacts++;
        fact.registered = true;
        if (contact.status === 'Reachable') fact.reachableContacts++;
        else if (
          !['Unreachable', 'NonQualified', 'Unknown'].includes(
            contact.status ?? '',
          )
        )
          throw new AmiFailure('snapshot_incomplete');
      }
      return {
        kind: 'complete',
        registrations: [...facts.values()].sort((a, b) =>
          a.endpoint.localeCompare(b.endpoint),
        ),
      };
    } catch (error) {
      return {
        kind: 'failed',
        failure:
          error instanceof AmiFailure ? error.failure : 'protocol_failed',
      };
    } finally {
      this.busy = false;
    }
  }
  close() {
    this.break('disconnected');
  }
}
