/**
 * Graph-native authoring — named entity, multiple references.
 *
 * Define the constrained shape once as a named schema and reference it via
 * `$ref` wherever it is needed. The graph sees one node; both consumers share
 * a single OWL DatatypeProperty range; `findDuplicates()` returns empty.
 *
 * Demonstrates: named IsbnSchema referenced from BookSchema and OrderSchema;
 * findDuplicates returns an empty array.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// GOOD — one ISBN node, referenced from both schemas
const IsbnSchema = {
  '$id': 'urn:bookstore:IsbnNamed',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

const BookWithRef = {
  '$id': 'urn:bookstore:BookRef',
  'properties': {
    // $ref to named schema — not inline
    'isbn': { '$ref': IsbnSchema.$id },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const OrderWithRef = {
  '$id': 'urn:bookstore:OrderRef',
  'properties': {
    // same $ref — single graph node shared by both schemas
    'isbn': { '$ref': IsbnSchema.$id },
    'quantity': { 'type': 'integer' }
  },
  'type': 'object'
} as const;

const registry = new SchemaRegistry();

registry.set(IsbnSchema);
registry.set(BookWithRef);
registry.set(OrderWithRef);

// Named entity with $ref — no duplicates
const duplicates = registry.findDuplicates();

console.assert(
  duplicates.length === 0,
  'named schema + $ref produces zero duplicates'
);

// Both schemas validate the same ISBN via the shared constraint
// Die unendliche Geschichte 1979 Thienemann first edition ISBN-13
const validIsbn = '9783522128001';

// ok is true when the ValidationErrors collection is empty (no errors)
const bookResult = registry.validate(BookWithRef.$id, {
  'isbn': validIsbn,
  'title': 'Die unendliche Geschichte'
});

console.assert(bookResult.ok, 'BookRef validates with the named IsbnSchema constraint');

const orderResult = registry.validate(OrderWithRef.$id, {
  'isbn': validIsbn,
  'quantity': 1
});

console.assert(orderResult.ok, 'OrderRef validates with the same named IsbnSchema constraint');
