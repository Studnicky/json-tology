/**
 * 06b-abox-stable-iri.mjs
 *
 * Demonstrates toQuads() with iriFor and graphIRI overrides.
 * Stable canonical IRIs instead of hash-based instance IRIs.
 */

import { JsonTology } from '../dist/index.js';

const SpeciesSchema = {
  '$id': 'https://pokemontology.dev/schema/Species',
  'properties': {
    'name': { 'type': 'string' },
    'ndex': { 'type': 'integer' }
  },
  'required': [
    'name',
    'ndex'
  ],
  'type': 'object'
};

const jt = JsonTology.create({
  'baseIRI': 'https://pokemontology.dev',
  'schemas': [SpeciesSchema]
});

const bulbasaur = {
  'name': 'Bulbasaur',
  'ndex': 1
};

const quads = jt.toQuads(SpeciesSchema, bulbasaur, {
  'graphIRI': 'https://pokemontology.dev/graph/universal/species',
  'iriFor': 'https://pokemontology.dev/species/bulbasaur'
});

console.log('Quad count:', quads.length);
for (const quad of quads) {
  console.log(`  subject:   ${quad.subject}`);
  console.log(`  predicate: ${quad.predicate}`);
  console.log(`  graph:     ${quad.graph ?? '(default)'}`);
  console.log('  ---');
}

// Verify subject IRI is the canonical one (not hash-based)
const allSubjects = [...new Set(quads.map((quad) => {
  return quad.subject;
}))];

console.log('\nSubjects:', allSubjects);

const expectedSubject = 'https://pokemontology.dev/species/bulbasaur';
const expectedGraph = 'https://pokemontology.dev/graph/universal/species';

if (!allSubjects.includes(expectedSubject)) {
  throw new Error(`Expected subject IRI ${expectedSubject} not found. Got: ${allSubjects.join(', ')}`);
}

const allGraphs = [...new Set(quads.map((quad) => {
  return quad.graph;
}))];

if (!allGraphs.every((graph) => {
  return graph === expectedGraph;
})) {
  throw new Error(`Expected all quads to have graphIRI ${expectedGraph}. Got: ${allGraphs.join(', ')}`);
}

console.log('\nAll assertions passed.');
console.log('  iriFor:    ', expectedSubject);
console.log('  graphIRI:  ', expectedGraph);

// Also verify static variant works the same way
const staticQuads = JsonTology.toQuads(SpeciesSchema, bulbasaur, {
  'graphIRI': 'https://pokemontology.dev/graph/universal/species',
  'iriFor': 'https://pokemontology.dev/species/bulbasaur'
});

console.log('\nStatic toQuads quad count:', staticQuads.length);
const staticSubjects = [...new Set(staticQuads.map((quad) => {
  return quad.subject;
}))];

if (!staticSubjects.includes(expectedSubject)) {
  throw new Error(`Static toQuads: expected subject ${expectedSubject}. Got: ${staticSubjects.join(', ')}`);
}
console.log('Static toQuads: subject IRI correct.');
