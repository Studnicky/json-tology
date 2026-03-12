/**
 * Parse pipeline benchmarks vs TypeBox Value.Parse vs Zod .parse.
 */

import { Value as TBValue } from '@sinclair/typebox/value';
import {
  FormatRegistry, Type
} from '@sinclair/typebox';
import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';

// Register email format for TypeBox (it ships without built-in formats)
FormatRegistry.Set('email', (v) => {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u.test(v);
});
FormatRegistry.Set('date-time', (v) => {
  return !isNaN(Date.parse(v));
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

  const registry = new SchemaRegistry({ coerce: true });

  registry.register(SimpleSchema);
  registry.register(DefaultsSchema);

  // Warm up
  registry.parse(SimpleSchema, simpleValid);
  registry.parse(DefaultsSchema, defaultsInput);

  section('parse — already-valid data (no coercion needed)');

  results.push(bench('parse valid', 'json-tology', () => {
    registry.parse(SimpleSchema, simpleValid);
  }));

  results.push(bench('parse valid', 'typebox', () => {
    TBValue.Parse(SimpleSchemaTypebox, simpleValid);
  }));

  results.push(bench('parse valid', 'zod', () => {
    SimpleSchemaZod.parse(simpleValid);
  }));

  section('parse — defaults application');

  results.push(bench('parse defaults', 'json-tology', () => {
    registry.parse(DefaultsSchema, defaultsInput);
  }));

  const TBDefaultsSchema = Type.Object({
    'active': Type.Boolean({ 'default': true }),
    'role': Type.String({ 'default': 'user' }),
    'score': Type.Integer({ 'default': 0 }),
    'tags': Type.Array(Type.String(), { 'default': [] })
  });

  results.push(bench('parse defaults', 'typebox', () => {
    TBValue.Parse(TBDefaultsSchema, defaultsInput);
  }));

  return results;
}
