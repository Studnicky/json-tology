import { Compose } from '../../../../src/index.js';
import { BibliographicRecordSchema } from './BibliographicRecord.js';
import { BookAnnotationsSchema } from './BookAnnotations.js';
import { BookRatingHistogramSchema } from './BookRatingHistogram.js';
import { MoneySchema } from './Money.js';
import { PrintStatusSchema } from './PrintStatus.js';
import { StockLevelSchema } from './StockLevel.js';

/**
 * Book — a {@link BibliographicRecordSchema} offered for sale. The retail
 * listing extends the bibliographic core (isbn / title / authors / publishedOn)
 * with commercial state via `Compose.subClassOf`:
 *
 *   - `price`       — the asking price (required to be on sale).
 *   - `printStatus` — publisher editorial state (`inPrint` | `outOfPrint` |
 *     `limitedRun`); drives the InPrintBook / OutOfPrintBook OWL classes.
 *   - `inStock` / `stockLevel` — operational inventory state, changing daily as
 *     copies sell or restock arrives. Orthogonal to `printStatus`.
 *   - `ratings` / `annotations` — merchandising metadata.
 *
 * The TBox emits `urn:bookstore:Book rdfs:subClassOf
 * urn:bookstore:BibliographicRecord`. Book inherits the `isbn` inverse-
 * functional identity from the bibliographic record.
 */

export const BookSchema = Compose.subClassOf(BibliographicRecordSchema, {
  '$id': 'urn:bookstore:Book',
  'properties': {
    'annotations': { '$ref': BookAnnotationsSchema.$id },
    'inStock': {
      'default': true,
      'type': 'boolean'
    },
    'price': { '$ref': MoneySchema.$id },
    'printStatus': { '$ref': PrintStatusSchema.$id },
    'ratings': { '$ref': BookRatingHistogramSchema.$id },
    'stockLevel': { '$ref': StockLevelSchema.$id }
  },
  'required': [
    'price',
    'printStatus'
  ],
  'type': 'object'
} as const);
