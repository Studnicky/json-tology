import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const ROOT_PATH = fileURLToPath(ROOT);
const REQUIRED_PATHS = [
  'CHANGELOG.md',
  'LICENSE',
  'README.md',
  'dist/cli.js',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/interfaces/index.d.ts',
  'dist/interfaces/index.js',
  'dist/types/index.d.ts',
  'dist/types/index.js',
  'package.json'
];
const FORBIDDEN_PREFIXES = [
  '.claude/',
  '.flame/',
  'check_',
  'docs/',
  'examples/',
  'node_modules/',
  'scripts/',
  'src/',
  'test/',
  'vendor/'
];

execFileSync('npm', [
  'run',
  'build'
], {
  'cwd': ROOT_PATH,
  'encoding': 'utf8',
  'stdio': 'pipe'
});

const output = execFileSync(
  'npm',
  [
    'pack',
    '--dry-run',
    '--json',
    '--cache',
    '/tmp/json-tology-npm-cache'
  ],
  {
    'cwd': ROOT_PATH,
    'encoding': 'utf8',
    'stdio': 'pipe'
  }
);
const parsed = JSON.parse(output);

assert.ok(Array.isArray(parsed), 'npm pack --json must return an array');
assert.equal(parsed.length, 1, 'expected exactly one packed artifact entry');

const [packResult] = parsed;

assert.ok(Array.isArray(packResult.files), 'pack result must include files');

const packedPaths = packResult.files.map((entry) => {
  assert.equal(typeof entry.path, 'string', 'packed file entries must expose string paths');

  return entry.path;
});

for (const requiredPath of REQUIRED_PATHS) {
  assert.ok(
    packedPaths.includes(requiredPath),
    `packed tarball is missing required file: ${requiredPath}`
  );
}

for (const filePath of packedPaths) {
  assert.ok(
    filePath === 'package.json'
      || filePath === 'README.md'
      || filePath === 'CHANGELOG.md'
      || filePath === 'LICENSE'
      || filePath.startsWith('dist/'),
    `unexpected file in published tarball: ${filePath}`
  );

  for (const prefix of FORBIDDEN_PREFIXES) {
    const hasForbiddenPrefix = filePath.startsWith(prefix);

    assert.equal(
      hasForbiddenPrefix,
      false,
      `forbidden published path detected: ${filePath}`
    );
  }
}

console.log(`Pack surface clean: ${packedPaths.length} files, ${packResult.unpackedSize} bytes unpacked`);
