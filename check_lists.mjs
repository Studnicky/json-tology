import { JsonTology } from './dist/index.js';

const MultiType = {
  '$id': 'https://myapp.io/MultiType',
  'properties': {
    'p1': {
      'type': [
        'string',
        'number'
      ]
    },
    'p2': {
      'type': [
        'integer',
        'boolean'
      ]
    }
  },
  'type': 'object'
};

const jt = new JsonTology({
  'baseIRI': 'https://myapp.io',
  'schemas': [MultiType]
});

console.log('=== JSON-LD - MultiType ===');
const jsonld = jt.ontology().jsonLdObject();
const _multiType = jsonld['@graph'].find((n) => {
  return n['@id'] === 'https://myapp.io/MultiType';
});
const graphJson = JSON.stringify(jsonld['@graph'], null, 2);

console.log(graphJson);

console.log('\n=== FULL JSON-LD OUTPUT ===');
console.log(jt.ontology().jsonLd());
