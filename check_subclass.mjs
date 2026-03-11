import { JsonTology } from './dist/index.js';

const Base = {
  '$id': 'https://myapp.io/Base',
  'properties': { 'id': { 'type': 'string' } },
  'type': 'object'
};

const Derived = {
  '$id': 'https://myapp.io/Derived',
  'allOf': [Base],
  'properties': { 'name': { 'type': 'string' } }
};

const jt = new JsonTology({
  'baseIRI': 'https://myapp.io',
  'schemas': [
    Base,
    Derived
  ]
});

console.log('=== JSON-LD - Derived class ===');
const jsonld = jt.ontology().jsonLdObject();
const derived = jsonld['@graph'].find((n) => {
  return n['@id'] === 'https://myapp.io/Derived';
});

console.log(JSON.stringify(derived, null, 2));

console.log('\n=== FULL N3 OUTPUT ===');
console.log(jt.ontology().n3());
