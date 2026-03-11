/**
 * Value operation benchmarks: clean, convert, diff, clone vs TypeBox equivalents.
 */

import { Value as TBValue } from '@sinclair/typebox/value';
import { FormatRegistry } from '@sinclair/typebox';

// Register formats for TypeBox
FormatRegistry.Set('email', (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v));
FormatRegistry.Set('date-time', (v) => !isNaN(Date.parse(v)));
import { Value } from '../src/schema/Value.js';
import { bench, section, type BenchResult } from './harness.js';
import {
  SimpleSchema, SimpleSchemaTypebox,
  NestedSchema, NestedSchemaTypebox,
  simpleValid, simpleCoercible, nestedValid,
} from './fixtures.js';

const dirtySimple = { ...simpleValid, extra1: 'junk', extra2: 42, extra3: true };
const dirtyNested = {
  ...nestedValid,
  customer: { ...nestedValid.customer, hackField: 'bad', address: { ...nestedValid.customer.address, extra: 'x' } },
  extraTop: 'remove me',
};

export function runValueOpsBench(): BenchResult[] {
  const results: BenchResult[] = [];

  // ---------------------------------------------------------------------------
  section('Value.clean — strip unknown properties');

  results.push(bench('ours  Value.clean  simple', () => {
    Value.clean(SimpleSchema, dirtySimple);
  }));

  results.push(bench('typebox Value.Clean simple', () => {
    TBValue.Clean(SimpleSchemaTypebox, structuredClone(dirtySimple));
  }));

  results.push(bench('ours  Value.clean  nested', () => {
    Value.clean(NestedSchema, dirtyNested);
  }));

  results.push(bench('typebox Value.Clean nested', () => {
    TBValue.Clean(NestedSchemaTypebox, structuredClone(dirtyNested));
  }));

  // ---------------------------------------------------------------------------
  section('Value.convert — type coercion (no defaults)');

  results.push(bench('ours  Value.convert simple', () => {
    Value.convert(SimpleSchema, simpleCoercible);
  }));

  results.push(bench('typebox Value.Convert simple', () => {
    TBValue.Convert(SimpleSchemaTypebox, simpleCoercible);
  }));

  // ---------------------------------------------------------------------------
  section('Value.clone — deep clone');

  results.push(bench('ours  Value.clone  nested', () => {
    Value.clone(nestedValid);
  }));

  // TypeBox doesn't expose Value.Clone as a standalone; structuredClone is the baseline
  results.push(bench('structuredClone   nested', () => {
    structuredClone(nestedValid);
  }));

  // ---------------------------------------------------------------------------
  section('Value.diff — structural diff');

  const nestedModified = {
    ...nestedValid,
    customer: { ...nestedValid.customer, name: 'Robert Smith' },
    total: 50.00,
    status: 'paid',
  };

  results.push(bench('ours  Value.diff   nested', () => {
    Value.diff(nestedValid, nestedModified);
  }));

  // TypeBox Value.Diff equivalent
  results.push(bench('typebox Value.Diff nested', () => {
    // Collect iterator — TypeBox returns a generator
    Array.from(TBValue.Diff(nestedValid, nestedModified));
  }));

  return results;
}
