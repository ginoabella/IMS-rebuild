// Trusted acceptance owner only. Never used by application cleanup or HTTP.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/workspace/services/backend/package.json');
const {
  OpenBaoEndpointProvider,
  openBaoSettings,
} = require('/workspace/services/backend/dist/modules/telephony/adapters/credentials/openbao.js');
const manifest = JSON.parse(readFileSync(0, 'utf8'));
if (
  !/^myims_session_[a-f0-9]{12}$/.test(manifest.database) ||
  !Array.isArray(manifest.bindings) ||
  manifest.bindings.length > 100
)
  throw new Error('Invalid isolated fixture manifest');
const provider = new OpenBaoEndpointProvider(openBaoSettings(process.env));
const results = [];
for (const b of manifest.bindings) {
  try {
    results.push({
      operationId: b.operationId,
      outcome: await provider.destroy(b),
    });
  } catch {
    results.push({ operationId: b.operationId, outcome: 'cleanup_required' });
  }
}
console.log(JSON.stringify({ fixture: 'endpoint-teardown', results }));
if (results.some((r) => r.outcome === 'cleanup_required')) process.exitCode = 1;
