import {
  afterEach, beforeEach, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const CLI = join(import.meta.dirname, '../../src/cli.ts');

function run(args: string, cwd?: string): { 'status': number
  'stderr': string;
  'stdout': string; } {
  try {
    const stdout = execSync(`${process.execPath} ./node_modules/tsx/dist/cli.mjs ${CLI} ${args}`, {
      cwd,
      'encoding': 'utf-8',
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
    const err = error as { 'status': number
      'stderr': string;
      'stdout': string; };

    return {
      'status': err.status ?? 1,
      'stderr': err.stderr ?? '',
      'stdout': err.stdout ?? ''
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

describe('CLI', () => {
  let tmp: string;
  let schemasDir: string;
  let outputDir: string;

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

  describe('argument parsing', () => {
    it('exits with usage when no arguments given', () => {
      const result = run('');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    it('exits with usage when command is not build', () => {
      const result = run('validate');

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    it('exits with usage when --schema is missing', () => {
      const result = run(`build --output ${outputDir}`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    it('exits with usage when --output is missing', () => {
      const result = run(`build --schema ${join(schemasDir, '*.json')}`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Usage/u);
    });

    it('exits with error on unknown option', () => {
      const result = run(`build --schema ${join(schemasDir, '*.json')} --output ${outputDir} --verbose`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unknown option/u);
    });
  });

  describe('build --format artifact (default)', () => {
    it('produces artifact JSON files for each schema', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir}`);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /Built 2 graph/u);

      const files = execSync(`ls ${outputDir}`).toString()
        .trim()
        .split('\n')
        .sort();

      assert.equal(files.length, 2);
      assert.ok(files.some((f) => {
        return f.includes('artifact.json');
      }));

      // Verify artifact structure
      const artifactFile = files.find((f) => {
        return f.includes('Person');
      })!;
      const artifact = JSON.parse(readFileSync(join(outputDir, artifactFile), 'utf-8'));

      assert.equal(artifact.version, 2);
      assert.ok(artifact.normIR);
      assert.ok(artifact.normIR.rootSchema);
      assert.ok(typeof artifact.semanticsHashes === 'object');
    });
  });

  describe('build --format schema', () => {
    it('produces schema JSON files', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format schema`);

      assert.equal(result.status, 0);

      const files = execSync(`ls ${outputDir}`).toString()
        .trim()
        .split('\n')
        .sort();

      assert.equal(files.length, 2);
      assert.ok(files.every((f) => {
        return f.includes('schema.json');
      }));

      const schemaFile = files.find((f) => {
        return f.includes('Person');
      })!;
      const content = JSON.parse(readFileSync(join(outputDir, schemaFile), 'utf-8'));

      assert.ok(content);
    });
  });

  describe('build --format ontology', () => {
    it('produces a single ontology.jsonld file', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology`);

      assert.equal(result.status, 0);

      const outFile = join(outputDir, 'ontology.jsonld');

      assert.ok(existsSync(outFile));

      const content = JSON.parse(readFileSync(outFile, 'utf-8'));

      assert.ok(typeof content === 'object' && content !== null, 'ontology output should be a JSON object');
    });

    it('uses --base-iri for the ontology document id', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology --base-iri https://consumer.example/base`);

      assert.equal(result.status, 0);

      const outFile = join(outputDir, 'ontology.jsonld');
      const content = JSON.parse(readFileSync(outFile, 'utf-8'));

      assert.equal(content['@id'], 'https://consumer.example/base/ontology/');
    });

    it('uses --output-file to override the default ontology filename', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format ontology --output-file custom-ontology.jsonld --base-iri https://consumer.example/base`);

      assert.equal(result.status, 0);
      assert.ok(existsSync(join(outputDir, 'custom-ontology.jsonld')));
      assert.equal(existsSync(join(outputDir, 'ontology.jsonld')), false);
    });
  });

  describe('build --format shacl', () => {
    it('produces a single shacl.jsonld file', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format shacl`);

      assert.equal(result.status, 0);

      const outFile = join(outputDir, 'shacl.jsonld');

      assert.ok(existsSync(outFile));

      const content = JSON.parse(readFileSync(outFile, 'utf-8'));

      assert.ok(typeof content === 'object' && content !== null, 'SHACL output should be a JSON object');
    });
  });

  describe('build with single file path (no glob)', () => {
    it('handles a direct file path without wildcards', () => {
      const result = run(`build --schema "${join(schemasDir, 'person.json')}" --output ${outputDir}`);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /Built 1 graph/u);
    });
  });

  describe('build --format unknown', () => {
    it('exits with error for unknown format', () => {
      const result = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format csv`);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Unknown format/u);
    });

    it('rejects turtle output formats because JSON-LD is the supported serialization target', () => {
      const turtleResult = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format turtle`);
      const shaclTurtleResult = run(`build --schema "${join(schemasDir, '*.json')}" --output ${outputDir} --format shacl-turtle`);

      assert.notEqual(turtleResult.status, 0);
      assert.match(turtleResult.stderr, /Unknown format/u);
      assert.notEqual(shaclTurtleResult.status, 0);
      assert.match(shaclTurtleResult.stderr, /Unknown format/u);
    });
  });

  describe('output directory creation', () => {
    it('creates the output directory if it does not exist', () => {
      const nested = join(outputDir, 'deep', 'nested');
      const result = run(`build --schema "${join(schemasDir, 'person.json')}" --output ${nested}`);

      assert.equal(result.status, 0);
      assert.ok(existsSync(nested));
    });
  });
});
