import { AuthorNameSchema } from './AuthorName.js';
import { BookAnnotationsSchema } from './BookAnnotations.js';
import { BookRatingHistogramSchema } from './BookRatingHistogram.js';
import { IsbnSchema } from './Isbn.js';
import { MoneySchema } from './Money.js';
import { PrintStatusSchema } from './PrintStatus.js';
import { PublicationDateSchema } from './PublicationDate.js';
import { StockLevelSchema } from './StockLevel.js';
import { TitleSchema } from './Title.js';

export const BookSchema = {
  '$id': 'urn:bookstore:Book',
  'properties': {
    'annotations': { '$ref': BookAnnotationsSchema.$id },
    'authors': {
      'items': { '$ref': AuthorNameSchema.$id },
      'minItems': 1,
      'type': 'array',
      'uniqueItems': true
    },
    // Operational inventory state — changes daily as copies sell or
    // restock arrives. Orthogonal to `printStatus` (publisher state).
    'inStock': {
      'default': true,
      'type': 'boolean'
    },
    'isbn': { '$ref': IsbnSchema.$id },
    'price': { '$ref': MoneySchema.$id },
    // Editorial state from the publisher — `inPrint` | `outOfPrint` |
    // `limitedRun`. Independent of `inStock`. Drives the InPrintBook /
    // OutOfPrintBook OWL class membership.
    'printStatus': { '$ref': PrintStatusSchema.$id },
    'publishedOn': { '$ref': PublicationDateSchema.$id },
    'ratings': { '$ref': BookRatingHistogramSchema.$id },
    'stockLevel': { '$ref': StockLevelSchema.$id },
    'title': { '$ref': TitleSchema.$id }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price',
    'printStatus'
  ],
  'type': 'object'
} as const;
