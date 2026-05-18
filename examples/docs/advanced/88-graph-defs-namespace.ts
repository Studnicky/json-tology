/**
 * $defs — internal schema namespace on the same graph node.
 *
 * `$defs` entries live in the same namespace as their parent schema. They are
 * part of that schema's ontology surface and are accessible as
 * `<parentId>#/$defs/<name>`. The graph edge from the parent to `$defs` sub-schemas
 * stays within the same schema node — unlike cross-schema `$ref` which creates
 * inter-schema edges.
 *
 * Demonstrates: a schema with $defs can reference its own definitions via
 * fragment pointers; the registry resolves them at validation time.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// OrderWithDefs uses $defs to define LineItem internally
const OrderWithDefs = {
  '$defs': {
    'LineItem': {
      'properties': {
        'bookIsbn': { 'type': 'string' },
        'quantity': { 'type': 'integer' }
      },
      'required': [
        'bookIsbn',
        'quantity'
      ],
      'type': 'object'
    }
  },
  '$id': 'urn:bookstore:OrderWithDefs',
  'properties': {
    'items': {
      'items': { '$ref': '#/$defs/LineItem' },
      'type': 'array'
    }
  },
  'type': 'object'
} as const;

const registry = new SchemaRegistry();

registry.set(OrderWithDefs);

console.assert(registry.has(OrderWithDefs.$id), 'OrderWithDefs registered');

// The schema validates data with inline-defined LineItem structure
const lineItem = {
  'bookIsbn': '9783522128001',
  'quantity': 1
};
const valid = registry.validate(OrderWithDefs.$id, { 'items': [lineItem] });

console.assert(valid.ok, '$defs LineItem resolves at validation time');

// Invalid: quantity is missing
const missingQty = { 'bookIsbn': '9783522128001' };
const invalid = registry.validate(OrderWithDefs.$id, { 'items': [missingQty] });

console.assert(!invalid.ok, 'missing required quantity fails validation');
