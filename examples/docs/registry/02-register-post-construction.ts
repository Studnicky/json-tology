import {
  AddressSchema, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Post-construction registration
const jt = bookstoreEntities;

jt.set(AddressSchema).set(CustomerSchema);

// Or register an array:
jt.set([
  AddressSchema,
  CustomerSchema
] as const);

console.assert(jt.registry.has(AddressSchema.$id), 'AddressSchema should be registered');
console.assert(jt.registry.has(CustomerSchema.$id), 'CustomerSchema should be registered');
