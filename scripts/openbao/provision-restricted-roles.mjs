// Explicit trusted deployment only. This command cannot recover root or change listeners.
import {
  readFileSync,
  writeFileSync,
  lstatSync,
  existsSync,
  unlinkSync,
} from 'node:fs';
import { provisioningPlan } from './provisioning-plan.mjs';
import { provisioningPreflight } from './provisioning-preflight.mjs';
import { ProtectedBaoClient } from './protected-client.mjs';
import { requireRecoveryCheckpoint } from './recovery-checkpoint.mjs';
process.umask(0o077);
const [action, manifestFile] = process.argv.slice(2);
try {
  if (
    !['plan', 'apply'].includes(action) ||
    !manifestFile ||
    process.argv.length !== 4
  )
    throw new Error();
  if (lstatSync(manifestFile).size > 8192) throw new Error();
  const plan = provisioningPlan(JSON.parse(readFileSync(manifestFile, 'utf8')));
  if (action === 'plan') {
    console.log(
      JSON.stringify({
        version: 1,
        installations: plan.installations,
        policies: plan.policies,
        roles: plan.roles,
      }),
    );
  } else {
    const output = lstatSync('/output');
    if (!output.isDirectory() || output.mode & 0o077) throw new Error();
    for (const lifecycle of ['endpoint', 'trunk'])
      for (const suffix of ['token', 'accessor'])
        if (existsSync(`/output/${lifecycle}-issuer.${suffix}`))
          throw new Error();
    // Fixed protected mounts; never accept a token through argv or environment.
    const provider = new ProtectedBaoClient(
      '/custodian/custodian.token',
      '/custodian/ca.crt',
    );
    const identity = await provider.required('auth/token/lookup-self');
    if (identity.data?.policies?.some((p) => p.startsWith('endpoint-')))
      throw new Error();
    if (identity.data?.policies?.includes('root')) requireRecoveryCheckpoint();
    const checked = await provisioningPreflight(provider, plan);
    if (checked.createMount)
      await provider.required('sys/mounts/myims-trunk', {
        type: 'kv',
        options: { version: '2' },
      });
    // Matching retained policies/roles are untouched. No mismatch is remediated.
    for (const p of checked.missingPolicies) {
      await provider.required(`sys/policies/acl/${p.name}`, {
        policy: p.policy,
      });
    }
    for (const r of checked.missingRoles)
      await provider.required(`auth/token/roles/${r.name}`, r.configuration);
    // Files must not pre-exist: uncertainty requires reconciliation, never overwrite.
    for (const lifecycle of ['endpoint', 'trunk']) {
      const result = await provider.required(
        'auth/token/create',
        plan.issuerRequest(lifecycle),
      );
      const tokenFile = `/output/${lifecycle}-issuer.token`;
      const accessorFile = `/output/${lifecycle}-issuer.accessor`;
      let wroteToken = false,
        wroteAccessor = false;
      try {
        // Save exact revocation metadata before the material file.
        writeFileSync(accessorFile, result.auth.accessor, {
          mode: 0o600,
          flag: 'wx',
        });
        wroteAccessor = true;
        writeFileSync(tokenFile, result.auth.client_token, {
          mode: 0o600,
          flag: 'wx',
        });
        wroteToken = true;
      } catch {
        // The response is known but local persistence failed: revoke this exact token.
        // If revocation fails, preserve any accessor file and report uncertainty.
        await provider.required('auth/token/revoke-accessor', {
          accessor: result.auth.accessor,
        });
        if (wroteToken) unlinkSync(tokenFile);
        if (wroteAccessor) unlinkSync(accessorFile);
        throw new Error();
      }
    }
    // Privilege removal and old-token revocation are separate finalization, after
    // role/launcher regression verification. Never claim isolation from this stage.
    console.log(
      JSON.stringify({
        entrypoint: 'deployment',
        state: 'roles_prepared',
        administrationIsolation: 'pending',
      }),
    );
  }
} catch {
  console.error(
    JSON.stringify({
      entrypoint: 'deployment',
      state: 'failed',
      failureCode: 'restricted_provisioning_incomplete',
    }),
  );
  process.exitCode = 1;
}
