/**
 * Transforms recipes — comma-separated string ↔ `string[]`
 *
 * Wire format: `'fiction, paperback, bestseller'`. Decoded type:
 * `string[]`. Registered as a new string primitive against
 * `bookstoreEntities`.
 *
 * The wire string is a hand-tagged classification for the rare 1979
 * Thienemann first edition Bastian ordered.
 */

import { Transform } from '../../../src/index.js';
import { createBookstoreDocRegistry } from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const TagListTransform = Transform.create(
  {
    '$id': 'https://bookstore.example/TagList',
    'items': { 'type': 'string' },
    'type': 'array'
  } as const,
  {
    'decode': (raw: string) => {
      return raw
        .split(',')
        .map((tag: string) => {
          return tag.trim();
        })
        .filter(Boolean);
    },
    'encode': (tags: readonly string[]) => {
      return tags.join(', ');
    }
  }
);

jt.set(TagListTransform);

const wire = 'fantasy, rare, first-edition, hardcover';
const tags = jt.instantiate(TagListTransform, wire);

console.assert(Array.isArray(tags));
console.assert(tags[0] === 'fantasy');
console.assert(tags.length === 4);
// 'fantasy, rare, first-edition, hardcover'
console.log('wire:', wire);
// ['fantasy', 'rare', 'first-edition', 'hardcover']
console.log('tags:', tags);

const reEncoded = jt.encode(TagListTransform, tags);

console.assert(reEncoded === wire);
// 'fantasy, rare, first-edition, hardcover'
console.log('round-trip:', reEncoded);
