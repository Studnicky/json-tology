import {
  afterEach, before, beforeEach, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  execFileSync, execSync
} from 'node:child_process';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const ROOT = join(import.meta.dirname, '../..');
const CLI = join(ROOT, 'dist/cli.js');

interface CliResult {
  'status': number;
  'stderr': string;
  'stdout': string;
}

interface ExecError {
  'status'?: number;
  'stderr'?: Buffer | string;
  'stdout'?: Buffer | string;
}

function run(args: string, cwd?: string): CliResult {
  try {
    const argv = args.match(/(?:[^\s"]|"[^"]*")+/gu)
      ?.map((token) => {
        return token.replaceAll(/^"|"$/gu, '');
      }) ?? [];
    const stdout = execFileSync(process.execPath, [
      CLI,
      ...argv
    ], {
      'cwd': cwd ?? ROOT,
      'encoding': 'utf8',
      'stdio': [
        'pipe',
        'pipe',
        'pipe'
      ]
    });

    return {
      'status': 0,
      'stderr': '',
      stdout
    };
  } catch (error: unknown) {
    const err = error as ExecError;

    return {
      'status': err.status ?? 1,
      'stderr': String(err.stderr ?? ''),
      'stdout': String(err.stdout ?? '')
    };
  }
}

const SCHEMA_A = {
  '$id': 'https://example.com/Person',
  'properties': {
    'age': { 'type': 'integer' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
};

const SCHEMA_B = {
  '$id': 'https://example.com/Address',
  'properties': {
    'city': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': ['street'],
  'type': 'object'
};

void describe('CLI', () => {
  let tmp: string;
  let schemasDir: string;
  let outputDir: string;

  before(() => {
    // `dist/cli.js` is built by the `pretest:*` lifecycle hooks in
    // package.json (which call `scripts/ensure-built.mjs`). The CLI tests
    // assert it exists rather than running a build mid-suite — running
    // `npm run build` here unconditionally would race against concurrent
    // tiers in `test:all` because `npm run build` invokes `npm run clean`
    // first (`rm -rf dist`), and the smoke tier's example imports resolve
    // `json-tology` → `dist/index.js`.
    assert.ok(
      existsSync(join(ROOT, 'dist/cli.js')),
      'dist/cli.js missing — run `npm run build` (or use `npm test` which runs the pretest hook automatically)'
    );
  });

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'cli-test-'));
    schemasDir = join(tmp, 'schemas');
    outputDir = join(tmp, 'out');
    execSync(`mkdir -p ${schemasDir}`);
    writeFileSync(join(schemasDir, 'person.json'), JSON.stringify(SCHEMA_A));
    writeFileSync(join(schemasDir, 'address.json'), JSON.stringify(SCHEMA_B));
  });

  afterEach(() => {
    rmSync(tmp, {
      'force': true,
      'recursive': true
    });
  });

  void it('runs from published bin path and rejects invalid arguments', () => {
    // Bin path exists
    const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      'bin': Record<string, string>;
    };

    assert.equal(packageJson.bin['json-tology'], './dist/cli.js');
    assert.ok(existsSync(CLI));

    // Table-driven argument rejection scenarios
    const scenarios: Array<[string, RegExp]> = [
      [
        '',
        /Usage/u
      ],
      [
        'validate',
        /unknown command/u
      ],
      [
        `build --output ${outputDir}`,
        /required option/u
      ],
      [
        `build --schema ${join(schemasDir, '*.json')}`,
        /required option/u
      ],
      [
        `build --schema ${join(schemasDir, '*.json')} --output ${outputDir} --verbose`,
        /unknown option/u
      ]
    ];

    for (const [
      args,
      pattern
    ] of scenarios) {
      const result = run(args);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, pattern);
    }
  });

  void it('builds artifact format (default) with normIR and metadata', () => {
    const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir}`);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Built 2 graph/u);

    const files = execSync(`ls ${outputDir}`).toString()
      .trim()
      .split('\n')
      .sort();

    assert.equal(files.length, 2);
    assert.ok(files.some((file) => {
      return file.includes('artifact.json');
    }));

    const artifactFile = files.find((file) => {
      return file.includes('Person');
    });

    assert.ok(artifactFile !== undefined);
    const artifact = JSON.parse(readFileSync(join(outputDir, artifactFile), 'utf8')) as Record<string, unknown>;
    const normIR = artifact.normIR as Record<string, unknown> | undefined;

    assert.ok(normIR !== undefined);
    assert.ok(normIR.rootSchema !== undefined);
    assert.ok(typeof artifact.semanticsHashes === 'object');
  });

  void it('builds schema format', () => {
    const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format schema`);

    assert.equal(result.status, 0);

    const files = execSync(`ls ${outputDir}`).toString()
      .trim()
      .split('\n')
      .sort();

    assert.equal(files.length, 2);
    assert.ok(files.every((file) => {
      return file.includes('schema.json');
    }));

    const schemaFile = files.find((file) => {
      return file.includes('Person');
    });

    assert.ok(schemaFile !== undefined);
    assert.ok(JSON.parse(readFileSync(join(outputDir, schemaFile), 'utf8')) !== undefined);
  });

  void it('builds ontology format with base-iri and output-file options', () => {
    // Default ontology output
    const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology`);

    assert.equal(result.status, 0);
    assert.ok(existsSync(join(outputDir, 'ontology.jsonld')));
    const content = JSON.parse(readFileSync(join(outputDir, 'ontology.jsonld'), 'utf8')) as unknown;

    assert.ok(typeof content === 'object' && content !== null);

    // --base-iri
    const outputDir2 = join(tmp, 'out2');
    const result2 = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir2} --format ontology --base-iri https://consumer.example/base`);

    assert.equal(result2.status, 0);
    const content2 = JSON.parse(readFileSync(join(outputDir2, 'ontology.jsonld'), 'utf8')) as Record<string, unknown>;

    assert.equal(content2['@id'], 'https://consumer.example/base/ontology/');

    // --output-file
    const outputDir3 = join(tmp, 'out3');
    const result3 = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir3} --format ontology --output-file custom-ontology.jsonld --base-iri https://consumer.example/base`);

    assert.equal(result3.status, 0);
    assert.ok(existsSync(join(outputDir3, 'custom-ontology.jsonld')));
    assert.equal(existsSync(join(outputDir3, 'ontology.jsonld')), false);
  });

  void it('builds shacl format', () => {
    const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format shacl`);

    assert.equal(result.status, 0);
    assert.ok(existsSync(join(outputDir, 'shacl.jsonld')));
    const content = JSON.parse(readFileSync(join(outputDir, 'shacl.jsonld'), 'utf8')) as unknown;

    assert.ok(typeof content === 'object' && content !== null);
  });

  void it('handles single file path and rejects unknown formats', () => {
    // Single file (no glob)
    const result = run(`build --schema "${join(schemasDir, 'person.json')}" --output ${outputDir}`);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Built 1 graph/u);

    // Unknown format
    const csvResult = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format csv`);

    assert.notEqual(csvResult.status, 0);
    assert.match(csvResult.stderr, /Unknown format/u);

    // Turtle formats rejected
    for (const fmt of [
      'turtle',
      'shacl-turtle'
    ]) {
      const fmtResult = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ${fmt}`);

      assert.notEqual(fmtResult.status, 0);
      assert.match(fmtResult.stderr, /Unknown format/u);
    }
  });

  void it('creates the output directory if it does not exist', () => {
    const nested = join(outputDir, 'deep', 'nested');
    const result = run(`build --schema "${join(schemasDir, 'person.json')}" --output ${nested}`);

    assert.equal(result.status, 0);
    assert.ok(existsSync(nested));
  });
});
