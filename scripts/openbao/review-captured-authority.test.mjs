import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { reviewCapturedAuthority } from './review-captured-authority.mjs';

const fixture = () => ({
  operationId: 'fixture',
  capturedAt: '2026-10-22T00:00:00Z',
  policies: {
    'platform-deployment-maintainer': {
      policy: 'path "auth/token/create/fixture" { capabilities = ["update"] }',
    },
  },
  roles: {},
  auth: {},
  tokens: [
    {
      accessor: 'PRIVATE_ACCESSOR_CANARY',
      policies: ['PRIVATE_POLICY_CANARY'],
    },
  ],
  leases: [],
});
const bound = (value) => {
  const bytes = Buffer.from(JSON.stringify(value));
  return [
    bytes,
    {
      operationId: 'fixture',
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  ];
};
test('refuses altered bytes, wrong operation and incomplete inventory', () => {
  const [bytes, binding] = bound(fixture());
  assert.throws(
    () =>
      reviewCapturedAuthority(
        Buffer.concat([bytes, Buffer.from(' ')]),
        binding,
      ),
    /digest/,
  );
  assert.throws(
    () => reviewCapturedAuthority(bytes, { ...binding, operationId: 'other' }),
    /operation/,
  );
  assert.throws(
    () => reviewCapturedAuthority(...bound({ operationId: 'fixture' })),
    /Incomplete/,
  );
});
test('reports blockers and missing configuration without disclosing private token data', () => {
  const report = reviewCapturedAuthority(...bound(fixture()));
  assert.equal(report.effectiveAuthorityEstablished, false);
  assert.equal(report.providerWritesAuthorized, false);
  assert.equal(report.roles.length, 14);
  assert.ok(
    report.roles.every(
      (role) => !role.present && role.differentFields.length > 0,
    ),
  );
  assert.equal(JSON.stringify(report).includes('PRIVATE_'), false);
  const policy = report.policies.find(
    (item) => item.name === 'platform-deployment-maintainer',
  );
  assert.equal(policy.comparison, 'different-unresolved');
  assert.equal(
    policy.issuanceConstraintIndicators.capturedUnconditionalTokenCreateGrants,
    1,
  );
  assert.equal(
    policy.issuanceConstraintIndicators.expectedRequiredParameters,
    2,
  );
});
