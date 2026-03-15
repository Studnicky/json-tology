/**
 * Parse pipeline benchmarks vs TypeBox Value.Parse vs Zod .parse.
 */

import { Value as TBValue } from '@sinclair/typebox/value';
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

export function runValueParseBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'coerce': true });

  registry.register(SimpleSchema);
  registry.register(DefaultsSchema);

  // Warm up
  registry.parse(SimpleSchema, simpleValid);
  registry.parse(DefaultsSchema, defaultsInput);

  section('parse — already-valid data (no coercion needed)');

  const parseValidJt = bench('parse valid', 'json-tology', () => {
    registry.parse(SimpleSchema, simpleValid);
  });

  results.push(parseValidJt);

  const parseValidTb = bench('parse valid', 'typebox', () => {
    TBValue.Parse(SimpleSchemaTypebox, simpleValid);
  });

  results.push(parseValidTb);

  const parseValidZod = bench('parse valid', 'zod', () => {
    SimpleSchemaZod.parse(simpleValid);
  });

  results.push(parseValidZod);

  section('parse — defaults application');

  const parseDefaultsJt = bench('parse defaults', 'json-tology', () => {
    registry.parse(DefaultsSchema, defaultsInput);
  });

  results.push(parseDefaultsJt);

  const TBDefaultsSchema = Type.Object({
    'active': Type.Boolean({ 'default': true }),
    'role': Type.String({ 'default': 'user' }),
    'score': Type.Integer({ 'default': 0 }),
    'tags': Type.Array(Type.String(), { 'default': [] })
  });

  const parseDefaultsTb = bench('parse defaults', 'typebox', () => {
    TBValue.Parse(TBDefaultsSchema, defaultsInput);
  });

  results.push(parseDefaultsTb);

  return results;
}
