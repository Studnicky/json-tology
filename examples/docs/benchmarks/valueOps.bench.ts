/**
 * Value operation benchmarks: clean, convert, diff, clone vs TypeBox equivalents.
 */

import { TypeBoxValue } from './typebox.js';
import { FormatRegistry } from '@sinclair/typebox';

// Register formats for TypeBox
FormatRegistry.Set('email', (value) => {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u.test(value);
});
FormatRegistry.Set('date-time', (value) => {
  return !Number.isNaN(Date.parse(value));
});
import { Operations } from '../../../src/modules/data/Operations.js';
import { Value } from '../../../src/modules/data/Value.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
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

  const registry = new SchemaRegistry({ 'castTypes': true });

  registry.set(SimpleSchema);
  registry.set(AddressSchema);
  registry.set(CustomerSchema);
  registry.set(OrderItemSchema);
  registry.set(NestedSchema);

  // Warm up engines
  registry.validate(SimpleSchema.$id, simpleValid);
  registry.validate(NestedSchema.$id, nestedValid);

  // ---------------------------------------------------------------------------
  section('clean — strip unknown properties');

  const cleanSimpleResult = bench('clean simple', 'json-tology', () => {
    registry.clean(SimpleSchema.$id, dirtySimple);
  });

  results.push(cleanSimpleResult);

  const cleanSimpleTbResult = bench('clean simple', 'typebox', () => {
    void TypeBoxValue.clean(SimpleSchemaTypebox, structuredClone(dirtySimple));
  });

  results.push(cleanSimpleTbResult);

  const cleanNestedResult = bench('clean nested', 'json-tology', () => {
    registry.clean(NestedSchema.$id, dirtyNested);
  });

  results.push(cleanNestedResult);

  const cleanNestedTbResult = bench('clean nested', 'typebox', () => {
    void TypeBoxValue.clean(NestedSchemaTypebox, structuredClone(dirtyNested));
  });

  results.push(cleanNestedTbResult);

  // ---------------------------------------------------------------------------
  section('convert — type coercion (no defaults)');

  const convertSimpleResult = bench('convert simple', 'json-tology', () => {
    registry.convert(SimpleSchema.$id, simpleCoercible);
  });

  results.push(convertSimpleResult);

  const convertSimpleTbResult = bench('convert simple', 'typebox', () => {
    void TypeBoxValue.convert(SimpleSchemaTypebox, simpleCoercible);
  });

  results.push(convertSimpleTbResult);

  // ---------------------------------------------------------------------------
  section('clone — deep clone');

  const cloneNestedResult = bench('clone nested', 'json-tology', () => {
    Operations.clone(nestedValid);
  });

  results.push(cloneNestedResult);

  const cloneStructuredResult = bench('clone nested', 'structuredClone', () => {
    structuredClone(nestedValid);
  });

  results.push(cloneStructuredResult);

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

  const diffNestedResult = bench('diff nested', 'json-tology', () => {
    Value.diff(nestedValid, nestedModified);
  });

  results.push(diffNestedResult);

  const diffNestedTbResult = bench('diff nested', 'typebox', () => {
    void [...TypeBoxValue.diff(nestedValid, nestedModified)];
  });

  results.push(diffNestedTbResult);

  return results;
}
