import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

interface BrowserModuleType {
  readonly 'JsonTology': {
    'create': (options: {
      'baseIRI': string;
      'schemas': readonly object[];
    }) => {
      'is': (id: string, data: unknown) => boolean;
    };
  };
}

const bundleDir = resolve(import.meta.dirname, '../../dist-browser');

void test('browser bundle exists and is ESM', () => {
  const bundle = readFileSync(resolve(bundleDir, 'json-tology.js'), 'utf8');

  assert.match(bundle, /export\s*\{/u, 'bundle has named exports');
});

void test('browser bundle has zero node:* imports', () => {
  const bundle = readFileSync(resolve(bundleDir, 'json-tology.js'), 'utf8');

  assert.doesNotMatch(bundle, /require\s*\(\s*["']node:/u);
  assert.doesNotMatch(bundle, /from\s+["']node:/u);
});

void test('browser bundle is loadable in a fresh module context and exposes JsonTology', async () => {
  const url = `file://${resolve(bundleDir, 'json-tology.js')}`;
  const mod = await import(url) as BrowserModuleType;

  assert.equal(typeof mod.JsonTology, 'function', 'JsonTology export is a class');
  assert.equal(typeof mod.JsonTology.create, 'function', 'JsonTology.create static exists');
});

void test('schema.browser bundle excludes SchemaLoader', () => {
  const bundle = readFileSync(resolve(bundleDir, 'json-tology.schema.js'), 'utf8');

  assert.doesNotMatch(bundle, /class SchemaLoader/u);
});

void test('JsonTology.create + validate works end-to-end in browser bundle', async () => {
  const url = `file://${resolve(bundleDir, 'json-tology.js')}`;
  const { JsonTology } = await import(url) as BrowserModuleType;

  const UserSchema = {
    '$id': 'https://example.com/User',
    'properties': {
      'age': { 'type': 'integer' },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  };

  const jt = JsonTology.create({
    'baseIRI': 'https://example.com',
    'schemas': [UserSchema]
  });
  const valid = jt.is('https://example.com/User', { 'name': 'Ada' });

  assert.equal(valid, true);
});
