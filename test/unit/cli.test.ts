import {
  afterEach, before, beforeEach, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
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
    const stdout = execSync(`${process.execPath} ${CLI} ${args}`, {
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
    execSync('npm run build', {
      'cwd': ROOT,
      'stdio': [
        'ignore',
        'pipe',
        'pipe'
      ]
    });
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

  void describe('argument parsing', () => {
    void it('runs the built CLI from the published bin path', () => {
      const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
        'bin': Record<string, string>;
      };

      assert.equal(packageJson.bin['json-tology'], './dist/cli.js');
      assert.ok(existsSync(CLI));
    });

    void it('exits with usage when no arguments given', () => {
      const result = run('');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    void it('exits with usage when command is not build', () => {
      const result = run('validate');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    void it('exits with usage when --schema is missing', () => {
      const result = run(`build --output ${outputDir}`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    void it('exits with usage when --output is missing', () => {
      const result = run(`build --schema ${join(schemasDir, '*.json')}`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    void it('exits with error on unknown option', () => {
      const result = run(`build --schema ${join(schemasDir, '*.json')} --output ${outputDir} --verbose`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unknown option/u);
    });
  });

  void describe('build --format artifact (default)', () => {
    void it('produces artifact JSON files for each schema', () => {
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

      // Verify artifact structure
      const artifactFile = files.find((file) => {
        return file.includes('Person');
      });

      assert.ok(artifactFile !== undefined, 'Person artifact file should exist');
      const artifact = JSON.parse(readFileSync(join(outputDir, artifactFile), 'utf8')) as Record<string, unknown>;

      const normIR = artifact.normIR as Record<string, unknown> | undefined;

      assert.ok(normIR !== undefined);
      assert.ok(normIR.rootSchema !== undefined);
      assert.ok(typeof artifact.semanticsHashes === 'object');
    });
  });

  void describe('build --format schema', () => {
    void it('produces schema JSON files', () => {
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

      assert.ok(schemaFile !== undefined, 'Person schema file should exist');
      const content = JSON.parse(readFileSync(join(outputDir, schemaFile), 'utf8')) as unknown;

      assert.ok(content !== undefined);
    });
  });

  void describe('build --format ontology', () => {
    void it('produces a single ontology.jsonld file', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology`);

      assert.equal(result.status, 0);

      const outFile = join(outputDir, 'ontology.jsonld');

      assert.ok(existsSync(outFile));

      const content = JSON.parse(readFileSync(outFile, 'utf8')) as unknown;

      assert.ok(typeof content === 'object' && content !== null, 'ontology output should be a JSON object');
    });

    void it('uses --base-iri for the ontology document id', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology --base-iri https://consumer.example/base`);

      assert.equal(result.status, 0);

      const outFile = join(outputDir, 'ontology.jsonld');
      const content = JSON.parse(readFileSync(outFile, 'utf8')) as Record<string, unknown>;

      assert.equal(content['@id'], 'https://consumer.example/base/ontology/');
    });

    void it('uses --output-file to override the default ontology filename', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology --output-file custom-ontology.jsonld --base-iri https://consumer.example/base`);

      assert.equal(result.status, 0);
      assert.ok(existsSync(join(outputDir, 'custom-ontology.jsonld')));
      assert.equal(existsSync(join(outputDir, 'ontology.jsonld')), false);
    });
  });

  void describe('build --format shacl', () => {
    void it('produces a single shacl.jsonld file', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format shacl`);

      assert.equal(result.status, 0);

      const outFile = join(outputDir, 'shacl.jsonld');

      assert.ok(existsSync(outFile));

      const content = JSON.parse(readFileSync(outFile, 'utf8')) as unknown;

      assert.ok(typeof content === 'object' && content !== null, 'SHACL output should be a JSON object');
    });
  });

  void describe('build with single file path (no glob)', () => {
    void it('handles a direct file path without wildcards', () => {
      const result = run(`build --schema "${join(schemasDir, 'person.json')}" --output ${outputDir}`);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /Built 1 graph/u);
    });
  });

  void describe('build --format unknown', () => {
    void it('exits with error for unknown format', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format csv`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unknown format/u);
    });

    void it('rejects turtle output formats because JSON-LD is the supported serialization target', () => {
      const turtleResult = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format turtle`);
      const shaclTurtleResult = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format shacl-turtle`);

      assert.notEqual(turtleResult.status, 0);
      assert.match(turtleResult.stderr, /Unknown format/u);
      assert.notEqual(shaclTurtleResult.status, 0);
      assert.match(shaclTurtleResult.stderr, /Unknown format/u);
    });
  });

  void describe('output directory creation', () => {
    void it('creates the output directory if it does not exist', () => {
      const nested = join(outputDir, 'deep', 'nested');
      const result = run(`build --schema "${join(schemasDir, 'person.json')}" --output ${nested}`);

      assert.equal(result.status, 0);
      assert.ok(existsSync(nested));
    });
  });
});
