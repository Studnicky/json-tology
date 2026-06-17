/**
 * Compiled path benchmark.
 *
 * Measures SchemaCompiler (closure-based) validation performance against
 * the bookstore schemas.
 *
 * "simple" runs against the bookstore ReviewSchema (flat object).
 * "nested" runs against the bookstore OrderSchema (multi-level $refs).
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
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
  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  for (const schema of bookstoreBenchSchemas) {
    registry.set(schema as Record<string, unknown>);
  }

  // Force compilation
  registry.validate(ReviewSchema.$id, reviewValid);
  registry.validate(OrderSchema.$id, orderValid);

  section('Compiled — Review (valid)');

  const compiledSimpleValid = bench('compiled simple valid', 'compiled', () => {
    return registry.validate(ReviewSchema.$id, reviewValid);
  });

  results.push(compiledSimpleValid);

  section('Compiled — Review (invalid)');

  const compiledSimpleInvalid = bench('compiled simple invalid', 'compiled', () => {
    return registry.validate(ReviewSchema.$id, reviewInvalid);
  });

  results.push(compiledSimpleInvalid);

  section('Compiled — Order (valid)');

  const compiledNestedValid = bench('compiled nested valid', 'compiled', () => {
    return registry.validate(OrderSchema.$id, orderValid);
  });

  results.push(compiledNestedValid);

  return results;
}
