/**
 * Compiled vs Interpreted benchmark.
 *
 * Measures the performance difference between SchemaCompiler (closure-based)
 * and GraphEngine (interpreted) validation paths.
 *
 * "simple" runs against the bookstore ReviewSchema (flat object).
 * "nested" runs against the bookstore OrderSchema (multi-level $refs).
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import { GraphEngine } from '../../../src/modules/graph/GraphEngine.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  bookstoreBenchSchemas,
  orderValid, reviewInvalid, reviewValid
} from './fixtures.js';
import {
  OrderSchema, ReviewSchema
} from '../bookstore/index.js';

export function runCompiledBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // Compiled path via registry — register the full canonical bookstore
  // closure so every $ref (Isbn, Money, Address, etc.) resolves.
  const registry = new SchemaRegistry();

  for (const schema of bookstoreBenchSchemas) {
    registry.set(schema as Record<string, unknown>);
  }

  // Force compilation
  registry.validate(ReviewSchema.$id, reviewValid);
  registry.validate(OrderSchema.$id, orderValid);

  // Interpreted path via GraphEngine directly
  const reviewEngine = new GraphEngine(ReviewSchema, {
    'lookupSchema': (id) => {
      return registry.get(id);
    }
  });
  const orderEngine = new GraphEngine(OrderSchema, {
    'lookupSchema': (id) => {
      return registry.get(id);
    }
  });

  section('Compiled vs Interpreted — Review (valid)');

  const compiledSimpleValid = bench('compiled simple valid', 'compiled', () => {
    registry.validate(ReviewSchema.$id, reviewValid);
  });

  results.push(compiledSimpleValid);

  const interpretedSimpleValid = bench('compiled simple valid', 'interpreted', () => {
    reviewEngine.execute(reviewValid);
  });

  results.push(interpretedSimpleValid);

  section('Compiled vs Interpreted — Review (invalid)');

  const compiledSimpleInvalid = bench('compiled simple invalid', 'compiled', () => {
    registry.validate(ReviewSchema.$id, reviewInvalid);
  });

  results.push(compiledSimpleInvalid);

  const interpretedSimpleInvalid = bench('compiled simple invalid', 'interpreted', () => {
    reviewEngine.execute(reviewInvalid);
  });

  results.push(interpretedSimpleInvalid);

  section('Compiled vs Interpreted — Order (valid)');

  const compiledNestedValid = bench('compiled nested valid', 'compiled', () => {
    registry.validate(OrderSchema.$id, orderValid);
  });

  results.push(compiledNestedValid);

  const interpretedNestedValid = bench('compiled nested valid', 'interpreted', () => {
    orderEngine.execute(orderValid);
  });

  results.push(interpretedNestedValid);

  return results;
}
