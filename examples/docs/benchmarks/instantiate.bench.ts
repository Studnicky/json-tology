/**
 * Instantiate benchmarks: json-tology's primary parse-and-normalize API
 * vs Zod .parse / TypeBox Value.Parse / Valibot parse / io-ts decode.
 *
 * Distinct from coerce.bench.ts: this measures the typed entry point
 * (registry.instantiate / facade .instantiate), with castTypes off (no coercion),
 * representing the steady-state happy path most users hit.
 */

import { Value } from '@sinclair/typebox/value';
import { FormatRegistry } from '@sinclair/typebox';
import { parse as vParse } from 'valibot';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

FormatRegistry.Set('email', (value) => {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u.test(value);
});
FormatRegistry.Set('date-time', (value) => {
  return !Number.isNaN(Date.parse(value));
});
FormatRegistry.Set('uuid', (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
});

import {
  bench, type BenchResult, section
} from './harness.js';
import {
  bookstoreBenchSchemas,
  OrderSchemaIoTs, OrderSchemaTypebox, OrderSchemaValibot, OrderSchemaZod,
  orderValid,
  ReviewSchemaIoTs, ReviewSchemaTypebox, ReviewSchemaValibot, ReviewSchemaZod,
  reviewValid
} from './fixtures.js';
import {
  OrderSchema, ReviewSchema
} from '../bookstore/index.js';

export function runInstantiateBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  for (const schema of bookstoreBenchSchemas) {
    registry.set(schema as Record<string, unknown>);
  }

  // Warm up
  registry.instantiate(ReviewSchema, reviewValid);
  registry.instantiate(OrderSchema, orderValid);

  section('instantiate — Review (parse + normalize, no coercion)');

  results.push(bench('instantiate review', 'json-tology', () => {
    registry.instantiate(ReviewSchema, reviewValid);
  }));

  results.push(bench('instantiate review', 'typebox', () => {
    Value.Parse(ReviewSchemaTypebox, reviewValid);
  }));

  results.push(bench('instantiate review', 'zod', () => {
    ReviewSchemaZod.parse(reviewValid);
  }));

  results.push(bench('instantiate review', 'valibot', () => {
    vParse(ReviewSchemaValibot, reviewValid);
  }));

  results.push(bench('instantiate review', 'io-ts', () => {
    ReviewSchemaIoTs.decode(reviewValid);
  }));

  section('instantiate — Order (parse + normalize, no coercion)');

  results.push(bench('instantiate order', 'json-tology', () => {
    registry.instantiate(OrderSchema, orderValid);
  }));

  results.push(bench('instantiate order', 'typebox', () => {
    Value.Parse(OrderSchemaTypebox, orderValid);
  }));

  results.push(bench('instantiate order', 'zod', () => {
    OrderSchemaZod.parse(orderValid);
  }));

  results.push(bench('instantiate order', 'valibot', () => {
    vParse(OrderSchemaValibot, orderValid);
  }));

  results.push(bench('instantiate order', 'io-ts', () => {
    OrderSchemaIoTs.decode(orderValid);
  }));

  return results;
}

// Standalone demo — shows registry.instantiate on a flat and a nested schema.
// Run: npx tsx examples/docs/benchmarks/instantiate.bench.ts
const demoRegistry = new SchemaRegistry({ 'enableStrictGraph': false });

for (const schema of bookstoreBenchSchemas) {
  demoRegistry.set(schema as Record<string, unknown>);
}

const parsedReview = demoRegistry.instantiate(ReviewSchema, reviewValid);
const parsedOrder = demoRegistry.instantiate(OrderSchema, orderValid);

console.log('instantiate (review):', JSON.stringify(parsedReview));
console.log('instantiate (order):', JSON.stringify(parsedOrder));
