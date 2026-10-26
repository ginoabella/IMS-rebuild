import assert from 'node:assert/strict';
/** Qualify human CLI rows, then retain full AMI identities for exact comparisons. */
export function observedBaselineEndpoints(registrations, cliNames) {
  const names = registrations.map((fact) => fact.endpoint).sort();
  assert.ok(names.every((name) => typeof name === 'string' && name.length > 0));
  assert.ok(
    cliNames.every((name) => typeof name === 'string' && name.length > 0),
  );
  assert.equal(
    new Set(names).size,
    names.length,
    'Duplicate AMI baseline identity',
  );
  assert.equal(
    names.length,
    cliNames.length,
    'Baseline inventory count changed',
  );
  const unmatched = new Set(names);
  const truncated = [];
  for (const name of cliNames) {
    if (unmatched.has(name)) unmatched.delete(name);
    else truncated.push(name);
  }
  // Asterisk's display columns can truncate long names. Every remaining display
  // row must qualify exactly one full AMI identity; ambiguity fails closed.
  for (const prefix of truncated) {
    const matches = [...unmatched].filter((name) => name.startsWith(prefix));
    assert.equal(
      matches.length,
      1,
      'Ambiguous or changed CLI baseline identity',
    );
    unmatched.delete(matches[0]);
  }
  assert.equal(unmatched.size, 0, 'Unexpected AMI baseline identity');
  return names;
}
