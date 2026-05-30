/**
 * Custom vocabulary IRI via `predicateFor`.
 *
 * The `predicateFor` registry option is a callback invoked once per
 * property during ABox projection. Return a string to override the
 * derived IRI for that property; return `undefined` to fall through to
 * the default flat canonical form.
 *
 * This is useful when a consuming vocabulary already mints predicates
 * under a different namespace — for example, when aligning the bookstore
 * domain to Schema.org property IRIs for selected fields.
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures,
  bookstoreSchemas,
  CustomerSchema
} from '../bookstore/index.js';

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'predicateFor': ({
    classId,
    propertyName
  }) => {
    // Map Customer name and email to Schema.org equivalents.
    // All other class/property combinations fall through to the default flat predicate.
    const customerMap: Partial<Record<string, string>> = {
      'email': 'https://schema.org/email',
      'name': 'https://schema.org/name'
    };

    return classId === 'urn:bookstore:Customer' ? customerMap[propertyName] : undefined;
  },
  'schemas': bookstoreSchemas
});

const customer = jt.instantiate(CustomerSchema, aboxFixtures.customer);
const quads = jt.toQuads(CustomerSchema, customer);

const predicates = quads.map((quad) => {
  return quad.predicate.value;
});

// Overridden properties use the custom vocabulary IRI.
console.assert(
  predicates.includes('https://schema.org/name'),
  'name mapped to https://schema.org/name'
);
console.assert(
  predicates.includes('https://schema.org/email'),
  'email mapped to https://schema.org/email'
);

// Properties not covered by predicateFor use the flat canonical form.
console.assert(
  predicates.includes('https://bookstore.example/customerId'),
  'customerId falls through to canonical flat https://bookstore.example/customerId'
);

console.log('Predicates emitted for Customer:');
const sorted = [...new Set(predicates)].sort();

for (const predicate of sorted) {
  console.log(' ', predicate);
}
