/**
 * 06b-abox-stable-iri
 *
 * Demonstrates toQuads() with iriFor and graphIri overrides.
 * Stable canonical IRIs instead of hash-based instance IRIs.
 *
 * Run: npm run build && npx tsx examples/06b-abox-stable-iri.ts
 */

import { JsonTology } from '../src/index.js';

const BookSchema = {
  '$id': 'https://bookstore.example/schema/Book',
  'properties': {
    'pageCount': { 'type': 'integer' },
    'title': { 'type': 'string' }
  },
  'required': [
    'title',
    'pageCount'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'schemas': [BookSchema]
});

const gatsby = {
  'pageCount': 180,
  'title': 'The Great Gatsby'
};

const quads = jt.toQuads(BookSchema, gatsby, {
  'graphIri': 'https://bookstore.example/graph/catalog/books',
  'iriFor': 'https://bookstore.example/book/the-great-gatsby'
});

console.log('Quad count:', quads.length);
for (const quad of quads) {
  console.log(`  subject:   ${quad.subject.value}`);
  console.log(`  predicate: ${quad.predicate.value}`);
  console.log(`  graph:     ${quad.graph.value === '' ? '(default)' : quad.graph.value}`);
  console.log('  ---');
}

// Verify subject IRI is the canonical one (not hash-based)
const allSubjects = [...new Set(quads.map((quad) => {
  return quad.subject.value;
}))];

console.log('\nSubjects:', allSubjects);

const expectedSubject = 'https://bookstore.example/book/the-great-gatsby';
const expectedGraph = 'https://bookstore.example/graph/catalog/books';

if (!allSubjects.some((subject) => {
  return subject === expectedSubject;
})) {
  throw new Error(`Expected subject IRI ${expectedSubject} not found. Got: ${allSubjects.join(', ')}`);
}

const allGraphs = [...new Set(quads.map((quad) => {
  return quad.graph.value;
}))];

if (!allGraphs.every((graph) => {
  return graph === expectedGraph;
})) {
  throw new Error(`Expected all quads to have graphIri ${expectedGraph}. Got: ${allGraphs.join(', ')}`);
}

console.log('\nAll assertions passed.');
console.log('  iriFor:    ', expectedSubject);
console.log('  graphIri:  ', expectedGraph);

// Also verify static variant works the same way
const staticQuads = JsonTology.toQuads(BookSchema, gatsby, {
  'graphIri': 'https://bookstore.example/graph/catalog/books',
  'iriFor': 'https://bookstore.example/book/the-great-gatsby'
});

console.log('\nStatic toQuads quad count:', staticQuads.length);
const staticSubjects = [...new Set(staticQuads.map((quad) => {
  return quad.subject.value;
}))];

if (!staticSubjects.some((subject) => {
  return subject === expectedSubject;
})) {
  throw new Error(`Static toQuads: expected subject ${expectedSubject}. Got: ${staticSubjects.join(', ')}`);
}
console.log('Static toQuads: subject IRI correct.');
