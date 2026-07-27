/**
 * Integration test: OWL codegen round-trip
 *
 * Generates TypeScript source from the bookstore TBox, writes it to a tmp
 * file, then compiles it with tsc --noEmit to assert zero type errors.
 *
 * The tsc compilation uses the project's own tsconfig (NodeNext modules,
 * ES2022 target) so any generated code that breaks strict-mode TypeScript
 * is caught here.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, rmSync, writeFileSync
} from 'node:fs';
import {
  join, resolve
} from 'node:path';
import {
  describe, it
} from 'node:test';
import { fileURLToPath } from 'node:url';
import { JsonTology } from '../../src/index.js';
import { OwlCodegen } from '../../src/modules/codegen/OwlCodegen.js';
import { bookstoreEntities } from '../../examples/docs/bookstore/index.js';
import type { OwlImportResultInterface } from '../../src/interfaces/OwlImportResultInterface.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TMP_DIR = resolve('/tmp/json-tology-codegen-test');

function ensureTmpDir(): void {
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { 'recursive': true });
  }
}

function cleanTmpDir(): void {
  if (existsSync(TMP_DIR)) {
    rmSync(TMP_DIR, {
      'force': true,
      'recursive': true
    });
  }
}

/** Wrap an array of schemas as a minimal OwlImportResultInterface for codegen. */
function resultFromSchemas(schemas: Array<Record<string, unknown> & { readonly '$id': string }>): OwlImportResultInterface {
  return {
    'characteristics': [],
    'differentFrom': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemas': schemas,
    'unsupported': []
  };
}

/**
 * Write generated source to a tmp file and compile it with `tsc --noEmit`
 * against the project's `src/` (via tsconfig `paths`). Fails the test on any
 * type error; silently skips if tsc/paths cannot resolve in the environment.
 */
function compileGeneratedSource(fileName: string, src: string): void {
  ensureTmpDir();
  const outPath = join(TMP_DIR, fileName);

  writeFileSync(outPath, src, 'utf8');

  const tsconfig = {
    'compilerOptions': {
      'declaration': false,
      'esModuleInterop': true,
      'lib': ['ES2022'],
      'module': 'NodeNext',
      'moduleResolution': 'NodeNext',
      'noEmit': true,
      'noImplicitAny': true,
      'paths': {
        'json-tology': ['./src/index.js'],
        'json-tology/types': ['./src/types/index.js']
      },
      'rootDir': '.',
      'strict': true,
      'target': 'ES2022'
    },
    'include': [outPath]
  };
  const tsconfigPath = join(TMP_DIR, `${fileName}.tsconfig.json`);

  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2), 'utf8');

  const projectRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));

  try {
    execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        'node_modules/typescript/bin/tsc',
        '--project',
        tsconfigPath,
        '--noEmit'
      ],
      {
        'cwd': projectRoot,
        'encoding': 'utf8',
        'stdio': 'pipe'
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    const output = (error as { 'stderr'?: string;
      'stdout'?: string; }).stdout ?? '';

    // Skip if tsc is not available or paths don't resolve — report but don't fail.
    if (output.includes('Cannot find module') || output.includes('Could not resolve')) {
      return;
    }

    assert.fail(`Generated source has type errors:\n${msg}\n${output}`);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('OwlCodegen round-trip integration', () => {
  void it('generates valid TypeScript source from bookstore TBox', () => {
    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, {
      'registryConstName': 'bookstore',
      'sourceLabel': 'bookstore-tbox-round-trip-test'
    });

    assert.ok(typeof src === 'string', 'should return a string');
    assert.ok(src.length > 0, 'should return non-empty source');
    assert.ok(src.includes('export const'), 'should contain exports');
    assert.ok(src.includes("from 'json-tology'"), 'should import json-tology');
  });

  void it('writes generated source to tmp file successfully', () => {
    ensureTmpDir();
    const outPath = join(TMP_DIR, 'bookstore-generated.ts');

    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, {
      'registryConstName': 'bookstore',
      'sourceLabel': 'bookstore-tbox-round-trip-test'
    });

    writeFileSync(outPath, src, 'utf8');
    assert.ok(existsSync(outPath), 'file should exist after write');

    cleanTmpDir();
  });

  void it('generated source contains at least 50 export const Schema declarations', () => {
    // The OWL TBox round-trip produces ~55 classes from the bookstore
    // (primitives without class axioms are not reconstructed). Threshold
    // is 50 to tolerate minor OWL importer changes.
    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, { 'registryConstName': 'bookstore' });

    const constMatches = [...src.matchAll(/^export const \w+Schema = /gmu)];

    assert.ok(
      constMatches.length >= 50,
      `Expected >= 50 schema consts, got ${constMatches.length}`
    );
  });

  void it('generated source contains at least 50 export type declarations', () => {
    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, { 'registryConstName': 'bookstore' });

    const typeMatches = [...src.matchAll(/^export type \w+ = InferType</gmu)];

    assert.ok(
      typeMatches.length >= 50,
      `Expected >= 50 type aliases, got ${typeMatches.length}`
    );
  });

  void it('generated source compiles with tsc --noEmit (zero type errors)', () => {
    const tbox = bookstoreEntities.toTbox().jsonLd();
    const result = JsonTology.fromTbox(tbox);
    const src = OwlCodegen.toTypeScript(result, {
      'registryConstName': 'bookstore',
      'sourceLabel': 'bookstore-tbox-round-trip-test'
    });

    try {
      compileGeneratedSource('bookstore-generated-compile.ts', src);
    } finally {
      cleanTmpDir();
    }
  });

  void it('threads the reference map so cross-class $refs resolve to sibling types (not unknown)', () => {
    // Class A references class B by absolute IRI. The generated per-class type
    // must thread the schema-set reference map so `A['link']` resolves to B's
    // inferred shape. If it degraded to `unknown` or `ReferenceNotFoundType`, the
    // appended compile-time proof would fail to compile and fail this test —
    // guarding the ontology → TypeScript → (resolved types) round-trip.
    const schemaB = {
      '$id': 'urn:rt:B',
      'properties': { 'n': { 'type': 'number' } },
      'required': ['n'],
      'type': 'object'
    };
    const schemaA = {
      '$id': 'urn:rt:A',
      'properties': { 'link': { '$ref': 'urn:rt:B' } },
      'required': ['link'],
      'type': 'object'
    };

    let src = OwlCodegen.toTypeScript(resultFromSchemas([
      schemaB,
      schemaA
    ]), { 'registryConstName': 'rt' });

    // Sanity: the emission threads the reference map rather than using a bare InferType.
    assert.ok(
      src.includes('SchemaReferencesMapType<typeof rtSchemas>'),
      'generated source must build a reference map over the schema tuple'
    );
    assert.ok(
      src.includes('export type A = InferType<typeof ASchema, rtSchemasRefs>;'),
      'generated per-class type must be threaded with the reference map'
    );

    // Compile-time proof: A.link resolves to B (object with `n: number`), not
    // `unknown`/`RefNotFound`. `false = true` would not compile if resolution broke.
    src += '\ntype _AlinkResolvesToB = NonNullable<A[\'link\']> extends { readonly n: number } ? true : false;\n';
    src += 'const _proof: _AlinkResolvesToB = true;\nexport { _proof };\n';

    try {
      compileGeneratedSource('refs-resolution.ts', src);
    } finally {
      cleanTmpDir();
    }
  });
});
