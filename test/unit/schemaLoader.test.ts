/**
 * Schema Loader Tests
 */

import {
  after, before, describe, it
} from 'node:test';
import * as assert from 'node:assert';
import {
  mkdirSync, rmSync, writeFileSync
} from 'node:fs';
import { resolve } from 'node:path';
import { SchemaLoader } from '../../src/modules/registry/SchemaLoader.js';
import { Logger } from '../../src/modules/logger/Logger.js';

const testDir = resolve(import.meta.dirname ?? '.', 'fixtures', 'schemas');

describe('SchemaLoader', () => {
  before(() => {
    // Create test schema files
    mkdirSync(resolve(testDir, 'valid', 'nested'), { 'recursive': true });
    mkdirSync(resolve(testDir, 'invalid'), { 'recursive': true });

    // Valid schemas
    writeFileSync(
      resolve(testDir, 'valid', 'user.json'),
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
      resolve(testDir, 'valid', 'nested', 'product.json'),
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
    writeFileSync(resolve(testDir, 'invalid', 'no-id.json'), JSON.stringify({ 'type': 'object' }));

    writeFileSync(resolve(testDir, 'invalid', 'bad-json.json'), '{ invalid json }');

    writeFileSync(resolve(testDir, 'invalid', 'not-object.json'), JSON.stringify([
      1,
      2,
      3
    ]));
  });

  after(() => {
    rmSync(testDir, {
      'force': true,
      'recursive': true
    });
  });

  it('should load a single schema from file', () => {
    const loader = new SchemaLoader(new Logger());
    const schema = loader.loadSchema(resolve(testDir, 'valid', 'user.json'));

    assert.ok(schema);
    assert.strictEqual(schema?.$id, 'https://example.io/user');
  });

  it('should return null for invalid JSON file', () => {
    const loader = new SchemaLoader(new Logger());
    const schema = loader.loadSchema(resolve(testDir, 'invalid', 'bad-json.json'));

    assert.strictEqual(schema, null);
  });

  it('should return null for schema without $id', () => {
    const loader = new SchemaLoader(new Logger());
    const schema = loader.loadSchema(resolve(testDir, 'invalid', 'no-id.json'));

    assert.strictEqual(schema, null);
  });

  it('should return null for non-object schema', () => {
    const loader = new SchemaLoader(new Logger());
    const schema = loader.loadSchema(resolve(testDir, 'invalid', 'not-object.json'));

    assert.strictEqual(schema, null);
  });

  it('should load all schemas from a directory recursively', () => {
    const loader = new SchemaLoader(new Logger());
    const [
      schemas,
      result
    ] = loader.loadDirectory(resolve(testDir, 'valid'));

    assert.strictEqual(schemas.length, 2);
    assert.strictEqual(result.successful, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.skipped, 0);
  });

  it('should report loading errors', () => {
    const loader = new SchemaLoader(new Logger());
    const [
      schemas,
      result
    ] = loader.loadDirectory(resolve(testDir, 'invalid'));

    assert.ok(result.failed > 0);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((err) => {
      return err.reason === 'invalid-json';
    }));
    assert.ok(result.errors.some((err) => {
      return err.reason === 'no-id';
    }));
  });

  it('should log with custom logger', () => {
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

    loader.loadDirectory(resolve(testDir, 'valid'));

    assert.ok(logs.some((log) => {
      return log.includes('Loading schemas from');
    }));
    assert.ok(logs.some((log) => {
      return log.includes('Load complete');
    }));
  });

  it('should detect duplicate schema IDs', () => {
    // Create directory with duplicate IDs
    const dupDir = resolve(testDir, 'duplicates');

    mkdirSync(dupDir, { 'recursive': true });

    const schema = {
      '$id': 'https://example.io/duplicate',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    };

    writeFileSync(resolve(dupDir, 'file1.json'), JSON.stringify(schema));
    writeFileSync(resolve(dupDir, 'file2.json'), JSON.stringify(schema));

    const loader = new SchemaLoader(new Logger());
    const [
      schemas,
      result
    ] = loader.loadDirectory(dupDir);

    assert.strictEqual(schemas.length, 1);
    assert.strictEqual(result.failed, 1);
    assert.ok(result.errors.some((err) => {
      return err.reason === 'duplicate-id';
    }));

    rmSync(dupDir, { 'recursive': true });
  });

  it('should filter by file pattern', () => {
    const validDir = resolve(testDir, 'valid');

    mkdirSync(validDir, { 'recursive': true });

    // Create a non-JSON file
    writeFileSync(resolve(validDir, 'readme.txt'), 'This is not JSON');

    const loader = new SchemaLoader(new Logger());
    const [
      schemas,
      result
    ] = loader.loadDirectory(validDir, { 'filePattern': /\.json$/i });

    // Should skip the .txt file
    assert.strictEqual(result.skipped, 1);
  });

  it('should stop on error if stopOnError is true', () => {
    const loader = new SchemaLoader(new Logger());
    const [
      schemas,
      result
    ] = loader.loadDirectory(resolve(testDir, 'invalid'), { 'stopOnError': true });

    // Should have stopped early
    assert.ok(result.failed > 0);
  });
});
