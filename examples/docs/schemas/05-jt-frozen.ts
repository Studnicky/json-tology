/**
 * jt:frozen — Example 5: standalone freeze flag
 *
 * `jt:frozen: true` is shorthand for `jt:config: { frozen: true }`.
 * The materializer applies `Object.freeze` recursively to the result.
 * Use this when every materialized value of a schema must be immutable —
 * configuration objects, value objects, snapshot records.
 *
 * The canonical bookstore's `MoneySchema` carries `jt:frozen: true`.
 * This example demonstrates freeze via a focused one-shot registry so
 * the assertion is self-contained.
 */

import { JsonTology } from '../../../src/index.js';

const MoneySchema = {
  '$id': 'urn:docs-schemas-05:Money',
  'jt:frozen': true,
  'properties': {
    'amount': {
      'exclusiveMinimum': 0,
      'type': 'number'
    },
    'currency': {
      'maxLength': 3,
      'minLength': 3,
      'type': 'string'
    }
  },
  'required': [
    'amount',
    'currency'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'urn:docs-schemas-05',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  'schemas': [MoneySchema] as const
});

const price = jt.instantiate(MoneySchema.$id, {
  'amount': 850,
  'currency': 'EUR'
});

// Deep freeze applied by the materializer.
console.assert(Object.isFrozen(price));
console.assert(price.amount === 850);
console.assert(price.currency === 'EUR');

console.log('instantiated price:', price);
console.log('price is frozen (jt:frozen: true):', Object.isFrozen(price));
