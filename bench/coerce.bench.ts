/**
 * Coerce pipeline benchmarks vs TypeBox Value.Parse vs Zod .parse.
 */

import { Value } from '@sinclair/typebox/value';
import {
  FormatRegistry, Type
} from '@sinclair/typebox';
import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';

// Register email format for TypeBox (it ships without built-in formats)
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
  defaultsInput, DefaultsSchema,
  SimpleSchema,
  SimpleSchemaTypebox, SimpleSchemaZod, simpleValid
} from './fixtures.js';

export function runCoerceBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'castTypes': true });

  registry.register(SimpleSchema);
  registry.register(DefaultsSchema);

  // Warm up
  registry.instantiate(SimpleSchema, simpleValid);
  registry.instantiate(DefaultsSchema, defaultsInput);

  section('coerce — already-valid data (no coercion needed)');

  const coerceValidJt = bench('coerce valid', 'json-tology', () => {
    registry.instantiate(SimpleSchema, simpleValid);
  });

  results.push(coerceValidJt);

  const coerceValidTb = bench('coerce valid', 'typebox', () => {
    Value.Parse(SimpleSchemaTypebox, simpleValid);
  });

  results.push(coerceValidTb);

  const coerceValidZod = bench('coerce valid', 'zod', () => {
    SimpleSchemaZod.parse(simpleValid);
  });

  results.push(coerceValidZod);

  section('coerce — defaults application');

  const coerceDefaultsJt = bench('coerce defaults', 'json-tology', () => {
    registry.instantiate(DefaultsSchema, defaultsInput);
  });

  results.push(coerceDefaultsJt);

  const TBDefaultsSchema = Type.Object({
    'active': Type.Boolean({ 'default': true }),
    'role': Type.String({ 'default': 'user' }),
    'score': Type.Integer({ 'default': 0 }),
    'tags': Type.Array(Type.String(), { 'default': [] })
  });

  const coerceDefaultsTb = bench('coerce defaults', 'typebox', () => {
    Value.Parse(TBDefaultsSchema, defaultsInput);
  });

  results.push(coerceDefaultsTb);

  return results;
}
