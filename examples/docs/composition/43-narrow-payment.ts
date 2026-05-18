/**
 * Compose.narrow — Example 1: Narrow a Payment to a variant
 *
 * `Compose.narrow(value, prop, expected)` is a type guard. Inside the
 * truthy branch, the value narrows to the variant whose discriminant
 * property equals `expected`. No runtime effect beyond the property
 * comparison.
 */

import { Compose } from '../../../src/index.js';

interface CreditCardPayment {
  readonly 'cardLast4': string;
  readonly 'expiry': string;
  readonly 'method': 'credit_card';
}

interface InvoicePayment {
  readonly 'method': 'invoice';
  readonly 'purchaseOrder': string;
}

type Payment = CreditCardPayment | InvoicePayment;

function describePayment(payment: Payment): string {
  if (Compose.narrow(payment, 'method', 'credit_card')) {
    return `Card ending in ${payment.cardLast4}`;
  }
  if (Compose.narrow(payment, 'method', 'invoice')) {
    return `Invoice PO#${payment.purchaseOrder}`;
  }

  return 'Unknown payment method';
}

const card: Payment = {
  'cardLast4': '4242',
  'expiry': '12/28',
  'method': 'credit_card'
};

const invoice: Payment = {
  'method': 'invoice',
  'purchaseOrder': 'PO-001'
};

console.assert(describePayment(card) === 'Card ending in 4242');
console.assert(describePayment(invoice) === 'Invoice PO#PO-001');
