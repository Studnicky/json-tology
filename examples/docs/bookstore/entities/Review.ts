import { CustomerIdSchema } from './CustomerId.js';
import { IsbnSchema } from './Isbn.js';
import { Iso8601Schema } from './Iso8601.js';
import { RatingScoreSchema } from './RatingScore.js';
import { ReviewIdSchema } from './ReviewId.js';

export const ReviewSchema = {
  '$id': 'urn:bookstore:Review',
  'properties': {
    'body': {
      'minLength': 10,
      'type': 'string'
    },
    'bookIsbn': { '$ref': IsbnSchema.$id },
    'customerId': { '$ref': CustomerIdSchema.$id },
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
