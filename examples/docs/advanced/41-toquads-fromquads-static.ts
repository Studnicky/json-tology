/**
 * Static counterparts: JsonTology.toQuads / JsonTology.fromQuads.
 *
 * Static variants build an ephemeral registry containing only the supplied
 * schema, run the operation, and discard the registry. Use them when the
 * schema is self-contained ($ref free) and the projection runs once.
 *
 * The bookstore's IsbnSchema is a self-contained string primitive — its
 * graph has no $ref edges, so it round-trips through the static API
 * without registering its sibling schemas.
 *
 * Note: object-shaped bookstore entities (Customer, Order, Book) carry
 * $refs to other registered primitives and would throw GraphError on the
 * static API. Use a long-lived JsonTology instance for those.
 */

import { JsonTology } from '../../../src/index.js';
import { IsbnSchema } from '../bookstore/index.js';

const isbn = '9783522128001';
const quads = JsonTology.toQuads(IsbnSchema, isbn);

console.assert(quads.length >= 0, 'static toQuads returned a quad array');

const restored = JsonTology.fromQuads(IsbnSchema, quads);

console.assert(Array.isArray(restored), 'static fromQuads returned an array');
