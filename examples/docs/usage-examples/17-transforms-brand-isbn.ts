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
import type { BrandedType } from '../../../src/types/index.js';
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

jt.set(BrandedIsbnBase);

const BrandedIsbnSchema = Transform.brand(BrandedIsbnBase, 'BrandedIsbn');

type BrandedIsbn = BrandedType<string, 'BrandedIsbn'>;

const wire = aboxFixtures.rareBook.isbn;
const decoded = jt.instantiate(BrandedIsbnBase.$id, wire) as BrandedIsbn;

console.assert(typeof decoded === 'string');
console.assert((decoded as unknown as string) === wire);

void BrandedIsbnSchema;
