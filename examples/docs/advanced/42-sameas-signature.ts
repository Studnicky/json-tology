/**
 * Signature of JsonTology.prototype.sameAs.
 *
 * Records an owl:sameAs assertion between two individuals. Both IRIs
 * denote the same real-world entity. Emitted at toQuads() time as a
 * pair of symmetric quads.
 */

import { bookstoreEntities } from '../bookstore/index.js';

// Type assertion: sameAs takes two IRI strings and returns void.
const sameAs: (instanceIriA: string, instanceIriB: string) => void = (instanceIriA, instanceIriB) => {
  bookstoreEntities.sameAs(instanceIriA, instanceIriB);
};

sameAs('urn:bookstore:demo:a', 'urn:bookstore:demo:b');

console.assert(typeof sameAs === 'function', 'sameAs is callable with the documented signature');
