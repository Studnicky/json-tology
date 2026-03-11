/**
 * Schema Loader Tests
 */

import { describe, it, before, after } from 'node:test';
import * as assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import { SchemaLoader } from '../../src/schema/SchemaLoader.js';
import { ConsoleLogger } from '../../src/ConsoleLogger.js';

const testDir = resolve(import.meta.dirname ?? '.', 'fixtures', 'schemas');

describe('SchemaLoader', () => {
  before(() => {
    // Create test schema files
    mkdirSync(resolve(testDir, 'valid', 'nested'), { recursive: true });
    mkdirSync(resolve(testDir, 'invalid'), { recursive: true });

    // Valid schemas
    writeFileSync(
      resolve(testDir, 'valid', 'user.json'),
      JSON.stringify({
        $id: 'https://example.io/user',
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
        },
        required: ['id', 'name'],
      }),
    );

    writeFileSync(
      resolve(testDir, 'valid', 'nested', 'product.json'),
      JSON.stringify({
        $id: 'https://example.io/product',
        type: 'object',
        properties: {
          sku: { type: 'string' },
          price: { type: 'number' },
        },
        required: ['sku'],
      }),
    );

    // Invalid schemas
    writeFileSync(resolve(testDir, 'invalid', 'no-id.json'), JSON.stringify({ type: 'object' }));

    writeFileSync(resolve(testDir, 'invalid', 'bad-json.json'), '{ invalid json }');

    writeFileSync(resolve(testDir, 'invalid', 'not-object.json'), JSON.stringify([1, 2, 3]));
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('should load a single schema from file', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const schema = loader.loadSchema(resolve(testDir, 'valid', 'user.json'));

    assert.ok(schema);
    assert.strictEqual(schema?.['$id'], 'https://example.io/user');
  });

  it('should return null for invalid JSON file', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const schema = loader.loadSchema(resolve(testDir, 'invalid', 'bad-json.json'));

    assert.strictEqual(schema, null);
  });

  it('should return null for schema without $id', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const schema = loader.loadSchema(resolve(testDir, 'invalid', 'no-id.json'));

    assert.strictEqual(schema, null);
  });

  it('should return null for non-object schema', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const schema = loader.loadSchema(resolve(testDir, 'invalid', 'not-object.json'));

    assert.strictEqual(schema, null);
  });

  it('should load all schemas from a directory recursively', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const [schemas, result] = loader.loadDirectory(resolve(testDir, 'valid'));

    assert.strictEqual(schemas.length, 2);
    assert.strictEqual(result.successful, 2);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.skipped, 0);
  });

  it('should report loading errors', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const [schemas, result] = loader.loadDirectory(resolve(testDir, 'invalid'));

    assert.ok(result.failed > 0);
    assert.ok(result.errors.length > 0);
    assert.ok(result.errors.some((err) => err.reason === 'invalid-json'));
    assert.ok(result.errors.some((err) => err.reason === 'no-id'));
  });

  it('should log with custom logger', () => {
    const logs: string[] = [];
    const mockLogger = {
      trace: (msg: string) => logs.push(`TRACE: ${msg}`),
      debug: (msg: string) => logs.push(`DEBUG: ${msg}`),
      info:  (msg: string) => logs.push(`INFO: ${msg}`),
      warn:  (msg: string) => logs.push(`WARN: ${msg}`),
      error: (msg: string) => logs.push(`ERROR: ${msg}`),
      fatal: (msg: string) => logs.push(`FATAL: ${msg}`),
    };

    const loader = new SchemaLoader(mockLogger);
    loader.loadDirectory(resolve(testDir, 'valid'));

    assert.ok(logs.some((log) => log.includes('Loading schemas from')));
    assert.ok(logs.some((log) => log.includes('Load complete')));
  });

  it('should detect duplicate schema IDs', () => {
    // Create directory with duplicate IDs
    const dupDir = resolve(testDir, 'duplicates');
    mkdirSync(dupDir, { recursive: true });

    const schema = {
      $id: 'https://example.io/duplicate',
      type: 'object',
      properties: { name: { type: 'string' } },
    };

    writeFileSync(resolve(dupDir, 'file1.json'), JSON.stringify(schema));
    writeFileSync(resolve(dupDir, 'file2.json'), JSON.stringify(schema));

    const loader = new SchemaLoader(ConsoleLogger);
    const [schemas, result] = loader.loadDirectory(dupDir);

    assert.strictEqual(schemas.length, 1);
    assert.strictEqual(result.failed, 1);
    assert.ok(result.errors.some((err) => err.reason === 'duplicate-id'));

    rmSync(dupDir, { recursive: true });
  });

  it('should filter by file pattern', () => {
    const validDir = resolve(testDir, 'valid');
    mkdirSync(validDir, { recursive: true });

    // Create a non-JSON file
    writeFileSync(resolve(validDir, 'readme.txt'), 'This is not JSON');

    const loader = new SchemaLoader(ConsoleLogger);
    const [schemas, result] = loader.loadDirectory(validDir, {
      filePattern: /\.json$/i,
    });

    // Should skip the .txt file
    assert.strictEqual(result.skipped, 1);
  });

  it('should stop on error if stopOnError is true', () => {
    const loader = new SchemaLoader(ConsoleLogger);
    const [schemas, result] = loader.loadDirectory(resolve(testDir, 'invalid'), {
      stopOnError: true,
    });

    // Should have stopped early
    assert.ok(result.failed > 0);
  });
});
