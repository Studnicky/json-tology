import { JsonTology } from './dist/index.js';

const Colors = {
  '$id': 'https://myapp.io/Colors',
  'enum': [
    'red',
    'green',
    'blue'
  ]
};

const Levels = {
  '$id': 'https://myapp.io/Levels',
  'enum': [
    1,
    2,
    3
  ]
};

const Mixed = {
  '$id': 'https://myapp.io/Mixed',
  'enum': [
    true,
    false
  ]
};

const jt = new JsonTology({
  'baseIRI': 'https://myapp.io',
  'schemas': [
    Colors,
    Levels,
    Mixed
  ]
});

console.log('=== JSON-LD ===');
const jsonld = jt.ontology().jsonLdObject();

console.log(JSON.stringify(jsonld['@graph'], null, 2));

console.log('\n=== FULL N3 OUTPUT ===');
console.log(jt.ontology().n3());
