/**
 * Value operation benchmarks: clean, convert, diff, clone vs TypeBox equivalents.
 */

import { Value as TBValue } from '@sinclair/typebox/value';
import { FormatRegistry } from '@sinclair/typebox';

// Register formats for TypeBox
FormatRegistry.Set('email', (v) => {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u.test(v);
});
FormatRegistry.Set('date-time', (v) => {
  return !isNaN(Date.parse(v));
});
import { Value } from '../src/modules/data/Value.js';
import { SchemaRegistry } from '../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  AddressSchema, CustomerSchema, NestedSchema,
  NestedSchemaTypebox, nestedValid,
  OrderItemSchema, simpleCoercible,
  SimpleSchema, SimpleSchemaTypebox, simpleValid
} from './fixtures.js';

const dirtySimple = {
  ...simpleValid,
  'extra1': 'junk',
  'extra2': 42,
  'extra3': true
};
const dirtyNested = {
  ...nestedValid,
  'customer': {
    ...nestedValid.customer,
    'address': {
      ...nestedValid.customer.address,
      'extra': 'x'
    },
    'hackField': 'bad'
  },
  'extraTop': 'remove me'
};

export function runValueOpsBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'coerce': true });

  registry.register(SimpleSchema);
  registry.register(AddressSchema);
  registry.register(CustomerSchema);
  registry.register(OrderItemSchema);
  registry.register(NestedSchema);

  // Warm up engines
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

  // ---------------------------------------------------------------------------
  section('clean — strip unknown properties');

  results.push(bench('clean simple', 'json-tology', () => {
    registry.clean(SimpleSchema.$id, dirtySimple);
  }));

  results.push(bench('clean simple', 'typebox', () => {
    TBValue.Clean(SimpleSchemaTypebox, structuredClone(dirtySimple));
  }));

  results.push(bench('clean nested', 'json-tology', () => {
    registry.clean(NestedSchema.$id, dirtyNested);
  }));

  results.push(bench('clean nested', 'typebox', () => {
    TBValue.Clean(NestedSchemaTypebox, structuredClone(dirtyNested));
  }));

  // ---------------------------------------------------------------------------
  section('convert — type coercion (no defaults)');

  results.push(bench('convert simple', 'json-tology', () => {
    registry.convert(SimpleSchema.$id, simpleCoercible);
  }));

  results.push(bench('convert simple', 'typebox', () => {
    TBValue.Convert(SimpleSchemaTypebox, simpleCoercible);
  }));

  // ---------------------------------------------------------------------------
  section('clone — deep clone');

  results.push(bench('clone nested', 'json-tology', () => {
    Value.clone(nestedValid);
  }));

  results.push(bench('clone nested', 'structuredClone', () => {
    structuredClone(nestedValid);
  }));

  // ---------------------------------------------------------------------------
  section('diff — structural diff');

  const nestedModified = {
    ...nestedValid,
    'customer': {
      ...nestedValid.customer,
      'name': 'Robert Smith'
    },
    'status': 'paid',
    'total': 50
  };

  results.push(bench('diff nested', 'json-tology', () => {
    Value.diff(nestedValid, nestedModified);
  }));

  results.push(bench('diff nested', 'typebox', () => {
    [...TBValue.Diff(nestedValid, nestedModified)];
  }));

  return results;
}
