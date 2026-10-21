// Synthetic fixtures only; run in the network-none candidate tooling container.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  renameSync,
  symlinkSync,
  truncateSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectAudit, boundedFile, encryptSet, digest } from './archive.mjs';
process.umask(0o077);
function fixture(action) {
  const root = mkdtempSync(join(tmpdir(), 'myims-audit-test-'));
  const source = join(root, 'source'),
    state = join(root, 'state'),
    output = join(root, 'output'),
    recipient = join(root, 'recipient');
  for (const p of [source, state, output]) mkdirSync(p, { mode: 0o700 });
  execFileSync('age-keygen', ['-o', join(root, 'identity')], { stdio: 'pipe' });
  writeFileSync(
    recipient,
    execFileSync('age-keygen', ['-y', join(root, 'identity')]),
    { mode: 0o600 },
  );
  const segments = (names) =>
    writeFileSync(join(source, 'segments.json'), JSON.stringify(names));
  const collect = () => collectAudit(source, state, output, recipient);
  const decrypt = (id) =>
    execFileSync('age', [
      '-d',
      '-i',
      join(root, 'identity'),
      join(output, id + '.age'),
    ]);
  try {
    return action({
      root,
      source,
      state,
      output,
      recipient,
      segments,
      collect,
      decrypt,
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
test('audit complete-line checkpoints, append replay, rename rotation and encrypted manifests', () =>
  fixture(({ source, state, output, segments, collect, decrypt }) => {
    segments(['active.jsonl']);
    writeFileSync(join(source, 'active.jsonl'), '{"record":1}\n{"record":');
    const first = collect();
    assert.equal(
      JSON.parse(readFileSync(join(state, 'cursor.json'))).offset,
      13,
    );
    assert.equal(collect(), null);
    writeFileSync(join(source, 'active.jsonl'), '{"record":1}\n{"record":2}\n');
    const second = collect();
    renameSync(join(source, 'active.jsonl'), join(source, 'closed-1.jsonl'));
    writeFileSync(join(source, 'active.jsonl'), '{"record":3}\n');
    segments(['closed-1.jsonl', 'active.jsonl']);
    const third = collect();
    for (const [id, n] of [
      [first, 1],
      [second, 2],
      [third, 3],
    ]) {
      const compressed = decrypt(id);
      const audit = execFileSync('tar', ['-xzOf', '-', 'audit.jsonl'], {
        input: compressed,
      });
      assert.equal(audit.toString(), JSON.stringify({ record: n }) + '\n');
      const manifest = JSON.parse(
        execFileSync('tar', ['-xzOf', '-', 'manifest.json'], {
          input: compressed,
        }),
      );
      assert.equal(manifest.files['audit.jsonl'].sha256, digest(audit));
      assert.equal(manifest.kind, 'audit');
      const receipt = JSON.parse(readFileSync(join(output, id + '.json')));
      assert.equal(
        receipt.sha256,
        digest(readFileSync(join(output, id + '.age'))),
      );
    }
  }));
for (const fault of [
  'truncate',
  'rewrite',
  'missing-inode',
  'closed-partial',
  'bad-json',
  'symlink',
  'spool-lock',
  'collector-lock',
]) {
  test('audit fail closed without advancing cursor: ' + fault, () =>
    fixture(({ root, source, state, output, segments, collect }) => {
      segments(['active.jsonl']);
      writeFileSync(join(source, 'active.jsonl'), '{"record":1}\n');
      collect();
      const cursor = readFileSync(join(state, 'cursor.json'));
      if (fault === 'truncate') truncateSync(join(source, 'active.jsonl'), 0);
      if (fault === 'rewrite')
        writeFileSync(join(source, 'active.jsonl'), '{"record":9}\n');
      if (fault === 'missing-inode') {
        renameSync(join(source, 'active.jsonl'), join(source, 'lost.jsonl'));
        writeFileSync(join(source, 'active.jsonl'), '{"record":2}\n');
      }
      if (fault === 'closed-partial') {
        writeFileSync(
          join(source, 'active.jsonl'),
          '{"record":1}\n{"incomplete":',
        );
        writeFileSync(join(source, 'next.jsonl'), '{"record":2}\n');
        segments(['active.jsonl', 'next.jsonl']);
      }
      if (fault === 'bad-json')
        writeFileSync(join(source, 'active.jsonl'), '{"record":1}\ninvalid\n');
      if (fault === 'symlink') {
        renameSync(join(source, 'active.jsonl'), join(root, 'target'));
        symlinkSync(join(root, 'target'), join(source, 'active.jsonl'));
      }
      if (fault === 'spool-lock') {
        writeFileSync(
          join(source, 'active.jsonl'),
          '{"record":1}\n{"record":2}\n',
        );
        mkdirSync(join(output, '.spool.lock'));
      }
      if (fault === 'collector-lock') mkdirSync(join(state, 'collect.lock'));
      assert.throws(collect);
      assert.deepEqual(readFileSync(join(state, 'cursor.json')), cursor);
    }),
  );
}
test('no cursor advances on encryption failure; ciphertext corruption/wrong key fails', () =>
  fixture(
    ({
      source,
      state,
      output,
      segments,
      collect,
      recipient,
      root,
      decrypt,
    }) => {
      segments(['active.jsonl']);
      writeFileSync(join(source, 'active.jsonl'), '{"record":1}\n');
      const publicKey = readFileSync(recipient);
      writeFileSync(recipient, 'invalid');
      assert.throws(collect);
      assert.ok(!readdirSync(state).includes('cursor.json'));
      writeFileSync(recipient, publicKey);
      const id = collect();
      execFileSync('age-keygen', ['-o', join(root, 'wrong')], {
        stdio: 'pipe',
      });
      assert.throws(() =>
        execFileSync(
          'age',
          ['-d', '-i', join(root, 'wrong'), join(output, id + '.age')],
          { stdio: 'pipe' },
        ),
      );
      const ciphertext = readFileSync(join(output, id + '.age'));
      ciphertext[ciphertext.length - 1] ^= 1;
      writeFileSync(join(output, id + '.age'), ciphertext);
      assert.throws(() => decrypt(id));
    },
  ));
test('bounded inputs, secret files, traversal and full spool rejected', () =>
  fixture(({ root, output, recipient }) => {
    const path = join(root, 'too-large');
    writeFileSync(path, '12345');
    assert.throws(() => boundedFile(path, 4));
    writeFileSync(join(root, 'public'), 'secret', { mode: 0o644 });
    chmodSync(join(root, 'public'), 0o644);
    assert.throws(() => boundedFile(join(root, 'public')));
    assert.throws(() =>
      encryptSet(output, recipient, { '../escape': Buffer.from('synthetic') }),
    );
    const fdPath = join(output, 'large');
    writeFileSync(fdPath, '');
    truncateSync(fdPath, 1073741824);
    assert.throws(() =>
      encryptSet(output, recipient, { 'audit.jsonl': Buffer.from('{}\n') }),
    );
  }));
