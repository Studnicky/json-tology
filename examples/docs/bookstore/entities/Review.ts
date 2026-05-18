import type { ValidateSchemaType } from '../../../../src/types/SchemaValidation.js';
import { CustomerIdSchema } from './CustomerId.js';
import { IsbnSchema } from './Isbn.js';
import { Iso8601Schema } from './Iso8601.js';
import { RatingScoreSchema } from './RatingScore.js';
import { ReviewBodySchema } from './ReviewBody.js';
import { ReviewIdSchema } from './ReviewId.js';

export const ReviewSchema = {
  '$id': 'urn:bookstore:Review',
  'properties': {
    'body': { '$ref': ReviewBodySchema.$id },
    'bookIsbn': { '$ref': IsbnSchema.$id },
    // functional: true — each Review has at most one customer (a review is
    // written by exactly one person; the customerId property maps to a single
    // Customer individual). OWL 2: owl:FunctionalProperty on customerId.
    'customerId': {
      '$ref': CustomerIdSchema.$id,
      'functional': true
    },
    'id': { '$ref': ReviewIdSchema.$id },
    'postedAt': { '$ref': Iso8601Schema.$id },
    'rating': { '$ref': RatingScoreSchema.$id }
  },
  'required': [
    'id',
    'bookIsbn',
    'customerId',
    'rating',
    'body',
    'postedAt'
  ],
  'type': 'object'
} as const;

// Compile-time self-check: every `required` entry must be in `properties`.
const _reviewShapeOk: ValidateSchemaType<typeof ReviewSchema> = ReviewSchema;

void _reviewShapeOk;
