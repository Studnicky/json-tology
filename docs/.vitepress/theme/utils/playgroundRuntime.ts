// In-browser module loader for runnable examples.
//
// An example is a real .ts file in examples/docs/**. To execute its (possibly
// edited) source in the browser we must resolve its imports. Imports fall into
// two worlds:
//
//   1. The library and bare npm libs (json-tology, zod, valibot, typebox) —
//      imported STATICALLY here so Vite bundles them optimally. The library's
//      own deep deps (jsonld, @rdfjs/types) ride along in that bundle and never
//      touch the text loader.
//   2. Example-tree modules (the bookstore barrel, entity files, local helpers)
//      — loaded LAZILY from their raw source via a tiny CommonJS evaluator,
//      memoized, so only modules an example actually imports are evaluated and
//      side-effectful module bodies run at most once.
//
// `runExample` transpiles the example's editor text with sucrase and executes
// it with a `require` shim bound to the example's path.

import { transform } from 'sucrase';

import * as jtIndex from '../../../../src/index.js';
import * as jtTypes from '../../../../src/types/index.js';
import * as jtOwlGen from '../../../../src/owl-gen.js';
import * as jtSchema from '../../../../src/schema.js';
import * as jtValue from '../../../../src/value.js';
import * as jtOntology from '../../../../src/ontology.js';
import * as jtInterfaces from '../../../../src/interfaces/index.js';
import * as schemaRegistry from '../../../../src/modules/registry/SchemaRegistry.js';
import * as zod from 'zod';
import * as valibot from 'valibot';
import * as typebox from '@sinclair/typebox';
import * as typeboxValue from '@sinclair/typebox/value';
import * as typeboxCompiler from '@sinclair/typebox/compiler';

/** Raw source of every example module, keyed by extension-less canonical path. */
const RAW_SOURCES = buildRawSources();

/** Bare specifier (and library deep-path) → statically-bundled module. */
const STATIC_MODULES: Readonly<Record<string, unknown>> = {
  '@sinclair/typebox': typebox,
  '@sinclair/typebox/compiler': typeboxCompiler,
  '@sinclair/typebox/value': typeboxValue,
  'json-tology': jtIndex,
  'json-tology/interfaces': jtInterfaces,
  'json-tology/ontology': jtOntology,
  'json-tology/owl-gen': jtOwlGen,
  'json-tology/schema': jtSchema,
  'json-tology/types': jtTypes,
  'json-tology/value': jtValue,
  'src/JsonTology': jtIndex,
  'src/index': jtIndex,
  'src/interfaces/index': jtInterfaces,
  'src/modules/registry/SchemaRegistry': schemaRegistry,
  'src/ontology': jtOntology,
  'src/owl-gen': jtOwlGen,
  'src/schema': jtSchema,
  'src/types/index': jtTypes,
  'src/value': jtValue,
  valibot,
  zod
};

function buildRawSources(): Record<string, string> {
  const glob = import.meta.glob('../../../../examples/docs/**/*.ts', {
    eager: true,
    import: 'default',
    query: '?raw'
  }) as Record<string, string>;
  const out: Record<string, string> = {};

  for (const [key, source] of Object.entries(glob)) {
    // Vite keys are relative to this file (…/theme/utils). Canonicalize to a
    // repo-rooted, extension-less path: 'examples/docs/advanced/106-abox-graph'.
    const canonical = key.replace(/^(\.\.\/)+/, '').replace(/\.ts$/, '');

    out[canonical] = source;
  }

  return out;
}

/** Canonicalize a relative `spec` against the directory of `fromCanonical`. */
function resolveRelative(spec: string, fromCanonical: string): string {
  const fromDir = fromCanonical.split('/').slice(0, -1);
  const parts = spec.replace(/\.js$/, '').replace(/\.ts$/, '').split('/');

  for (const part of parts) {
    if (part === '.' || part === '') {
      continue;
    }
    if (part === '..') {
      fromDir.pop();
    } else {
      fromDir.push(part);
    }
  }

  return fromDir.join('/');
}

function lookupRaw(canonical: string): string | undefined {
  return RAW_SOURCES[canonical] ?? RAW_SOURCES[`${canonical}/index`];
}

interface LoadedModuleType {
  exports: Record<string, unknown>;
}

const moduleCache = new Map<string, LoadedModuleType>();
const silentConsole = { ...console, debug() {}, error() {}, info() {}, log() {}, warn() {} } as Console;

function evaluate(source: string, canonical: string, runtimeConsole: Console): Record<string, unknown> {
  const { code } = transform(source, { filePath: `${canonical}.ts`, transforms: ['imports', 'typescript'] });
  const moduleObject: LoadedModuleType = { exports: {} };
  const requireShim = makeRequire(canonical, runtimeConsole);
  // eslint-disable-next-line no-new-func -- the playground evaluates example-tree module source (CJS from sucrase) with an injected require shim; this is the runner's entire purpose.
  const factory = new Function('require', 'exports', 'module', 'console', code) as (
    require: (specifier: string) => unknown,
    exports: Record<string, unknown>,
    module: LoadedModuleType,
    console: Console
  ) => void;

  factory(requireShim, moduleObject.exports, moduleObject, runtimeConsole);

  return moduleObject.exports;
}

function makeRequire(fromCanonical: string, runtimeConsole: Console): (specifier: string) => unknown {
  return (specifier: string): unknown => {
    if (specifier in STATIC_MODULES) {
      return STATIC_MODULES[specifier];
    }

    const canonical = specifier.startsWith('.')
      ? resolveRelative(specifier, fromCanonical)
      : specifier;

    if (canonical in STATIC_MODULES) {
      return STATIC_MODULES[canonical];
    }

    const cached = moduleCache.get(canonical);

    if (cached !== undefined) {
      return cached.exports;
    }

    const source = lookupRaw(canonical);

    if (source === undefined) {
      throw new Error(`Cannot resolve import '${specifier}' (resolved to '${canonical}') in the playground`);
    }

    // Reserve the cache slot before evaluating to tolerate import cycles.
    const slot: LoadedModuleType = { exports: {} };

    moduleCache.set(canonical, slot);
    // Dependency module bodies run with a silent console so only the example
    // under test produces visible output.
    slot.exports = evaluate(source, canonical, silentConsole);

    return slot.exports;
  };
}

/**
 * Transpile and execute an example's (edited) source in the browser. `path` is
 * the repo-rooted example path (e.g. 'examples/docs/advanced/106-abox-graph');
 * imports resolve relative to it. `runtimeConsole` captures the example's output.
 */
export async function runExample(source: string, path: string, runtimeConsole: Console): Promise<void> {
  const { code } = transform(source, { filePath: `${path}.ts`, transforms: ['imports', 'typescript'] });
  const requireShim = makeRequire(path, runtimeConsole);
  const moduleObject: LoadedModuleType = { exports: {} };
  // eslint-disable-next-line no-new-func -- see evaluate(): executing user-edited example source is the playground's purpose.
  const factory = new Function('require', 'exports', 'module', 'console', `return (async () => {\n${code}\n})();`) as (
    require: (specifier: string) => unknown,
    exports: Record<string, unknown>,
    module: LoadedModuleType,
    console: Console
  ) => Promise<void>;

  await factory(requireShim, moduleObject.exports, moduleObject, runtimeConsole);
}

/**
 * The verbatim source of an example by its repo-rooted, extension-less path
 * (e.g. 'examples/docs/advanced/106-abox-graph'), or undefined if unknown.
 * This is the single source of truth shown in the editor and run on Execute.
 */
export function getExampleSource(path: string): string | undefined {
  return lookupRaw(path);
}
