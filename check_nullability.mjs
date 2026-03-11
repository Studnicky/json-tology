import { JsonTology } from './dist/index.js';

const Nullable = {
  $id: 'https://myapp.io/Nullable',
  type: 'object',
  properties: {
    p1: { type: ['string', 'null'] },
    p2: { type: ['number', 'null'] },
  },
};

const jt = new JsonTology({ 
  baseIRI: 'https://myapp.io', 
  schemas: [Nullable] 
});

console.log('=== JSON-LD ===');
const jsonld = jt.ontology().jsonLdObject();
console.log(JSON.stringify(jsonld, null, 2));

console.log('\n=== FULL N3 OUTPUT ===');
console.log(jt.ontology().n3());
