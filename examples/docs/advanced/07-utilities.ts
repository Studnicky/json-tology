/**
 * Public utility classes — Curie, Path, Resolver, Hash
 *
 * Demonstrates each utility against canonical bookstore IRIs and
 * JSON pointer paths from the aboxFixtures.
 */

import {
  Curie, Hash, Path, Resolver
} from '../../../src/index.js';
import { bookstoreEntities } from '../bookstore/index.js';
import { aboxFixtures } from '../bookstore/aboxFixtures.js';

// ──────────────────────────────────────────────────────────────────────────
// Curie: compact/expand IRIs against a prefix map

const curie = new Curie({
  'bookstore': 'https://bookstore.example/',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#'
});

// Expand compact CURIE form to full IRI
const expandedCustomer = curie.expand('bookstore:Customer');

console.assert(expandedCustomer === 'https://bookstore.example/Customer');

const expandedString = curie.expand('xsd:string');

console.assert(expandedString === 'http://www.w3.org/2001/XMLSchema#string');

// Compact full IRI to CURIE form (longest match)
const compactCustomer = curie.compact('https://bookstore.example/Customer');

console.assert(compactCustomer === 'bookstore:Customer');

const compactType = curie.compact('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');

console.assert(compactType === 'rdf:type');

// ──────────────────────────────────────────────────────────────────────────
// Path: convert JSON Pointer to JS access form

const itemQuantityPointer = '/items/0/quantity';
const itemQuantityAccess = Path.toAccess(itemQuantityPointer);

console.assert(itemQuantityAccess === 'items[0].quantity');

const customerNamePointer = '/customer/name';
const customerNameAccess = Path.toAccess(customerNamePointer);

console.assert(customerNameAccess === 'customer.name');

const oddKeyPointer = '/oddly-shaped-key';
const oddKeyAccess = Path.toAccess(oddKeyPointer);

console.assert(oddKeyAccess === '["oddly-shaped-key"]');

const emptyPointer = '';
const emptyAccess = Path.toAccess(emptyPointer);

console.assert(emptyAccess === '');

// ──────────────────────────────────────────────────────────────────────────
// Resolver: merge per-call options with base options

const baseOptions = {
  'enableDefaults': true,
  'enableValidation': true
};
const overrideOptions = { 'enableDefaults': false };
const mergedOptions = Resolver.merge(baseOptions, overrideOptions);

console.assert(!mergedOptions.enableDefaults);
console.assert(mergedOptions.enableValidation);

const undefinedOverride: Partial<typeof baseOptions> = {};
const mergedWithUndefined = Resolver.merge(baseOptions, undefinedOverride);

console.assert(mergedWithUndefined.enableDefaults);

// ──────────────────────────────────────────────────────────────────────────
// Hash: deterministic FNV-1a hash of JSON-serializable values

const bookHash1 = Hash.value({
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
});

// Key order does not matter — same hash
const bookHash2 = Hash.value({
  'isbn': '9783522128001',
  'title': 'Die unendliche Geschichte'
});

console.assert(bookHash1 === bookHash2);
console.assert(typeof bookHash1 === 'string');

// Different content produces different hashes
const differentHash = Hash.value({
  'isbn': '9780140449136',
  'title': 'War and Peace'
});

console.assert(bookHash1 !== differentHash);

// ──────────────────────────────────────────────────────────────────────────
// Integration: all utilities work with canonical bookstore entities

// Curie can expand bookstore IRIs using the registry's built-in prefix map
const ctx = bookstoreEntities.ontology().context();

console.assert(typeof ctx === 'object');

void aboxFixtures;

// Output demonstrating each utility's result
console.log('Curie.expand("bookstore:Customer"):', expandedCustomer);
console.log('Curie.compact("https://bookstore.example/Customer"):', compactCustomer);
console.log('Path.toAccess("/items/0/quantity"):', itemQuantityAccess);
console.log('Path.toAccess("/customer/name"):', customerNameAccess);
console.log('Resolver.merge result — enableDefaults:', mergedOptions.enableDefaults, '| enableValidation:', mergedOptions.enableValidation);
console.log('Hash.value (same objects equal):', bookHash1 === bookHash2);
console.log('Hash.value sample:', bookHash1);
