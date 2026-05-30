/**
 * Coerce pipeline benchmarks vs TypeBox Value.Parse vs Zod .parse vs Valibot parse vs io-ts decode.
 */

import { Value } from '@sinclair/typebox/value';
import {
  FormatRegistry, Type
} from '@sinclair/typebox';
import { parse as vParse } from 'valibot';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// Register formats for TypeBox (it ships without built-in formats)
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
  customerDefaultsInput,
  ReviewSchemaIoTs,
  ReviewSchemaTypebox, ReviewSchemaValibot, ReviewSchemaZod, reviewValid
} from './fixtures.js';
import {
  CustomerSchema, ReviewSchema
} from '../bookstore/index.js';

export function runCoerceBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  for (const schema of bookstoreBenchSchemas) {
    registry.set(schema as Record<string, unknown>);
  }

  // Warm up
  registry.instantiate(ReviewSchema, reviewValid);
  registry.instantiate(CustomerSchema, customerDefaultsInput);

  section('coerce — already-valid Review (no coercion needed)');

  results.push(bench('coerce review valid', 'json-tology', () => {
    registry.instantiate(ReviewSchema, reviewValid);
  }));

  results.push(bench('coerce review valid', 'typebox', () => {
    Value.Parse(ReviewSchemaTypebox, reviewValid);
  }));

  results.push(bench('coerce review valid', 'zod', () => {
    ReviewSchemaZod.parse(reviewValid);
  }));

  results.push(bench('coerce review valid', 'valibot', () => {
    vParse(ReviewSchemaValibot, reviewValid);
  }));

  results.push(bench('coerce review valid', 'io-ts', () => {
    ReviewSchemaIoTs.decode(reviewValid);
  }));

  section('coerce — Customer with defaults application (addresses → [])');

  results.push(bench('coerce customer defaults', 'json-tology', () => {
    registry.instantiate(CustomerSchema, customerDefaultsInput);
  }));

  // TypeBox mirror of the bookstore Customer wire shape so the defaults
  // application can be compared head-to-head with json-tology.
  const CustomerWithDefaultsTb = Type.Object({
    'addresses': Type.Array(
      Type.Object({
        'city': Type.String({
          'maxLength': 100,
          'minLength': 1
        }),
        'country': Type.String({ 'pattern': '^[A-Z]{2}$' }),
        'postalCode': Type.String({
          'maxLength': 12,
          'minLength': 3
        }),
        'street': Type.String({
          'maxLength': 200,
          'minLength': 1
        })
      }),
      { 'default': [] }
    ),
    'customerId': Type.String({ 'format': 'uuid' }),
    'email': Type.String({ 'format': 'email' }),
    'name': Type.String({
      'maxLength': 200,
      'minLength': 1
    })
  });

  results.push(bench('coerce customer defaults', 'typebox', () => {
    Value.Parse(CustomerWithDefaultsTb, customerDefaultsInput);
  }));

  return results;
}

// Standalone demo — shows instantiate on already-valid data and with default application.
// Run: npx tsx examples/docs/benchmarks/coerce.bench.ts
const demoRegistry = new SchemaRegistry({ 'enableStrictGraph': false });

for (const schema of bookstoreBenchSchemas) {
  demoRegistry.set(schema as Record<string, unknown>);
}

const parsedReview = demoRegistry.instantiate(ReviewSchema, reviewValid);
const parsedWithDefaults = demoRegistry.instantiate(CustomerSchema, customerDefaultsInput);

console.log('instantiate (review, valid):', JSON.stringify(parsedReview));
console.log('instantiate (customer, defaults applied):', JSON.stringify(parsedWithDefaults));
