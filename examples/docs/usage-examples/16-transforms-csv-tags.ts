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

const TagListSchema = {
  '$id': 'https://bookstore.example/TagList',
  'type': 'string'
} as const;

jt.set(TagListSchema);

const TagListTransform = Transform.create<typeof TagListSchema, readonly string[]>(TagListSchema, {
  'decode': (raw) => {
    return raw
      .split(',')
      .map((tag) => {
        return tag.trim();
      })
      .filter(Boolean);
  },
  'encode': (tags) => {
    return tags.join(', ');
  }
});

const wire = 'fantasy, rare, first-edition, hardcover';
const tags = jt.instantiate(TagListTransform, wire);

console.assert(Array.isArray(tags));
console.assert(tags[0] === 'fantasy');
console.assert(tags.length === 4);

const reEncoded = jt.encode(TagListTransform, tags);

console.assert(reEncoded === wire);
