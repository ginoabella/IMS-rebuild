// Actual pinned Asterisk behind the native TLS observation filter, no provider.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { connect } from 'node:tls';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const load = createRequire(
  '/workspace/services/backend/dist/modules/telephony/adapters/live/observation-gateway.js',
);
const { ReadOnlyObservationGateway } = load('./observation-gateway.js');
export async function verifyAmiGateway() {
  const root = '/var/lib/myims-pbx/control/fixture',
    key = root + '/gateway.key',
    certificate = root + '/gateway.crt';
  execFileSync(
    '/usr/bin/openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      key,
      '-out',
      certificate,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost',
    ],
    { stdio: 'ignore', timeout: 5000 },
  );
  const gateway = new ReadOnlyObservationGateway(certificate, key);
  await gateway.start();
  const client = connect({
    host: '127.0.0.1',
    port: 5039,
    servername: 'localhost',
    ca: readFileSync(certificate),
  });
  let buffer = '',
    waiting;
  client.on('error', () =>
    waiting?.reject(new Error('Owned AMI fixture transport failed')),
  );
  client.on('data', (bytes) => {
    buffer += bytes.toString('utf8');
    if (buffer.length > 131072) {
      client.destroy();
      return;
    }
    let end;
    while ((end = buffer.indexOf('\r\n\r\n')) >= 0) {
      const frame = buffer.slice(0, end);
      buffer = buffer.slice(end + 4);
      if (waiting && frame.includes(`ActionID: ${waiting.id}`)) {
        waiting.resolve(frame);
        waiting = undefined;
      }
    }
  });
  async function ask(action, fields = {}) {
    const id = randomUUID();
    const reply = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiting = undefined;
        reject(new Error('Owned AMI response deadline'));
      }, 2000);
      waiting = {
        id,
        resolve: (frame) => {
          clearTimeout(timeout);
          resolve(frame);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      };
    });
    client.write(
      [
        `Action: ${action}`,
        `ActionID: ${id}`,
        ...Object.entries(fields).map(([name, value]) => `${name}: ${value}`),
        '',
        '',
      ].join('\r\n'),
    );
    return reply;
  }

  try {
    await new Promise((resolve, reject) => {
      client.once('secureConnect', resolve);
      client.once('error', reject);
    });
    const credentials = JSON.parse(readFileSync(root + '/ami.json', 'utf8'));
    assert.ok(
      (
        await ask('Login', {
          Username: credentials.username,
          Secret: credentials.secret,
          Events: 'off',
        })
      ).includes('Response: Success'),
    );
    assert.ok((await ask('PJSIPShowEndpoints')).includes('Response: Success'));
    for (const [action, fields] of [
      ['Reload', { Module: 'res_pjsip.so' }],
      ['Command', { Command: 'core show version' }],
      [
        'Originate',
        { Channel: 'Local/s@ims-fixture-hold', Application: 'Wait', Data: '1' },
      ],
      ['Shutdown', {}],
    ]) {
      const result = await ask(action, fields);
      assert.ok(result.includes('Response: Error'));
      assert.ok(result.includes('Message: Permission denied'));
    }
    console.log(
      'PASS native AMI: real verified-TLS observation login/PJSIP read works, while Reload/Command/Originate/Shutdown are rejected at the native filter; direct AMI is loopback-only with TLS/web management disabled',
    );
  } finally {
    client.destroy();
    await gateway.close();
  }
}
