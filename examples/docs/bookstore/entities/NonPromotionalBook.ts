import { Compose } from '../../../../src/index.js';
import { PromotionalBookSchema } from './PromotionalBook.js';

/**
 * NonPromotionalBook — the OWL complement of PromotionalBook.
 *
 * Demonstrates `Compose.complementOf`: emits `urn:bookstore:NonPromotionalBook
 * owl:complementOf urn:bookstore:PromotionalBook` and validates anything that
 * does NOT match the PromotionalBook schema (`not: { $ref }` at JSON Schema
 * runtime level).
 */

export const NonPromotionalBookSchema = Compose.complementOf(PromotionalBookSchema, {
  '$id': 'urn:bookstore:NonPromotionalBook',
  'description': 'A book not currently on promotion. Defined by negation: any value '
    + 'that does not match urn:bookstore:PromotionalBook.',
  'type': 'object'
} as const);
