// Execute in the existing backend container, outside the workspace loopback boundary.
import assert from 'node:assert/strict';
try {
  for (const port of [3004, 4002])
    await assert.rejects(
      () =>
        fetch(`http://workspace:${port}/credential-actions/csrf`, {
          signal: AbortSignal.timeout(3000),
        }),
      (error) => error.cause?.code === 'ECONNREFUSED',
    );
  console.log(
    'PASS staff private Next/Nest listeners inaccessible from another container',
  );
} catch {
  console.error('FAIL staff private Next/Nest network boundary');
  process.exitCode = 1;
}
