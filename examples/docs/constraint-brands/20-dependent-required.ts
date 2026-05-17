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
void 0 as unknown as Payment;
