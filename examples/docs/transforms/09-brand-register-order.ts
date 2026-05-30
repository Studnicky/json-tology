/**
 * Transform.brand — Anti-pattern contrast: brand before registration
 * Demonstrates: brand must be applied before set(); the registered schema
 * carries the branded type, not a post-hoc application
 *
 * The correct pattern is shown here: brand first, then register.
 * The canonical Walter Moers author name provides the string fixture.
 */

import { Transform } from '../../../src/index.js';
import {
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// ✓ Correct: brand before registration — the registered schema carries the
// branded TypeScript type.
const BrandedAuthorId = Transform.brand(
  {
    '$id': 'https://bookstore.example/BrandedAuthorId',
    'type': 'string'
  } as const,
  'AuthorId'
);

jt.set(BrandedAuthorId);

// The branded schema is retrievable from the registry.
console.assert(jt.registry.has(BrandedAuthorId.$id));
console.log('registered schema ID:', BrandedAuthorId.$id);

// Instantiate produces a value typed as AuthorId at compile time.
const authorId = jt.instantiate(BrandedAuthorId, 'walter-moers');

console.assert(typeof authorId === 'string');
console.assert(authorId === 'walter-moers');
// AuthorId branded value: walter-moers
console.log('AuthorId branded value:', authorId);
