import { JsonTology } from './dist/index.js';

const Nullable = {
  '$id': 'https://myapp.io/Nullable',
  'properties': {
    'p1': {
      'type': [
        'string',
        'null'
      ]
    },
    'p2': {
      'type': [
        'number',
        'null'
      ]
    }
  },
  'type': 'object'
};

const jt = new JsonTology({
  'baseIRI': 'https://myapp.io',
  'schemas': [Nullable]
});

console.log('=== JSON-LD ===');
const jsonld = jt.ontology().jsonLdObject();
const jsonldStr = JSON.stringify(jsonld, null, 2);

console.log(jsonldStr);

console.log('\n=== FULL JSON-LD OUTPUT ===');
console.log(jt.ontology().jsonLd());
