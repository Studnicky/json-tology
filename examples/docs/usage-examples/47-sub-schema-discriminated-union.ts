/**
 * Sub-schema patterns — discriminated union as a sub-schema
 *
 * The composite is what the caller validates. Its `payment` slot is a
 * `$ref` to a discriminated union. The validator descends through
 * both layers automatically: variant selection happens inside the
 * `$ref`, the rest of the order is checked at the top level.
 *
 * Demonstrated by extending the canonical `OrderSchema` with a
 * `payment` slot whose value is a discriminated union over two
 * payment-method sub-schemas.
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
    'method': { 'const': 'credit_card' }
  },
  'required': [
    'method',
    'cardLast4'
  ],
  'type': 'object'
} as const;

const InvoicePaymentSchema = {
  '$id': 'https://bookstore.example/InvoicePayment',
  'properties': {
    'method': { 'const': 'invoice' },
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

jt.set(CreditCardPaymentSchema);
jt.set(InvoicePaymentSchema);
jt.set(PaymentSchema);
jt.set(OrderWithPaymentSchema);

const errs = jt.validate(OrderWithPaymentSchema.$id, {
  ...aboxFixtures.order,
  'payment': {
    'cardLast4': '4242',
    'method': 'credit_card'
  }
});

console.assert(errs.length === 0);
