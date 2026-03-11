import { JsonTology } from './dist/index.js';

const MultiType = {
  $id: 'https://myapp.io/MultiType',
  type: 'object',
  properties: {
    p1: { type: ['string', 'number'] },
    p2: { type: ['integer', 'boolean'] },
  },
};

const jt = new JsonTology({ 
  baseIRI: 'https://myapp.io', 
  schemas: [MultiType] 
});

console.log('=== JSON-LD - MultiType ===');
const jsonld = jt.ontology().jsonLdObject();
const multiType = jsonld['@graph'].find(n => n['@id'] === 'https://myapp.io/MultiType');
console.log(JSON.stringify(jsonld['@graph'], null, 2));

console.log('\n=== FULL N3 OUTPUT ===');
console.log(jt.ontology().n3());
