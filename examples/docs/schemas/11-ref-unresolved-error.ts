/**
 * $ref strict resolution — Example 11: GraphError REF_UNRESOLVED
 *
 * If a cross-schema `$ref` points to an IRI not present in the registry,
 * the runtime throws `GraphError` with code `REF_UNRESOLVED` on the first
 * use of the referencing schema. The lazy walk runs at most once per
 * schema entry; subsequent calls use the cached (error) result.
 *
 * Local fragment refs (`#`, `#/foo`, `#anchor`) are unaffected.
 */

import {
  GraphError, JsonTology
} from '../../../src/index.js';

const OrderLineSchema = {
  '$id': 'urn:docs-schemas-11:OrderLine',
  'properties': {
    // This $ref points to a schema that is NOT registered in this registry.
    'book': { '$ref': 'urn:docs-schemas-11:Book' },
    'qty': {
      'minimum': 1,
      'type': 'integer'
    }
  },
  'required': ['qty'],
  'type': 'object'
} as const;

// BookSchema is intentionally NOT registered.
const jt = JsonTology.create({
  'baseIRI': 'urn:docs-schemas-11',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  'schemas': [OrderLineSchema] as const
});

let caught = false;
let errorCode = '';

try {
  jt.validate(OrderLineSchema.$id, {
    'book': {},
    'qty': 1
  });
} catch (error) {
  if (error instanceof GraphError && error.code === 'REF_UNRESOLVED') {
    caught = true;
    errorCode = error.code;
  }
}

console.assert(caught);

console.log('Unresolved $ref throws GraphError — caught:', caught);
console.log('error.code:', errorCode);
console.log('$ref to urn:docs-schemas-11:Book raises REF_UNRESOLVED because BookSchema was not registered.');
