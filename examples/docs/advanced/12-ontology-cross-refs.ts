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

console.assert(Boolean(AddressSchema.$id), 'address schema registered');
console.assert(Boolean(CustomerSchema.$id), 'customer schema registered');
console.assert(Boolean(owl), 'owl object present');
console.assert(Boolean(shacl), 'shacl object present');

const owlGraph = (owl as { '@graph'?: unknown[] })['@graph'];
const owlNodes = Array.isArray(owlGraph) ? owlGraph : [];
// Find Address and Customer class nodes in the TBox
const addressNode = owlNodes.find((n) => {
  return (n as Record<string, unknown>)['@id'] === AddressSchema.$id;
});
const customerNode = owlNodes.find((n) => {
  return (n as Record<string, unknown>)['@id'] === CustomerSchema.$id;
});

console.log('AddressSchema IRI:', AddressSchema.$id);
console.log('CustomerSchema IRI:', CustomerSchema.$id);
console.log('Address class in TBox:', addressNode !== undefined);
console.log('Customer class in TBox:', customerNode !== undefined);
console.log('TBox total node count:', owlNodes.length);
