/**
 * Compose.discriminatedUnion — Example 1: Payment method union
 * Demonstrates: oneOf with discriminator, Compose.narrow type guard
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';

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

type Payment = InferType<typeof PaymentSchema>;

const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    CreditCardPaymentSchema,
    InvoicePaymentSchema,
    PaymentSchema
  ] as const
});

// Validate each variant
console.assert(localJt.validate(PaymentSchema.$id, {
  'cardLast4': '4242',
  'expiry': '12/28',
  'method': 'credit_card'
}).length === 0);
console.assert(localJt.validate(PaymentSchema.$id, {
  'method': 'invoice',
  'purchaseOrder': 'PO-001'
}).length === 0);

// Narrow type guard
function describePayment(payment: Payment): string {
  if (Compose.narrow(payment, 'method', 'credit_card')) {
    return `Card ending in ${payment.cardLast4}`;
  }
  if (Compose.narrow(payment, 'method', 'invoice')) {
    return `Invoice PO#${payment.purchaseOrder}`;
  }

  return 'unknown';
}

const cc = localJt.instantiate(PaymentSchema.$id, {
  'cardLast4': '4242',
  'expiry': '12/28',
  'method': 'credit_card'
});

console.assert(describePayment(cc) === 'Card ending in 4242');
