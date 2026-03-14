/**
 * Compiled vs Interpreted benchmark.
 *
 * Measures the performance difference between SchemaCompiler (closure-based)
 * and GraphEngine (interpreted) validation paths.
 */

import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';
import { GraphEngine } from '../src/modules/graph/GraphEngine.js';
import { SchemaGraph } from '../src/modules/graph/SchemaGraph.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  NestedSchema, nestedValid, simpleInvalid, SimpleSchema, simpleValid
} from './fixtures.js';

export function runCompiledBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // Compiled path via registry
  const registry = new SchemaRegistry();

  registry.register(SimpleSchema);
  registry.register(NestedSchema);

  // Force compilation
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

  // Interpreted path via GraphEngine directly
  const simpleEngine = new GraphEngine(SimpleSchema as Record<string, unknown>, {
    'lookupSchema': (id) => {
      return registry.get(id);
    }
  });
  const nestedEngine = new GraphEngine(NestedSchema as Record<string, unknown>, {
    'lookupSchema': (id) => {
      return registry.get(id);
    }
  });

  section('Compiled vs Interpreted — simple schema (valid)');

  results.push(bench('compiled simple valid', 'compiled', () => {
    registry.validate(SimpleSchema.$id, simpleValid);
  }));

  results.push(bench('compiled simple valid', 'interpreted', () => {
    simpleEngine.execute(simpleValid);
  }));

  section('Compiled vs Interpreted — simple schema (invalid)');

  results.push(bench('compiled simple invalid', 'compiled', () => {
    registry.validate(SimpleSchema.$id, simpleInvalid);
  }));

  results.push(bench('compiled simple invalid', 'interpreted', () => {
    simpleEngine.execute(simpleInvalid);
  }));

  section('Compiled vs Interpreted — nested schema (valid)');

  results.push(bench('compiled nested valid', 'compiled', () => {
    registry.validate(NestedSchema.$id, nestedValid);
  }));

  results.push(bench('compiled nested valid', 'interpreted', () => {
    nestedEngine.execute(nestedValid);
  }));

  return results;
}
