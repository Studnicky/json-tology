/**
 * Subpath exports smoke test.
 *
 * Imports the named exports from every declared subpath in the package
 * `exports` map and asserts that the import resolves and each module
 * exposes an expected top-level export. Catches broken `exports` map
 * entries (missing dist files, wrong paths, etc.) without running a
 * separate pack/install cycle.
 *
 * Tests run against `dist/` so the build must be current. The pretest
 * `ensure-built` script guarantees this when invoked via `npm run test:smoke`.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const CURRENT_DIR = fileURLToPath(new URL('.', import.meta.url));
const PACKAGE_ROOT = resolve(CURRENT_DIR, '../..');
const require = createRequire(import.meta.url);
const pkg = require(`${PACKAGE_ROOT}/package.json`) as { 'exports': Record<string, unknown> };

type ModuleShape = Record<string, unknown>;

void describe('subpath exports', () => {
  void it('dist/index.js — exports JsonTology', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/index.js`) as ModuleShape;

    assert.equal(typeof mod.JsonTology, 'function', 'JsonTology class must be exported from "."');
  });

  void it('dist/value.js — exports Value', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/value.js`) as ModuleShape;

    assert.equal(typeof mod.Value, 'function', 'Value class must be exported from "./value"');
  });

  void it('dist/schema.js — exports SchemaRegistry', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/schema.js`) as ModuleShape;

    assert.equal(typeof mod.SchemaRegistry, 'function', 'SchemaRegistry class must be exported from "./schema"');
  });

  void it('dist/ontology.js — exports OntologyBuilder', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/ontology.js`) as ModuleShape;

    assert.equal(typeof mod.OntologyBuilder, 'function', 'OntologyBuilder class must be exported from "./ontology"');
  });

  void it('dist/types/index.js — resolves as a module', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/types/index.js`) as ModuleShape;

    // types/index.js is a type-only barrel; at runtime it resolves to an empty module object
    assert.equal(typeof mod, 'object', 'types subpath must resolve to a module object');
  });

  void it('dist/interfaces/index.js — resolves as a module', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/interfaces/index.js`) as ModuleShape;

    assert.equal(typeof mod, 'object', 'interfaces subpath must resolve to a module object');
  });

  void it('dist/owl-gen.js — exports generateFromTbox (browser-safe, no node imports)', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/owl-gen.js`) as ModuleShape;

    assert.equal(typeof mod.generateFromTbox, 'function', 'generateFromTbox must be exported from "./owl-gen"');
    assert.equal(typeof mod.generateRegistryDirectory, 'function', 'generateRegistryDirectory must be exported from "./owl-gen"');
  });

  void it('dist/owl-gen-node.js — exports the Node file-writing skin', async () => {
    const mod = await import(`${PACKAGE_ROOT}/dist/owl-gen-node.js`) as ModuleShape;

    assert.equal(typeof mod.writeFromTbox, 'function', 'writeFromTbox must be exported from "./owl-gen-node"');
    assert.equal(typeof mod.writeRegistryDirectory, 'function', 'writeRegistryDirectory must be exported from "./owl-gen-node"');
  });

  void it('package.json exports map contains expected subpaths', () => {
    const subpaths = Object.keys(pkg.exports);

    for (const expected of [
      '.',
      './value',
      './schema',
      './ontology',
      './types',
      './interfaces',
      './owl-gen',
      './owl-gen-node',
      './viz'
    ]) {
      assert.ok(subpaths.includes(expected), `exports map must include "${expected}"`);
    }
  });
});
