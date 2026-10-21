import { collectAudit } from './archive.mjs';
process.umask(0o077);
try {
  if (process.argv.length !== 5) throw new Error();
  const operationId = collectAudit(
    ...process.argv.slice(2),
    '/run/public/recipient.txt',
  );
  console.log(
    JSON.stringify({ status: 'passed', stage: 'audit', operationId }),
  );
} catch {
  console.error(JSON.stringify({ status: 'failed', stage: 'audit' }));
  process.exitCode = 1;
}
