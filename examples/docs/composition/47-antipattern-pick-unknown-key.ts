/**
 * Anti-pattern: calling `Compose.pick` with a key that does not exist in
 * the source schema's `properties`. The compiler narrows `keys` to
 * `keyof properties`, so the unknown key is rejected at the call site.
 *
 * Book is now a Compose.subClassOf(BibliographicRecordSchema, …) — it is an
 * allOf composition without a flat top-level `properties` object. Picking
 * from a composed schema would bypass the key-narrowing guard. We target
 * BibliographicRecordSchema directly: it has a concrete `properties` object,
 * so TypeScript can narrow `keys` to its known property names and reject any
 * unknown key at the call site. The anti-pattern is identical; only the
 * source schema changes to one with top-level properties.
 */

import { Compose } from '../../../src/index.js';
import { BibliographicRecordSchema } from '../bookstore/index.js';

// ✗ Compile error — 'nonExistent' is not a key of BibliographicRecordSchema.properties.
const _Bad = Compose.pick(
  BibliographicRecordSchema,
  [
    'isbn',
    // @ts-expect-error 'nonExistent' is not a key of BibliographicRecordSchema.properties
    'nonExistent'
  ] as const,
  'https://bookstore.example/BookIsbnOnly'
);

console.log('pick unknown key anti-pattern: compile-time error for keys not in BibliographicRecordSchema.properties | valid keys:', Object.keys(BibliographicRecordSchema.properties));
void 0 as unknown as typeof _Bad;
