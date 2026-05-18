/**
 * jt:config — Example 4: bundled runtime policy (extra + frozen)
 *
 * `jt:config` co-locates several per-schema runtime policies. The
 * `extra` field controls how undeclared properties are handled during
 * instantiation; `frozen` deep-freezes the materialized value.
 *
 * This example registers a schema with `extra: 'forbid'` and verifies
 * that an unknown property causes `instantiate` to throw, while a clean
 * payload passes through normally.
 */

import { JsonTology } from '../../../src/index.js';

const AddressSchema = {
  '$id': 'urn:docs-schemas-04:Address',
  'jt:config': {
    // unknown properties → InstantiationError
    'extra': 'forbid',
    // result is deeply frozen
    'frozen': true
  },
  'properties': {
    'city': { 'type': 'string' },
    'postalCode': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': [
    'street',
    'city',
    'postalCode'
  ],
  'type': 'object'
} as const;

// doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
const jt = JsonTology.create({
  'baseIRI': 'urn:docs-schemas-04',
  'schemas': [AddressSchema] as const
});

// Clean payload — passes.
const address = jt.instantiate(AddressSchema.$id, {
  'city': 'München',
  'postalCode': '80331',
  'street': 'Reichenbachstraße 14'
});

console.assert(address.city === 'München');
console.assert(Object.isFrozen(address));

// Unknown property — throws because extra: 'forbid'.
let caughtExtra = false;

try {
  jt.instantiate(AddressSchema.$id, {
    'city': 'München',
    'postalCode': '80331',
    'street': 'Reichenbachstraße 14',
    'unknownField': 'should not be here'
  });
} catch {
  caughtExtra = true;
}

console.assert(caughtExtra);
