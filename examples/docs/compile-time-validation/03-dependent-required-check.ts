/**
 * Compile-time schema validation: dependentRequired key presence
 *
 * Every trigger key and every entry in the dependent key arrays in
 * `dependentRequired` must appear in `properties`. Violations surface a
 * `DependentRequiredKeyNotInPropertiesType` brand error.
 *
 * This example demonstrates the valid case — a payment schema where
 * `billing_address` is required when `credit_card` is present, and both
 * keys are declared in `properties`.
 */

import type { ValidateSchemaType } from '../../../src/types/index.js';
import { JsonTology } from '../../../src/index.js';

const PaymentSchema = {
  '$id': 'urn:docs-compile-time-03:Payment',
  'dependentRequired': { 'credit_card': ['billing_address'] },
  'properties': {
    'amount': {
      'exclusiveMinimum': 0,
      'type': 'number'
    },
    'billing_address': { 'type': 'string' },
    'credit_card': { 'type': 'string' }
  },
  'required': ['amount'],
  'type': 'object'
} as const;

// Both `credit_card` and `billing_address` are in properties — compiles.
const _check: ValidateSchemaType<typeof PaymentSchema> = PaymentSchema;

void _check;

const jt = JsonTology.create({
  'baseIri': 'urn:docs-compile-time-03',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  'schemas': [PaymentSchema] as const
});

// With credit_card — billing_address is required; omitting it fails.
const errsWithCard = jt.validate(PaymentSchema.$id, {
  'amount': 850,
  'credit_card': '4111-1111-1111-1111'
  // billing_address intentionally omitted
});

console.assert(errsWithCard.length > 0);

// Without credit_card — billing_address not required; passes.
const errsWithout = jt.validate(PaymentSchema.$id, { 'amount': 850 });

console.assert(errsWithout.length === 0);

// Log: dependentRequired compile-time check passed; runtime enforces the constraint.
console.log('ValidateSchemaType<PaymentSchema> accepted — dependentRequired keys in properties');
console.log(`credit_card without billing_address: ${errsWithCard.length} error(s) (expected >0)`);
console.log(`  violation: ${errsWithCard.items[0]?.message ?? '(none)'}`);
console.log(`amount only (no credit_card): ${errsWithout.length} error(s) (expected 0)`);
