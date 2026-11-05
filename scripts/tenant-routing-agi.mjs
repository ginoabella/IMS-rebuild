#!/usr/local/bin/node
// Unprivileged fixed AGI client. No SQL, provider, PBX-control or material access.
import { createInterface } from 'node:readline';
import { request } from 'node:http';
const lines = createInterface({ input: process.stdin, terminal: false });
const iterator = lines[Symbol.asyncIterator]();
const deadline = setTimeout(() => process.exit(1), 4000);
async function line() {
  const next = await iterator.next();
  if (next.done || next.value.length > 2048) throw new Error('Unavailable');
  return next.value;
}
async function variable(expression) {
  process.stdout.write(`GET FULL VARIABLE "${expression}"\n`);
  const result = await line();
  return /^200 result=1 \(([^\r\n]*)\)$/.exec(result)?.[1] ?? '';
}
try {
  let size = 0;
  while (true) {
    const value = await line();
    size += value.length;
    if (size > 16384) throw new Error('Unavailable');
    if (!value) break;
  }
  const [revisionId, tenantId, direction, resourceId] = process.argv.slice(2);
  // PJSIP's selected endpoint supplies identity. Reject duplicate routing/admission
  // headers before trusting that single selection; do not forward header contents.
  const from = await variable('${PJSIP_HEADER(read,From,1)}');
  const duplicateFrom = await variable('${PJSIP_HEADER(read,From,2)}');
  const duplicateTo = await variable('${PJSIP_HEADER(read,To,2)}');
  const duplicateNonce = await variable('${PJSIP_HEADER(read,X-MyIMS-Test,2)}');
  const payload = JSON.stringify({
    revisionId,
    tenantId,
    direction,
    resourceId,
    endpoint: await variable('${CHANNEL(endpoint)}'),
    number: await variable('${MYIMS_ORIGINAL}'),
    uniqueId: await variable('${UNIQUEID}'),
    nonce: await variable('${PJSIP_HEADER(read,X-MyIMS-Test)}'),
    unambiguous: !!from && !duplicateFrom && !duplicateTo && !duplicateNonce,
  });
  const result = await new Promise((resolve, reject) => {
    const req = request(
      {
        socketPath: '/run/myims-tenant/admission.sock',
        path: '/admit',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 2000,
      },
      (res) => {
        let value = '';
        res.on('data', (chunk) => {
          value += chunk;
          if (value.length > 128) req.destroy();
        });
        res.on('end', () =>
          resolve(res.statusCode === 200 && value === '{"permitted":true}'),
        );
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('Unavailable')));
    req.on('error', reject);
    req.end(payload);
  });
  process.stdout.write(`SET VARIABLE MYIMS_PERMITTED ${result ? '1' : '0'}\n`);
  await line();
} catch {
  // The dialplan initializes denial; failed or interrupted AGI cannot permit.
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  lines.close();
}
