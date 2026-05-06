/**
 * Registry benchmarks: cold cache (first validate compiles) vs warm cache.
 *
 * Measures the cost of:
 *   - registering N schemas
 *   - first call against a fresh registry (pays compilation/JIT cost)
 *   - subsequent calls (warm path, the steady-state hot loop)
 *
 * No comparator does this exactly the same way, but the closest analogs are:
 *   - TypeBox: TypeCompiler.Compile + first Check
 *   - Zod: schema definition + first safeParse
 *   - Valibot: schema definition + first safeParse
 *
 * For "register N schemas + first validate", we measure end-to-end cold cost.
 */

import { TypeCompiler } from '@sinclair/typebox/compiler';
import { z } from 'zod';
import { safeParse } from 'valibot';
import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  AddressSchema, CustomerSchema, NestedSchema,
  NestedSchemaTypebox, NestedSchemaValibot, NestedSchemaZod,
  nestedValid, OrderItemSchema
} from './fixtures.js';

export function runRegistryBench(): BenchResult[] {
  const results: BenchResult[] = [];

  section('registry — cold: register schemas + first validate');

  results.push(bench('cold first validate', 'json-tology', () => {
    const reg = new SchemaRegistry();

    reg.register(AddressSchema);
    reg.register(CustomerSchema);
    reg.register(OrderItemSchema);
    reg.register(NestedSchema);
    reg.validate(NestedSchema.$id, nestedValid);
  }, { 'iterations': 5000 }));

  results.push(bench('cold first validate', 'typebox', () => {
    const compiled = TypeCompiler.Compile(NestedSchemaTypebox);

    compiled.Check(nestedValid);
  }, { 'iterations': 5000 }));

  results.push(bench('cold first validate', 'zod', () => {
    // Zod has no compile step; reconstruct the schema each time
    const fresh = z.object({
      'createdAt': z.string().datetime(),
      'orderId': z.string()
    });

    fresh.safeParse({
      'createdAt': nestedValid.createdAt,
      'orderId': nestedValid.orderId
    });
  }, { 'iterations': 5000 }));

  results.push(bench('cold first validate', 'valibot', () => {
    safeParse(NestedSchemaValibot, nestedValid);
  }, { 'iterations': 5000 }));

  section('registry — warm: cached validate (steady state)');

  // Warm registries
  const reg = new SchemaRegistry();

  reg.register(AddressSchema);
  reg.register(CustomerSchema);
  reg.register(OrderItemSchema);
  reg.register(NestedSchema);
  reg.validate(NestedSchema.$id, nestedValid);

  const tbCompiled = TypeCompiler.Compile(NestedSchemaTypebox);

  tbCompiled.Check(nestedValid);
  NestedSchemaZod.safeParse(nestedValid);
  safeParse(NestedSchemaValibot, nestedValid);

  results.push(bench('warm validate', 'json-tology', () => {
    reg.validate(NestedSchema.$id, nestedValid);
  }));

  results.push(bench('warm validate', 'typebox', () => {
    tbCompiled.Check(nestedValid);
  }));

  results.push(bench('warm validate', 'zod', () => {
    NestedSchemaZod.safeParse(nestedValid);
  }));

  results.push(bench('warm validate', 'valibot', () => {
    safeParse(NestedSchemaValibot, nestedValid);
  }));

  return results;
}
