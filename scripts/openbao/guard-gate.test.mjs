import test from 'node:test';
import assert from 'node:assert/strict';
import { guardGate } from './guard-gate.mjs';
test('operation and exact sequence require positive host acknowledgments; budget bounded', async () => {
  let request;
  const check = guardGate('fixture', {
    send: (r) => {
      request = r;
    },
    receive: async () => ({ ...request, event: 'gate-ack', allow: true }),
  });
  for (let i = 0; i < 10; i++) await check();
  await assert.rejects(check());
});
test('denied, replayed, wrong-operation and malformed replies refuse the write', async () => {
  for (const reply of [
    { allow: false },
    { allow: true, operationId: 'other' },
    { allow: true, sequence: 9 },
    {},
  ]) {
    const check = guardGate('fixture', {
      send: () => {},
      receive: async () => ({
        event: 'gate-ack',
        operationId: 'fixture',
        sequence: 0,
        ...reply,
      }),
    });
    await assert.rejects(check());
  }
});
