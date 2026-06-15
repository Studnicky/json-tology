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
FormatRegistry.Set('uuid', (value) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
});
import { Operations } from '../../../src/modules/data/Operations.js';
import { Value } from '../../../src/modules/data/Value.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';
import {
  bench, type BenchResult, section
} from './harness.js';
import {
  bookstoreBenchSchemas,
  OrderSchemaTypebox, orderValid,
  reviewCoercible, ReviewSchemaTypebox, reviewValid
} from './fixtures.js';
import {
  OrderSchema, ReviewSchema
} from '../bookstore/index.js';

const dirtyReview = {
  ...reviewValid,
  'extra1': 'junk',
  'extra2': 42,
  'extra3': true
};
const dirtyOrder = {
  ...orderValid,
  'extraTop': 'remove me',
  'orderTotal': {
    ...orderValid.orderTotal,
    'hackField': 'bad'
  },
  'shippingAddress': {
    ...orderValid.shippingAddress,
    'extra': 'x'
  }
};

export function runValueOpsBench(): BenchResult[] {
  const results: BenchResult[] = [];

  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  for (const schema of bookstoreBenchSchemas) {
    registry.set(schema as Record<string, unknown>);
  }

  // Warm up engines
  registry.validate(ReviewSchema.$id, reviewValid);
  registry.validate(OrderSchema.$id, orderValid);

  // ---------------------------------------------------------------------------
  section('clean — strip unknown properties');

  const cleanReviewResult = bench('clean review', 'json-tology', () => {
    return registry.clean(ReviewSchema.$id, dirtyReview);
  });

  results.push(cleanReviewResult);

  const cleanReviewTbResult = bench('clean review', 'typebox', () => {
    return TypeBoxValue.clean(ReviewSchemaTypebox, structuredClone(dirtyReview));
  });

  results.push(cleanReviewTbResult);

  const cleanOrderResult = bench('clean order', 'json-tology', () => {
    return registry.clean(OrderSchema.$id, dirtyOrder);
  });

  results.push(cleanOrderResult);

  const cleanOrderTbResult = bench('clean order', 'typebox', () => {
    return TypeBoxValue.clean(OrderSchemaTypebox, structuredClone(dirtyOrder));
  });

  results.push(cleanOrderTbResult);

  // ---------------------------------------------------------------------------
  section('convert — type coercion (no defaults)');

  const convertReviewResult = bench('convert review', 'json-tology', () => {
    return registry.convert(ReviewSchema.$id, reviewCoercible);
  });

  results.push(convertReviewResult);

  const convertReviewTbResult = bench('convert review', 'typebox', () => {
    return TypeBoxValue.convert(ReviewSchemaTypebox, reviewCoercible);
  });

  results.push(convertReviewTbResult);

  // ---------------------------------------------------------------------------
  section('clone — deep clone');

  const cloneOrderResult = bench('clone order', 'json-tology', () => {
    return Operations.clone(orderValid);
  });

  results.push(cloneOrderResult);

  const cloneStructuredResult = bench('clone order', 'structuredClone', () => {
    return structuredClone(orderValid);
  });

  results.push(cloneStructuredResult);

  // ---------------------------------------------------------------------------
  section('diff — structural diff');

  const orderModified = {
    ...orderValid,
    'orderTotal': {
      ...orderValid.orderTotal,
      'amount': 999
    },
    'shippingAddress': {
      ...orderValid.shippingAddress,
      'city': 'Berlin'
    }
  };

  const diffOrderResult = bench('diff order', 'json-tology', () => {
    return Value.diff(orderValid, orderModified);
  });

  results.push(diffOrderResult);

  const diffOrderTbResult = bench('diff order', 'typebox', () => {
    return [...TypeBoxValue.diff(orderValid, orderModified)];
  });

  results.push(diffOrderTbResult);

  return results;
}
