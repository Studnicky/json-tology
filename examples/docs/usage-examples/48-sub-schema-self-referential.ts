/**
 * Sub-schema patterns — self-referential cycles
 *
 * A sub-schema may `$ref` itself or any ancestor. The graph is allowed
 * to be cyclic; the registry resolves a cycle by short-circuiting on
 * the second visit, so type inference and runtime traversal both
 * terminate. The OWL output emits a single class with an
 * `rdfs:domain` / `rdfs:range` self-edge.
 *
 * Demonstrated against a small Manager → Manager hierarchy registered
 * on ``. The fixture chain (Carl Conrad Coreander
 * managing Bastian Balthazar Bux) is two levels deep.
 */

import {
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const ManagerSchema = {
  '$id': 'https://bookstore.example/Manager',
  'properties': {
    'manager': { '$ref': 'https://bookstore.example/Manager' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const jt2 = jt.set(ManagerSchema);

const bastian = jt2.instantiate(ManagerSchema.$id, {
  'manager': {
    'manager': { 'name': 'Carl Conrad Coreander' },
    'name': 'Carl Conrad Coreander'
  },
  'name': 'Bastian Balthazar Bux'
}) as {
  readonly 'manager': { readonly 'name': string };
  readonly 'name': string;
};

console.assert(bastian.name === 'Bastian Balthazar Bux');
console.assert(bastian.manager.name === 'Carl Conrad Coreander');
// 'Bastian Balthazar Bux' — root node
console.log('name:', bastian.name);
// 'Carl Conrad Coreander' — nested via $ref cycle
console.log('manager name:', bastian.manager.name);
