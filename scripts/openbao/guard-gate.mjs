// Token-free, one-operation host readiness handshake before each privileged write.
import { createInterface } from 'node:readline';
export function guardGate(operation, { send, receive }) {
  let sequence = 0;
  return async () => {
    const index = sequence++;
    if (index >= 10) throw new Error('Guard gate budget exceeded');
    send({ event: 'gate-request', operationId: operation, sequence: index });
    const reply = await receive();
    if (
      reply?.event !== 'gate-ack' ||
      reply.operationId !== operation ||
      reply.sequence !== index ||
      reply.allow !== true
    )
      throw new Error('Host guard gate refused');
  };
}
export function stdioGuardGate(operation) {
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const iterator = lines[Symbol.asyncIterator]();
  const check = guardGate(operation, {
    send: (value) => process.stdout.write(JSON.stringify(value) + '\n'),
    receive: async () => {
      let timer;
      try {
        const result = await Promise.race([
          iterator.next(),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Host gate timed out')),
              10000,
            );
          }),
        ]);
        if (result.done || result.value.length > 2048)
          throw new Error('Host gate closed');
        return JSON.parse(result.value);
      } finally {
        clearTimeout(timer);
      }
    },
  });
  return { check, close: () => lines.close() };
}
