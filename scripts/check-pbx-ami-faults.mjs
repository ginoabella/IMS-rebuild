// In-memory protocol faults only; these do not establish real TLS/authentication.
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const backend = createRequire(
  new URL('../services/backend/package.json', import.meta.url),
);
const { AmiSession } = backend(
  './dist/modules/telephony/adapters/observation/ami-session.js',
);
const { developmentObservationSettings } = backend(
  './dist/modules/telephony/domain/observation-settings.js',
);
class FixtureSocket extends EventEmitter {
  writes = [];
  destroyed = false;
  mode = 'normal';
  version = 1;
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.emit('close');
  }
  write(data) {
    this.writes.push(data);
    const id = /ActionID: (\d+)/.exec(data)[1],
      action = /Action: (\w+)/.exec(data)[1];
    const frame = (fields) =>
      Object.entries({ ActionID: id, ...fields })
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('') + '\r\n';
    if (this.mode === 'stall') return;
    globalThis.queueMicrotask(() => {
      if (this.destroyed) return;
      if (action === 'Login' || action === 'Ping') {
        this.emit('data', Buffer.from(frame({ Response: 'Success' })));
        return;
      }
      const endpoint = action === 'PJSIPShowEndpoints';
      const event = endpoint ? 'EndpointList' : 'ContactList',
        complete = endpoint ? 'EndpointListComplete' : 'ContactListComplete';
      const fields = endpoint
        ? { ObjectName: 'unmapped-fixture', Auths: 'PBX_USER_SENTINEL' }
        : {
            ObjectName: 'contact-1',
            Endpoint: 'unmapped-fixture',
            ExpirationTime: '1999999999',
            Status: 'Reachable',
            Uri: 'sip:PBX_SECRET_SENTINEL@fixture.invalid',
            CallId: 'PBX_CALL_SENTINEL',
            UserAgent: 'PBX_PAYLOAD_SENTINEL',
          };
      let body = frame({ Response: 'Success', EventList: 'start' });
      if (this.version) body += frame({ Event: event, ...fields });
      if (this.mode === 'duplicate' && endpoint)
        body += frame({ Event: event, ...fields });
      if (this.mode === 'during' && endpoint)
        body += frame({
          Event: 'ContactStatus',
          ActionID: '',
          ContactStatus: 'Created',
        });
      if (this.mode === 'older')
        body += frame({ Event: event, ActionID: 'older', ...fields });
      if (this.mode === 'gap' && endpoint)
        body += frame({ Event: 'UnexpectedListItem' });
      if (this.mode !== 'partial')
        body += frame({
          Event: complete,
          EventList: 'Complete',
          ListItems: this.version ? 1 : 0,
        });
      if (this.mode === 'oversize') body += 'X'.repeat(20000);
      // Fragment boundaries exercise framing independently of packet shape.
      this.emit('data', Buffer.from(body.slice(0, 17)));
      this.emit('data', Buffer.from(body.slice(17)));
    });
  }
}
export async function checkAmiFaults() {
  for (const mode of [
    'normal',
    'older',
    'duplicate',
    'during',
    'gap',
    'partial',
    'oversize',
    'stall',
  ]) {
    const socket = new FixtureSocket();
    socket.mode = mode;
    const session = new AmiSession(socket, {
      ...developmentObservationSettings,
      ioMs: 40,
      snapshotMs: 100,
    });
    const result = await session.snapshot(
      new globalThis.AbortController().signal,
    );
    if (['normal', 'older'].includes(mode)) {
      assert.equal(result.kind, 'complete');
      for (const sentinel of [
        'PBX_SECRET_SENTINEL',
        'PBX_USER_SENTINEL',
        'PBX_CALL_SENTINEL',
        'PBX_PAYLOAD_SENTINEL',
      ])
        assert.ok(!JSON.stringify(result).includes(sentinel));
      assert.deepEqual(result.registrations, [
        {
          endpoint: 'unmapped-fixture',
          registered: true,
          contacts: 1,
          reachableContacts: 1,
        },
      ]);
      socket.version = 0;
      const empty = await session.snapshot(
        new globalThis.AbortController().signal,
      );
      assert.equal(empty.kind, 'complete');
      assert.deepEqual(empty.registrations, []);
    } else assert.equal(result.kind, 'failed', mode);
    session.close();
    assert.ok(socket.destroyed);
  }
  const socket = new FixtureSocket();
  socket.mode = 'stall';
  const session = new AmiSession(socket, {
    ...developmentObservationSettings,
    ioMs: 1000,
  });
  const cancel = new globalThis.AbortController();
  const pending = session.snapshot(cancel.signal);
  cancel.abort();
  assert.equal((await pending).kind, 'failed');
  assert.ok(socket.destroyed);
  const deny = new FixtureSocket();
  const protectedSession = new AmiSession(deny, developmentObservationSettings);
  for (const action of [
    'Reload',
    'Originate',
    'Command',
    'UpdateConfig',
    'Hangup',
  ])
    await assert.rejects(
      protectedSession.request(action, new globalThis.AbortController().signal),
    );
  assert.deepEqual(deny.writes, []);
  protectedSession.close();
  console.log(
    'PASS B-06/B-08 injected AMI framing: older ActionIDs ignored; duplicate/gap/partial/events-during-snapshot/oversize/timeout reject; complete-empty replacement and cancellation pass; arbitrary mutating actions emit no bytes.',
  );
}
