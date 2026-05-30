/**
 * Getting started: JsonTology.create — register schemas and build the type map
 *
 * `JsonTology.create` takes `baseIRI` and `schemas` (as const array),
 * registers all schemas, compiles the validation graph, and builds the
 * type map. Every subsequent method call that accepts a schema `$id`
 * returns typed results from that map.
 *
 * The bookstore domain uses this pattern in `examples/docs/bookstore/index.ts`
 * with all 31 schemas pre-registered. This example focuses on the minimal
 * single-schema form to show the core contract.
 */

import { JsonTology } from '../../../src/index.js';
import {
  bookstoreSchemas, CustomerSchema
} from '../bookstore/index.js';

// bookstoreSchemas seeds every transitive $ref so CustomerSchema's
// references to AddressSchema, EmailSchema, etc. all resolve.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': bookstoreSchemas
});

// Validate Bastian Balthazar Bux — zero errors confirms schema is registered.
const errs = jt.validate(CustomerSchema.$id, {
  'addresses': [],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
});

console.assert(errs.length === 0);

console.log('schema $id:', CustomerSchema.$id);
console.log('validation errors:', errs.length);
