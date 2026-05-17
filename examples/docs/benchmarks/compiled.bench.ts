/**
 * Compiled vs Interpreted benchmark.
 *
 * Measures the performance difference between SchemaCompiler (closure-based)
 * and GraphEngine (interpreted) validation paths.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import { GraphEngine } from '../../../src/modules/graph/GraphEngine.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  AddressSchema, CustomerSchema, NestedSchema,
  nestedValid, OrderItemSchema, simpleInvalid, SimpleSchema, simpleValid
} from './fixtures.js';

export function runCompiledBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // Compiled path via registry
  const registry = new SchemaRegistry();

  registry.set(SimpleSchema);
  registry.set(AddressSchema);
  registry.set(CustomerSchema);
  registry.set(OrderItemSchema);
  registry.set(NestedSchema);

  // Force compilation
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

  // Interpreted path via GraphEngine directly
  const simpleEngine = new GraphEngine(SimpleSchema, {
    'lookupSchema': (id) => {
      return registry.get(id);
    }
  });
  const nestedEngine = new GraphEngine(NestedSchema, {
    'lookupSchema': (id) => {
      return registry.get(id);
    }
  });

  section('Compiled vs Interpreted — simple schema (valid)');

  const compiledSimpleValid = bench('compiled simple valid', 'compiled', () => {
    registry.validate(SimpleSchema.$id, simpleValid);
  });

  results.push(compiledSimpleValid);

  const interpretedSimpleValid = bench('compiled simple valid', 'interpreted', () => {
    simpleEngine.execute(simpleValid);
  });

  results.push(interpretedSimpleValid);

  section('Compiled vs Interpreted — simple schema (invalid)');

  const compiledSimpleInvalid = bench('compiled simple invalid', 'compiled', () => {
    registry.validate(SimpleSchema.$id, simpleInvalid);
  });

  results.push(compiledSimpleInvalid);

  const interpretedSimpleInvalid = bench('compiled simple invalid', 'interpreted', () => {
    simpleEngine.execute(simpleInvalid);
  });

  results.push(interpretedSimpleInvalid);

  section('Compiled vs Interpreted — nested schema (valid)');

  const compiledNestedValid = bench('compiled nested valid', 'compiled', () => {
    registry.validate(NestedSchema.$id, nestedValid);
  });

  results.push(compiledNestedValid);

  const interpretedNestedValid = bench('compiled nested valid', 'interpreted', () => {
    nestedEngine.execute(nestedValid);
  });

  results.push(interpretedNestedValid);

  return results;
}
