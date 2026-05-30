/**
 * toTbox() is not cached — each call returns a fresh OntologyBuilder.
 *
 * `toTbox()` builds a new `OntologyBuilder` on every call. Reference equality
 * between two calls is `false`. For hot paths where reference stability matters,
 * use `ontology()` which is cached and returns the same builder until a new
 * schema is registered.
 *
 * Demonstrates: toTbox() !== toTbox() (two fresh builders); ontology() returns
 * the same cached reference on repeated calls.
 */

import { bookstoreEntities } from '../bookstore/index.js';

// toTbox() — not cached: each call is fresh
const first = bookstoreEntities.toTbox();
const second = bookstoreEntities.toTbox();

console.assert(first !== second, 'toTbox() returns a new OntologyBuilder on each call');
console.log('toTbox() not cached (first !== second):', first !== second);

// ontology() — cached: same reference until a new schema is registered
const cachedA = bookstoreEntities.ontology();
const cachedB = bookstoreEntities.ontology();

console.assert(cachedA === cachedB, 'ontology() returns the same cached OntologyBuilder');
console.log('ontology() cached (cachedA === cachedB):', cachedA === cachedB);
