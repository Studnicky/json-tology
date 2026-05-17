/**
 * OWL and SHACL from cross-referenced schemas
 *
 * When CustomerSchema has addresses: [Address] via $ref, the ontology output
 * produces rdfs:domain and rdfs:range relations between the Customer class
 * and the Address class.
 */

import {
  AddressSchema, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const owl = bookstoreEntities.ontology().jsonLdObject();
const shacl = bookstoreEntities.ontology().shaclObject();

console.assert(AddressSchema.$id, 'address schema registered');
console.assert(CustomerSchema.$id, 'customer schema registered');
console.assert(owl, 'owl object present');
console.assert(shacl, 'shacl object present');
