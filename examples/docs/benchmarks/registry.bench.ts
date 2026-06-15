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
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  bookstoreBenchSchemas,
  OrderSchemaTypebox, OrderSchemaValibot, OrderSchemaZod,
  orderValid
} from './fixtures.js';
import { OrderSchema } from '../bookstore/index.js';

export function runRegistryBench(): BenchResult[] {
  const results: BenchResult[] = [];

  section('registry — cold: register schemas + first validate');

  results.push(bench('cold first validate', 'json-tology', () => {
    const reg = new SchemaRegistry({ 'enableStrictGraph': false });

    for (const schema of bookstoreBenchSchemas) {
      reg.set(schema as Record<string, unknown>);
    }

    return reg.validate(OrderSchema.$id, orderValid);
  }, { 'iterations': 5000 }));

  results.push(bench('cold first validate', 'typebox', () => {
    const compiled = TypeCompiler.Compile(OrderSchemaTypebox);

    return compiled.Check(orderValid);
  }, { 'iterations': 5000 }));

  results.push(bench('cold first validate', 'zod', () => {
    // Zod has no compile step; reconstruct the schema each time
    const fresh = z.object({
      'orderId': z.string().uuid(),
      'placedAt': z.string().datetime()
    });

    return fresh.safeParse({
      'orderId': orderValid.orderId as string,
      'placedAt': orderValid.placedAt as string
    });
  }, { 'iterations': 5000 }));

  results.push(bench('cold first validate', 'valibot', () => {
    return safeParse(OrderSchemaValibot, orderValid);
  }, { 'iterations': 5000 }));

  section('registry — warm: cached validate (steady state)');

  // Warm registries
  const reg = new SchemaRegistry({ 'enableStrictGraph': false });

  for (const schema of bookstoreBenchSchemas) {
    reg.set(schema as Record<string, unknown>);
  }
  reg.validate(OrderSchema.$id, orderValid);

  const tbCompiled = TypeCompiler.Compile(OrderSchemaTypebox);

  tbCompiled.Check(orderValid);
  OrderSchemaZod.safeParse(orderValid);
  safeParse(OrderSchemaValibot, orderValid);

  results.push(bench('warm validate', 'json-tology', () => {
    return reg.validate(OrderSchema.$id, orderValid);
  }));

  results.push(bench('warm validate', 'typebox', () => {
    return tbCompiled.Check(orderValid);
  }));

  results.push(bench('warm validate', 'zod', () => {
    return OrderSchemaZod.safeParse(orderValid);
  }));

  results.push(bench('warm validate', 'valibot', () => {
    return safeParse(OrderSchemaValibot, orderValid);
  }));

  return results;
}
