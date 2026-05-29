import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

console.assert(
  bookstoreEntities.registry.has(CustomerSchema.$id),
  'CustomerSchema should be registered'
);
console.assert(
  !bookstoreEntities.registry.has('https://bookstore.example/NonExistent'),
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
  validateIfPresent(CustomerSchema.$id, {
    'id': '1',
    'name': 'Test'
  }) === null,
  'Valid customer should pass'
);
