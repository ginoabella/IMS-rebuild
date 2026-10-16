import { execFileSync, spawnSync } from 'node:child_process';
import { getFileInfo } from 'prettier';
const mode = process.argv[2];
if (process.argv.length !== 3 || !['--check', '--write'].includes(mode))
  throw new Error('Use --check or --write');
// Do not recursively traverse ignored deployment custody. Prettier's directory
// expansion can scandir those paths before applying its ignore file. Git prunes
// ignored directories and includes new reviewable source without reading secrets.
const names = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const candidates = await Promise.all(
  names.map(async (name) => ({
    name,
    info: await getFileInfo(name, { ignorePath: '.prettierignore' }),
  })),
);
const files = candidates
  .filter(({ info }) => !info.ignored && info.inferredParser)
  .map(({ name }) => name);
if (!files.length) throw new Error('No formattable repository files');
const result = spawnSync('pnpm', ['exec', 'prettier', mode, ...files], {
  stdio: 'inherit',
});
process.exitCode = result.status ?? 1;
