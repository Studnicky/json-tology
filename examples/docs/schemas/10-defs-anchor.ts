/**
 * $defs and $anchor — Example 10: inline sub-schemas and named anchors
 *
 * `$defs` defines reusable sub-schemas inline within a parent schema.
 * They are accessible via `$ref` with a JSON Pointer fragment
 * (`#/$defs/Name`) or via a named `$anchor`.
 *
 * This example uses a focused one-shot registry so the `$defs`/`$anchor`
 * path is exercised directly and the assertion is self-contained.
 */

import { JsonTology } from '../../../src/index.js';

const OrderSchema = {
  '$defs': {
    'ShippingNote': {
      '$anchor': 'shipping-note',
      'minLength': 1,
      'type': 'string'
    },
    'Status': {
      'enum': [
        'pending',
        'shipped',
        'delivered',
        'cancelled'
      ],
      'type': 'string'
    }
  },
  '$id': 'urn:docs-schemas-10:Order',
  'properties': {
    'id': { 'type': 'string' },
    'note': { '$ref': '#shipping-note' },
    'status': { '$ref': '#/$defs/Status' }
  },
  'required': [
    'id',
    'status'
  ],
  'type': 'object'
} as const;

// doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
const jt = JsonTology.create({
  'baseIRI': 'urn:docs-schemas-10',
  'schemas': [OrderSchema] as const
});

// Valid order — status from enum, note optional.
const errsOk = jt.validate(OrderSchema.$id, {
  'id': '09f8e7d6-c5b4-3210-9876-543210fedcba',
  'note': 'Bastian Balthazar Bux — handle with care',
  'status': 'pending'
});

console.assert(errsOk.length === 0);

// Invalid status — not in enum.
const errsBad = jt.validate(OrderSchema.$id, {
  'id': '09f8e7d6-c5b4-3210-9876-543210fedcba',
  'status': 'unknown-status'
});

console.assert(errsBad.length > 0);
