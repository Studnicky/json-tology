/**
 * toSchema — Anti-pattern 1: Using toSchema when you need the original authored object
 * Demonstrates: toSchema reconstructs from graph; registry.get returns the original reference
 *
 * The anti-pattern uses toSchema for attribute extraction on the original
 * authored schema; the correct approach is bookstoreEntities.registry.get.
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// Anti-pattern: toSchema reconstructs from the graph; key order or $defs may differ
// Don't do this for retrieving the original authored object
const reconstructed = bookstoreEntities.toSchema(BookSchema.$id);

if (reconstructed !== undefined) {
  const _reconstructedTitle = reconstructed.title;

  void _reconstructedTitle;
}

// Correct approach: use bookstoreEntities.registry.get to retrieve original reference
const original = bookstoreEntities.registry.get(BookSchema.$id);

console.assert(original !== undefined, 'BookSchema should be registered');

// original is the exact object reference passed to JsonTology.create
console.assert(original === BookSchema, 'registry.get returns the original schema reference');
