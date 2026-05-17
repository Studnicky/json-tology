/**
 * Date-only transform — `YYYY-MM-DD` string ↔ Date at UTC midnight
 *
 * Wire format `'YYYY-MM-DD'` (canonical `PublicationDateSchema` shape).
 * Decoder pins to UTC midnight; encoder strips the time off on output.
 * Registered on a `Compose.equivalent` sibling so the canonical
 * `PublicationDateSchema` stays as a wire string everywhere else.
 */

import {
  Compose, Transform
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, PublicationDateSchema
} from '../bookstore/index.js';

const PublishedAtSchema = Compose.equivalent(PublicationDateSchema, { '$id': 'https://bookstore.example/PublishedAt' } as const);

bookstoreEntities.set(PublishedAtSchema);

Transform.create<typeof PublishedAtSchema, Date>(PublishedAtSchema, {
  'decode': (wire) => {
    return new Date(`${wire as string}T00:00:00Z`);
  },
  'encode': (date) => {
    return date.toISOString().slice(0, 10);
  }
});

const wire = aboxFixtures.rareBook.publishedOn;
const decoded = bookstoreEntities.instantiate(PublishedAtSchema.$id, wire);

if (!(decoded instanceof Date)) {
  throw new TypeError('PublishedAt transform did not return a Date');
}

const date: Date = decoded;

console.assert(date.getUTCFullYear() === 1979);

const reEncoded = bookstoreEntities.encode(PublishedAtSchema, date);

console.assert(reEncoded === wire);
