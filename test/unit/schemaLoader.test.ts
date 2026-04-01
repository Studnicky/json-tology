/**
 * Schema Loader Tests — table-driven scenarios
 */

import {
  after, before, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, rmSync, writeFileSync
} from 'node:fs';
import { resolve } from 'node:path';
import { SchemaLoader } from '../../src/modules/registry/schemaLoader.js';
import { Logger } from '../utils/Logger.js';

const testDir = resolve(import.meta.dirname, 'fixtures', 'schemas');
const validDir = resolve(testDir, 'valid');
const invalidDir = resolve(testDir, 'invalid');
const nestedDir = resolve(validDir, 'nested');
const emptyDir = resolve(testDir, 'empty');
const nonJsonDir = resolve(testDir, 'non-json-only');
const dupDir = resolve(testDir, 'duplicates');

void describe('SchemaLoader', () => {
  before(() => {
    mkdirSync(nestedDir, { 'recursive': true });
    mkdirSync(invalidDir, { 'recursive': true });
    mkdirSync(emptyDir, { 'recursive': true });
    mkdirSync(nonJsonDir, { 'recursive': true });
    mkdirSync(dupDir, { 'recursive': true });

    // Valid schemas
    writeFileSync(
      resolve(validDir, 'user.json'),
      JSON.stringify({
        '$id': 'https://example.io/user',
        'properties': {
          'id': { 'type': 'number' },
          'name': { 'type': 'string' }
        },
        'required': [
          'id',
          'name'
        ],
        'type': 'object'
      })
    );

    writeFileSync(
      resolve(nestedDir, 'product.json'),
      JSON.stringify({
        '$id': 'https://example.io/product',
        'properties': {
          'price': { 'type': 'number' },
          'sku': { 'type': 'string' }
        },
        'required': ['sku'],
        'type': 'object'
      })
    );

    // Invalid schemas
    writeFileSync(resolve(invalidDir, 'no-id.json'), JSON.stringify({ 'type': 'object' }));
    writeFileSync(resolve(invalidDir, 'bad-json.json'), '{ invalid json }');
    writeFileSync(resolve(invalidDir, 'not-object.json'), JSON.stringify([
      1,
      2,
      3
    ]));

    // Non-JSON files only
    writeFileSync(resolve(nonJsonDir, 'readme.txt'), 'This is not JSON');
    writeFileSync(resolve(nonJsonDir, 'notes.md'), '# Notes');

    // Duplicates
    const dupSchema = {
      '$id': 'https://example.io/duplicate',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    };

    writeFileSync(resolve(dupDir, 'file1.json'), JSON.stringify(dupSchema));
    writeFileSync(resolve(dupDir, 'file2.json'), JSON.stringify(dupSchema));

    // readme.txt in valid dir for filter test
    writeFileSync(resolve(validDir, 'readme.txt'), 'This is not JSON');
  });

  after(() => {
    rmSync(testDir, {
      'force': true,
      'recursive': true
    });
  });

  void describe('loadSchema', () => {
    const loadFileScenarios: Array<{
      'expectedId'?: string;
      'expectNull'?: boolean;
      'name': string;
      'path': string;
    }> = [
      {
        'expectedId': 'https://example.io/user',
        'name': 'happy: loads a valid schema with $id',
        'path': resolve(validDir, 'user.json')
      },
      {
        'expectNull': true,
        'name': 'unhappy: returns null for invalid JSON',
        'path': resolve(invalidDir, 'bad-json.json')
      },
      {
        'expectNull': true,
        'name': 'unhappy: returns null for schema without $id',
        'path': resolve(invalidDir, 'no-id.json')
      },
      {
        'expectNull': true,
        'name': 'unhappy: returns null for non-object schema (array)',
        'path': resolve(invalidDir, 'not-object.json')
      },
      {
        'expectNull': true,
        'name': 'edge: returns null for nonexistent file path',
        'path': resolve(testDir, 'does-not-exist.json')
      }
    ];

    for (const {
      'expectedId': id, 'expectNull': isNull, 'name': scenarioName, 'path': filePath
    } of loadFileScenarios) {
      void it(scenarioName, () => {
        const loader = new SchemaLoader(new Logger({ 'silent': true }));
        const schema = loader.loadSchema(filePath);

        if (isNull === true) {
          assert.strictEqual(schema, null);
        } else {
          assert.ok(schema);
          assert.strictEqual(schema.$id, id);
        }
      });
    }
  });

  void describe('loadDirectory', () => {
    const loadDirScenarios: Array<{
      'checkErrors'?: (errors: ReadonlyArray<{ 'reason': string }>) => void;
      'dir': string;
      'expectedFailed': number;
      'expectedLoaded': number;
      'name': string;
      'options'?: {
        'filePattern'?: RegExp;
        'stopOnError'?: boolean;
      };
    }> = [
      {
        'dir': validDir,
        'expectedFailed': 0,
        'expectedLoaded': 2,
        'name': 'happy: loads all schemas recursively from valid directory'
      },
      {
        'checkErrors': (errors) => {
          assert.ok(errors.some((err) => {
            return err.reason === 'invalid-json';
          }));
          assert.ok(errors.some((err) => {
            return err.reason === 'missing-id';
          }));
        },
        'dir': invalidDir,
        'expectedFailed': 3,
        'expectedLoaded': 0,
        'name': 'unhappy: reports loading errors with reasons'
      },
      {
        'checkErrors': (errors) => {
          assert.ok(errors.some((err) => {
            return err.reason === 'duplicate-id';
          }));
        },
        'dir': dupDir,
        'expectedFailed': 1,
        'expectedLoaded': 1,
        'name': 'unhappy: detects duplicate schema IDs'
      },
      {
        'dir': emptyDir,
        'expectedFailed': 0,
        'expectedLoaded': 0,
        'name': 'edge: handles empty directory with zero loaded and zero failed'
      },
      {
        'dir': nonJsonDir,
        'expectedFailed': 0,
        'expectedLoaded': 0,
        'name': 'edge: directory with only non-JSON files loads nothing'
      }
    ];

    for (const {
      'checkErrors': errorCheck, 'dir': dirPath, 'expectedFailed': failed, 'expectedLoaded': loaded, 'name': scenarioName, options
    } of loadDirScenarios) {
      void it(scenarioName, () => {
        const loader = new SchemaLoader(new Logger({ 'silent': true }));
        const [
          loadedSchemas,
          result
        ] = loader.loadDirectory(dirPath, options);

        assert.strictEqual(loadedSchemas.length, loaded);
        assert.strictEqual(result.failed, failed);

        if (errorCheck) {
          errorCheck(result.errors);
        }
      });
    }

    void it('happy: filters by file pattern and counts skipped files', () => {
      const loader = new SchemaLoader(new Logger({ 'silent': true }));
      const [
        _,
        result
      ] = loader.loadDirectory(validDir, { 'filePattern': /\.json$/iu });

      assert.strictEqual(result.skipped, 1);
    });

    void it('unhappy: stops on first error when stopOnError is true', () => {
      const loader = new SchemaLoader(new Logger({ 'silent': true }));
      const [
        _,
        result
      ] = loader.loadDirectory(invalidDir, { 'stopOnError': true });

      assert.ok(result.failed > 0);
    });

    void it('edge: nonexistent directory produces zero results', () => {
      const loader = new SchemaLoader(new Logger({ 'silent': true }));
      const [
        loadedSchemas,
        result
      ] = loader.loadDirectory(resolve(testDir, 'does-not-exist'));

      assert.strictEqual(loadedSchemas.length, 0);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(result.successful, 0);
    });
  });

  void describe('logging', () => {
    void it('happy: invokes custom logger during directory loading', () => {
      const logs: string[] = [];
      const mockLogger = {
        'debug': (msg: string) => {
          return logs.push(`DEBUG: ${msg}`);
        },
        'error': (msg: string) => {
          return logs.push(`ERROR: ${msg}`);
        },
        'fatal': (msg: string) => {
          return logs.push(`FATAL: ${msg}`);
        },
        'info': (msg: string) => {
          return logs.push(`INFO: ${msg}`);
        },
        'trace': (msg: string) => {
          return logs.push(`TRACE: ${msg}`);
        },
        'warn': (msg: string) => {
          return logs.push(`WARN: ${msg}`);
        }
      };

      const loader = new SchemaLoader(mockLogger);

      loader.loadDirectory(validDir);

      assert.ok(logs.some((log) => {
        return log.includes('Loading schemas from');
      }));
      assert.ok(logs.some((log) => {
        return log.includes('Load complete');
      }));
    });
  });
});
