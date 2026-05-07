import { BookSchema } from './Book.js';

/**
 * PromotionalBook — books currently on promotion.
 *
 * Plain subclass authored as a JSON Schema document via `allOf + $ref`, used
 * here as the anchor for `Compose.complementOf` in NonPromotionalBook.
 */

export const PromotionalBookSchema = {
  '$id': 'urn:bookstore:PromotionalBook',
  'allOf': [
    { '$ref': BookSchema.$id },
    {
      'properties': {
        'discountPercent': {
          'maximum': 100,
          'minimum': 0,
          'type': 'integer'
        },
        'promotionEndsAt': {
          'format': 'date-time',
          'type': 'string'
        }
      },
      'required': [
        'discountPercent',
        'promotionEndsAt'
      ],
      'type': 'object'
    }
  ]
} as const;
