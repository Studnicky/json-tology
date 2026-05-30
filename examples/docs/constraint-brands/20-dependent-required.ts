import type { InferType } from '../../../src/types/index.js';

const _PaymentSchema = {
  'dependentRequired': { 'credit_card': ['billing_address'] },
  'properties': {
    'billing_address': { 'type': 'string' },
    'credit_card': { 'type': 'string' }
  },
  'type': 'object'
} as const;

type Payment = InferType<typeof _PaymentSchema>;
// Either:
//   { credit_card?: never; billing_address?: string }    - no credit card, address optional
// | { billing_address: unknown; ... }                     - credit card present → address required

// No credit card — billing_address is optional.
const withoutCard: Payment = { 'billing_address': '123 Main St' };
// Credit card present — billing_address is required in the type.
const withCard: Payment = {
  'billing_address': '123 Main St',
  'credit_card': '4111111111111111'
};

console.log('Payment without credit card:', withoutCard);
console.log('Payment with credit card (billing_address required):', withCard);
