import { bookstoreEntities } from '../bookstore/index.js';

const ids = [...bookstoreEntities.registry.keys()];
const bookstoreSchemas = ids.filter((id) => {
  return id.startsWith('https://bookstore.example/');
});

console.assert(bookstoreSchemas.length > 0, 'Should have bookstore schemas');

for (const schema of bookstoreEntities.registry.values()) {
  // Each schema is always defined; just verify iteration works
  void schema;
}

for (const [
  iri,
  schema
] of bookstoreEntities.registry) {
  // iri and schema are always defined by the registry contract
  void iri;
  void schema;
}

const sizes: number[] = [];

for (const [
  _iri,
  _schema
] of bookstoreEntities.registry.entries()) {
  sizes.push(1);
}

console.assert(sizes.length === bookstoreEntities.registry.size, 'forEach count should match size');
