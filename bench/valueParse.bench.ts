/**
 * Value.parse pipeline benchmarks vs TypeBox Value.Parse.
 */

import { Value as TBValue } from '@sinclair/typebox/value';
import {
  FormatRegistry, Type
} from '@sinclair/typebox';
import { Value } from '../src/schema/Value.js';

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
  simpleCoercible, SimpleSchema,
  SimpleSchemaTypebox, simpleValid
} from './fixtures.js';

export function runValueParseBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // Warm up AJV compilation in Value.parse
  Value.parse(SimpleSchema, simpleValid);
  Value.parse(DefaultsSchema, defaultsInput);

  section('Value.parse — already-valid data (no coercion needed)');

  results.push(bench('ours  Value.parse  simple valid', () => {
    Value.parse(SimpleSchema, simpleValid);
  }));

  results.push(bench('typebox Value.Parse simple valid', () => {
    TBValue.Parse(SimpleSchemaTypebox, simpleValid);
  }));

  section('Value.parse — coercible data (strings → numbers/booleans + strip unknown)');

  results.push(bench('ours  Value.parse  coercible', () => {
    Value.parse(SimpleSchema, simpleCoercible);
  }));

  results.push(bench('typebox Value.Parse coercible', () => {
    TBValue.Parse(SimpleSchemaTypebox, simpleCoercible);
  }));

  section('Value.parse — defaults application');

  results.push(bench('ours  Value.parse  defaults', () => {
    Value.parse(DefaultsSchema, defaultsInput);
  }));

  const TBDefaultsSchema = Type.Object({
    'active': Type.Boolean({ 'default': true }),
    'role': Type.String({ 'default': 'user' }),
    'score': Type.Integer({ 'default': 0 }),
    'tags': Type.Array(Type.String(), { 'default': [] })
  });

  results.push(bench('typebox Value.Parse defaults', () => {
    TBValue.Parse(TBDefaultsSchema, defaultsInput);
  }));

  return results;
}
