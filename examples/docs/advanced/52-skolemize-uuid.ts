/**
 * Skolemize.uuid — non-deterministic urn:uuid minter.
 *
 * Mints `urn:uuid:<v4>` for every emission. Useful when you want unique
 * IRIs and don't care about content addressing or external joins.
 *
 * The Review schema stands in for a generic "event-like" object here:
 * each call produces a fresh identity even when the payload is identical.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const firstPass = bookstoreEntities.toQuads(ReviewSchema, aboxFixtures.review, { 'iriFor': Skolemize.uuid() });
const secondPass = bookstoreEntities.toQuads(ReviewSchema, aboxFixtures.review, { 'iriFor': Skolemize.uuid() });

const firstSubject = firstPass[0]?.subject.value ?? '';
const secondSubject = secondPass[0]?.subject.value ?? '';

console.assert(firstSubject.startsWith('urn:uuid:'), 'first emission uses urn:uuid');
console.assert(secondSubject.startsWith('urn:uuid:'), 'second emission uses urn:uuid');
console.assert(firstSubject !== secondSubject, 'each call mints a fresh UUID');
