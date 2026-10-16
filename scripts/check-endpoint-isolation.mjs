// Trusted deployment read-only checks. Does not possess a provider token.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
const project = process.env.STORAGE_HOST_PROJECT_ROOT;
function docker(args) {
  const r = spawnSync('docker', args, { encoding: 'utf8', timeout: 15000 });
  assert.equal(r.status, 0, 'Isolation check command failed');
  return r.stdout;
}
for (const container of [
  'myims-rebuild-dev-backend-1',
  'myims-rebuild-dev-workspace-1',
  'myims-rebuild-dev-telephony-1',
  'myims-rebuild-dev-telephony-2',
]) {
  const check = `const fs=require('fs');let denied=true;for(const p of ['/run/endpoint/worker.token','/run/endpoint/cleanup.token','/workspace/.local/endpoint-credentials/admin.token','/workspace/.local/endpoint-credentials/seal.json']){try{fs.accessSync(p,fs.constants.R_OK);denied=false}catch{}}if(!denied||process.env.ENDPOINT_PROVIDER_TOKEN_FILE)process.exit(1);console.log('denied')`;
  assert.equal(
    docker(['exec', '--user', 'node', container, 'node', '-e', check]).trim(),
    'denied',
  );
}
for (const network of [
  'myims-rebuild-dev_endpoint-database',
  'myims-rebuild-dev_endpoint-credentials',
])
  assert.equal(
    docker(['network', 'inspect', network, '--format', '{{.Internal}}']).trim(),
    'true',
    'Endpoint network must be internal',
  );
const safe = docker([
  'inspect',
  'myims-rebuild-dev-endpoint-secrets-1',
  '--format',
  '{{json .HostConfig.PortBindings}}',
]);
assert.ok(
  safe.trim() === '{}' || safe.trim() === 'null',
  'Provider port published',
);
const denied = docker([
  'run',
  '--rm',
  '--user',
  '1003:1003',
  '--network',
  'myims-rebuild-dev_endpoint-credentials',
  '-v',
  `${project}/.local/endpoint-credentials/ca.crt:/ca.crt:ro`,
  'node:22.23.3-bookworm-slim',
  'node',
  '-e',
  `const https=require('https'),fs=require('fs');Promise.all([['myims-endpoint/data/installations/00000000-0000-0000-0000-000000000000/extensions/00000000-0000-0000-0000-000000000000/operations/00000000-0000-0000-0000-000000000000',403],['sys/generate-root/attempt',405]].map(([path,status])=>new Promise((resolve,reject)=>https.get('https://endpoint-secrets:8200/v1/'+path,{ca:fs.readFileSync('/ca.crt')},r=>{r.resume();r.on('end',()=>r.statusCode===status?resolve():reject())}).on('error',reject)))).then(()=>console.log('denied')).catch(()=>process.exit(1))`,
]);
assert.equal(denied.trim(), 'denied');
console.log(
  'PASS endpoint isolation (partial B-06): HTTP/workspace-node/observer cannot read provider or seal/admin files; no published provider port; real verified-TLS anonymous material read and root-generation access denied. Scoped worker/cleanup policy checks remain required.',
);
