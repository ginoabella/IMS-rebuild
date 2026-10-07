// Executed in the existing backend container, outside the workspace loopback boundary.
import assert from 'node:assert/strict';

try {
  for (const port of [3003, 4001]) {
    await assert.rejects(
      () =>
        fetch(`http://workspace:${port}/platform/auth/csrf`, {
          signal: AbortSignal.timeout(3000),
        }),
      (error) => error.cause?.code === 'ECONNREFUSED',
    );
  }
  console.log(
    'PASS private Next/Nest listeners inaccessible from another container',
  );
} catch {
  console.error('FAIL private Next/Nest network boundary');
  process.exitCode = 1;
}
