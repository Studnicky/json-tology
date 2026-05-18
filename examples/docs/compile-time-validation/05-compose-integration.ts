/**
 * Compile-time schema validation: Compose integration
 *
 * Compose methods that accept a schema body (`subClassOf`, `complementOf`,
 * `disjointWith`, `extend`) apply `ValidateSchemaType` as a parameter
 * constraint. Any schema passed to these methods is validated automatically —
 * no manual `_check` variable needed.
 *
 * This example uses `Compose.extend` on `BookSchema` to derive a featured
 * book variant. The body is internally consistent so the composition compiles.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// FeaturedBook extends Book with an additional `featuredOn` property.
// The body has `featuredOn` in both properties and required — compiles.
// `Compose.extend` takes the parent schema, the additions body, and the
// new $id as three separate arguments. The $id must NOT appear inside
// the additions body — it is the third positional argument.
const FeaturedBookSchema = Compose.extend(
  BookSchema,
  {
    'properties': {
      'featuredOn': {
        'format': 'date',
        'type': 'string'
      }
    },
    'required': ['featuredOn'],
    'type': 'object'
  } as const,
  'urn:docs-compile-time-05:FeaturedBook'
);

// The $id is the third argument to Compose.extend; confirm it is a string.
console.assert(typeof FeaturedBookSchema.$id === 'string');

// The extended schema includes all required keys from both base and body.
const registry = jt.set(FeaturedBookSchema);
const errs = registry.validate(FeaturedBookSchema.$id, {
  'authors': ['Michael Ende'],
  'featuredOn': '2026-05-01',
  'inStock': true,
  'isbn': '9783522128001',
  'price': {
    'amount': 850,
    'currency': 'EUR'
  },
  'printStatus': 'outOfPrint',
  'publishedOn': '1979-09-01',
  'stockLevel': 5,
  'title': 'Die unendliche Geschichte'
});

console.assert(errs.length === 0);
