import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

console.assert(
  bookstoreEntities.registry.has(CustomerSchema.$id),
  'CustomerSchema should be registered'
);
console.assert(
  !bookstoreEntities.registry.has('urn:bookstore:NonExistent'),
  'NonExistent schema should not be registered'
);

// Guard pattern:
function validateIfPresent(schemaId: string, data: unknown) {
  const schema = bookstoreEntities.registry.get(schemaId);

  if (!schema) {
    return `Schema '${schemaId}' not registered`;
  }
  const errs = bookstoreEntities.validate(schema as Record<string, unknown> & { '$id': string }, data);

  return errs.ok ? null : `Validation failed with ${errs.items.length} errors`;
}

console.assert(
  validateIfPresent(CustomerSchema.$id, aboxFixtures.customer) === null,
  'Valid customer should pass'
);

console.log('has CustomerSchema:', bookstoreEntities.registry.has(CustomerSchema.$id));
console.log('has urn:bookstore:NonExistent:', bookstoreEntities.registry.has('urn:bookstore:NonExistent'));
console.log('validateIfPresent(Customer, valid fixture):', validateIfPresent(CustomerSchema.$id, aboxFixtures.customer));
