import { bookstoreEntities } from '../bookstore/index.js';

const ids = [...bookstoreEntities.registry.keys()];
const bookstoreSchemas = ids.filter((id) => {
  return id.startsWith('https://bookstore.example/');
});

console.assert(bookstoreSchemas.length > 0, 'Should have bookstore schemas');

for (const schema of bookstoreEntities.registry.values()) {
  console.assert(schema !== undefined, 'Each schema should be defined');
}

for (const [
  iri,
  schema
] of bookstoreEntities.registry) {
  console.assert(iri !== undefined && schema !== undefined, 'Each entry should have iri and schema');
}

const sizes: number[] = [];

for (const [
  iri,
  schema
] of bookstoreEntities.registry.entries()) {
  sizes.push(1);
}

console.assert(sizes.length === bookstoreEntities.registry.size, 'forEach count should match size');
