/**
 * Compose.narrow — Example 2: Exhaustive switch with narrowing
 *
 * Each `Compose.narrow` branch narrows the payment value to the
 * matching variant so variant-specific fields are reachable without
 * type assertions.
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

const processed: string[] = [];

function chargeCard(last4: string, expiry: string): void {
  processed.push(`charge ${last4} ${expiry}`);
}

function createInvoice(purchaseOrder: string): void {
  processed.push(`invoice ${purchaseOrder}`);
}

function processPayment(payment: Payment): void {
  if (Compose.narrow(payment, 'method', 'credit_card')) {
    chargeCard(payment.cardLast4, payment.expiry);

    return;
  }
  if (Compose.narrow(payment, 'method', 'invoice')) {
    createInvoice(payment.purchaseOrder);
  }
}

processPayment({
  'cardLast4': '4242',
  'expiry': '12/28',
  'method': 'credit_card'
});
processPayment({
  'method': 'invoice',
  'purchaseOrder': 'PO-001'
});

console.assert(processed.length === 2);
console.assert(processed[0] === 'charge 4242 12/28');
console.assert(processed[1] === 'invoice PO-001');
