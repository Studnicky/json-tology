/**
 * Compose.discriminatedUnion — Example 3: Order extended with a payment field
 *
 * Builds on `Compose.extend`: extend OrderSchema with a `payment`
 * slot typed as a discriminated union, then validate the composite
 * against a Bastian-orders-Neverending-Story payload that includes a
 * credit-card payment.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const CreditCardPaymentSchema = {
  '$id': 'https://bookstore.example/CreditCardPayment',
  'properties': {
    'cardLast4': {
      'pattern': '^\\d{4}$',
      'type': 'string'
    },
    'expiry': {
      'pattern': '^\\d{2}/\\d{2}$',
      'type': 'string'
    },
    'method': {
      'const': 'credit_card',
      'type': 'string'
    }
  },
  'required': [
    'method',
    'cardLast4',
    'expiry'
  ],
  'type': 'object'
} as const;

const InvoicePaymentSchema = {
  '$id': 'https://bookstore.example/InvoicePayment',
  'properties': {
    'method': {
      'const': 'invoice',
      'type': 'string'
    },
    'purchaseOrder': { 'type': 'string' }
  },
  'required': [
    'method',
    'purchaseOrder'
  ],
  'type': 'object'
} as const;

const PaymentSchema = Compose.discriminatedUnion(
  'method',
  [
    CreditCardPaymentSchema,
    InvoicePaymentSchema
  ] as const,
  'https://bookstore.example/Payment'
);

const OrderWithPaymentSchema = Compose.extend(
  OrderSchema,
  { 'payment': { '$ref': PaymentSchema.$id } } as const,
  'https://bookstore.example/OrderWithPayment'
);

const jt2 = jt
  .set(CreditCardPaymentSchema)
  .set(InvoicePaymentSchema)
  .set(PaymentSchema)
  .set(OrderWithPaymentSchema);

const result = jt2.validate(OrderWithPaymentSchema.$id, {
  ...aboxFixtures.order,
  'payment': {
    'cardLast4': '4242',
    'expiry': '12/28',
    'method': 'credit_card'
  }
});

console.assert(result.ok);
console.log('OrderWithPayment validates credit-card payment union:', result.ok);
