/**
 * baseIRI — ontology document anchor for serializers.
 *
 * `baseIRI` is passed to `JsonTology.create` to anchor the ontology document.
 * It does not need to match the `$id` prefixes of registered schemas — the
 * bookstore uses `urn:bookstore:*` $ids while `baseIRI` is an HTTPS URL used
 * by serializers to expand CURIE prefixes and anchor relative IRIs.
 *
 * Demonstrates: the TBox JSON-LD context carries the baseIRI namespace.
 */

import { bookstoreEntities } from '../bookstore/index.js';

// bookstoreEntities was constructed with baseIRI: 'https://bookstore.example'
const tbox = bookstoreEntities.toTbox();
const context = tbox.context();

console.assert(typeof context === 'object', 'TBox carries a prefix context object');

const jsonLd = tbox.jsonLd();

console.assert(typeof jsonLd === 'string', 'TBox serializes to a JSON-LD string');
console.assert(jsonLd.length > 0, 'JSON-LD output is non-empty');
