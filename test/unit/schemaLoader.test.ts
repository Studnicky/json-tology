/**
 * Schema Loader Tests
 */

import {
  after, before, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, rmSync, writeFileSync
} from 'node:fs';
import { resolve } from 'node:path';
import { SchemaLoader } from '../../src/modules/registry/SchemaLoader.js';
import { Logger } from '../../src/modules/logger/Logger.js';

const testDir = resolve(import.meta.dirname, 'fixtures', 'schemas');
const validDir = resolve(testDir, 'valid');
const invalidDir = resolve(testDir, 'invalid');
const nestedDir = resolve(validDir, 'nested');

void describe('SchemaLoader', () => {
  before(() => {
    // Create test schema files
    mkdirSync(nestedDir, { 'recursive': true });
    mkdirSync(invalidDir, { 'recursive': true });

    // Valid schemas
    const userPath = resolve(validDir, 'user.json');

    writeFileSync(
      userPath,
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

    const productPath = resolve(nestedDir, 'product.json');

    writeFileSync(
      productPath,
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
    const noIdPath = resolve(invalidDir, 'no-id.json');

    writeFileSync(noIdPath, JSON.stringify({ 'type': 'object' }));

    const badJsonPath = resolve(invalidDir, 'bad-json.json');

    writeFileSync(badJsonPath, '{ invalid json }');

    const notObjectPath = resolve(invalidDir, 'not-object.json');

    writeFileSync(notObjectPath, JSON.stringify([
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

  void it('should load a single schema from file', () => {
    const loader = new SchemaLoader(new Logger());
    const userPath = resolve(validDir, 'user.json');
    const schema = loader.loadSchema(userPath);

    assert.ok(schema);
    assert.strictEqual(schema.$id, 'https://example.io/user');
  });

  void it('should return null for invalid JSON file', () => {
    const loader = new SchemaLoader(new Logger());
    const badJsonPath = resolve(invalidDir, 'bad-json.json');
    const schema = loader.loadSchema(badJsonPath);

    assert.strictEqual(schema, null);
  });

  void it('should return null for schema without $id', () => {
    const loader = new SchemaLoader(new Logger());
    const noIdPath = resolve(invalidDir, 'no-id.json');
    const schema = loader.loadSchema(noIdPath);

    assert.strictEqual(schema, null);
  });

  void it('should return null for non-object schema', () => {
    const loader = new SchemaLoader(new Logger());
    const notObjectPath = resolve(invalidDir, 'not-object.json');
    const schema = loader.loadSchema(notObjectPath);

    assert.strictEqual(schema, null);
  });

  void it('should load all schemas from a directory recursively', () => {
    const loader = new SchemaLoader(new Logger());
    const [
      loadedSchemas,
      result
    ] = loader.loadDirectory(validDir);

    assert.strictEqual(loadedSchemas.length, 2);
    assert.strictEqual(result.successful, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.skipped, 0);
  });

  void it('should report loading errors', () => {
    const loader = new SchemaLoader(new Logger());
    const [
      _loadedSchemas,
      result
    ] = loader.loadDirectory(invalidDir);

    assert.ok(result.failed > 0);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((err) => {
      return err.reason === 'invalid-json';
    }));
    assert.ok(result.errors.some((err) => {
      return err.reason === 'no-id';
    }));
  });

  void it('should log with custom logger', () => {
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

  void it('should detect duplicate schema IDs', () => {
    // Create directory with duplicate IDs
    const dupDir = resolve(testDir, 'duplicates');

    mkdirSync(dupDir, { 'recursive': true });

    const schema = {
      '$id': 'https://example.io/duplicate',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    };
    const file1Path = resolve(dupDir, 'file1.json');
    const file2Path = resolve(dupDir, 'file2.json');

    writeFileSync(file1Path, JSON.stringify(schema));
    writeFileSync(file2Path, JSON.stringify(schema));

    const loader = new SchemaLoader(new Logger());
    const [
      _loadedSchemas,
      result
    ] = loader.loadDirectory(dupDir);

    assert.strictEqual(_loadedSchemas.length, 1);
    assert.strictEqual(result.failed, 1);
    assert.ok(result.errors.some((err) => {
      return err.reason === 'duplicate-id';
    }));

    rmSync(dupDir, { 'recursive': true });
  });

  void it('should filter by file pattern', () => {
    mkdirSync(validDir, { 'recursive': true });

    // Create a non-JSON file
    const readmePath = resolve(validDir, 'readme.txt');

    writeFileSync(readmePath, 'This is not JSON');

    const loader = new SchemaLoader(new Logger());
    const [
      _loadedSchemas,
      result
    ] = loader.loadDirectory(validDir, { 'filePattern': /\.json$/iu });

    // Should skip the .txt file
    assert.strictEqual(result.skipped, 1);
  });

  void it('should stop on error if stopOnError is true', () => {
    const loader = new SchemaLoader(new Logger());
    const [
      _loadedSchemas,
      result
    ] = loader.loadDirectory(invalidDir, { 'stopOnError': true });

    // Should have stopped early
    assert.ok(result.failed > 0);
  });
});
