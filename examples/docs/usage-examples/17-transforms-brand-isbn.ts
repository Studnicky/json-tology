/**
 * Transforms recipes — branded primitive via Transform.brand
 *
 * `Transform.brand` attaches a phantom brand to a schema's inferred
 * type without changing the wire format. The runtime value is still
 * a plain string; the compile-time type carries the brand, so a
 * generic `string` cannot be passed where an `Isbn` is expected.
 *
 * The wire is the ISBN-13 of the 1979 Thienemann first edition of
 * Michael Ende's Die unendliche Geschichte (the same value Bastian's
 * order references). Registered as a sibling of the canonical
 * `IsbnSchema` so the canonical primitive stays brand-free.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  IsbnSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BrandedIsbnBase = Compose.equivalent(
  IsbnSchema,
  { '$id': 'https://bookstore.example/BrandedIsbn' } as const
);

const jt2 = jt.set(BrandedIsbnBase);

const BrandedIsbnSchema = Transform.brand(BrandedIsbnBase, 'BrandedIsbn');

const wire = aboxFixtures.rareBook.isbn;
const decoded = jt2.instantiate(BrandedIsbnSchema, wire);

console.assert(typeof decoded === 'string');
console.assert(decoded === wire);
// '9783522128001'
console.log('wire ISBN:', wire);
// same string — brand is compile-time only
console.log('decoded (branded):', decoded);
// 'string' — no runtime difference
console.log('typeof decoded:', typeof decoded);

void BrandedIsbnSchema;
