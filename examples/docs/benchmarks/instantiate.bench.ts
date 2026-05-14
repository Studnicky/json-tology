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

import {
  bench, type BenchResult, section
} from './harness.js';
import {
  AddressSchema, CustomerSchema, NestedSchema,
  NestedSchemaIoTs,
  NestedSchemaTypebox, NestedSchemaValibot, NestedSchemaZod, nestedValid,
  OrderItemSchema, SimpleSchema, SimpleSchemaIoTs, SimpleSchemaTypebox, SimpleSchemaValibot,
  SimpleSchemaZod, simpleValid
} from './fixtures.js';

export function runInstantiateBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry();

  registry.set(SimpleSchema);
  registry.set(AddressSchema);
  registry.set(CustomerSchema);
  registry.set(OrderItemSchema);
  registry.set(NestedSchema);

  // Warm up
  registry.instantiate(SimpleSchema, simpleValid);
  registry.instantiate(NestedSchema, nestedValid);

  section('instantiate — simple flat schema (parse + normalize, no coercion)');

  results.push(bench('instantiate simple', 'json-tology', () => {
    registry.instantiate(SimpleSchema, simpleValid);
  }));

  results.push(bench('instantiate simple', 'typebox', () => {
    Value.Parse(SimpleSchemaTypebox, simpleValid);
  }));

  results.push(bench('instantiate simple', 'zod', () => {
    SimpleSchemaZod.parse(simpleValid);
  }));

  results.push(bench('instantiate simple', 'valibot', () => {
    vParse(SimpleSchemaValibot, simpleValid);
  }));

  results.push(bench('instantiate simple', 'io-ts', () => {
    SimpleSchemaIoTs.decode(simpleValid);
  }));

  section('instantiate — nested schema (parse + normalize, no coercion)');

  results.push(bench('instantiate nested', 'json-tology', () => {
    registry.instantiate(NestedSchema, nestedValid);
  }));

  results.push(bench('instantiate nested', 'typebox', () => {
    Value.Parse(NestedSchemaTypebox, nestedValid);
  }));

  results.push(bench('instantiate nested', 'zod', () => {
    NestedSchemaZod.parse(nestedValid);
  }));

  results.push(bench('instantiate nested', 'valibot', () => {
    vParse(NestedSchemaValibot, nestedValid);
  }));

  results.push(bench('instantiate nested', 'io-ts', () => {
    NestedSchemaIoTs.decode(nestedValid);
  }));

  return results;
}
