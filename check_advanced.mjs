import { JsonTology } from './dist/index.js';

const Animal = {
  '$id': 'https://myapp.io/Animal',
  'properties': { 'name': { 'type': 'string' } },
  'title': 'Animal',
  'type': 'object'
};

const Pet = {
  '$id': 'https://myapp.io/Pet',
  'oneOf': [
    Animal,
    { 'type': 'null' }
  ]
};

const Status = {
  '$id': 'https://myapp.io/Status',
  'enum': [
    'active',
    'inactive',
    'pending'
  ],
  'title': 'Status'
};

const Config = {
  '$id': 'https://myapp.io/Config',
  'const': { 'version': 1 },
  'type': 'object'
};

const jt = new JsonTology({
  'baseIRI': 'https://myapp.io',
  'schemas': [
    Animal,
    Pet,
    Status,
    Config
  ]
});

console.log('=== JSON-LD - Status with enum ===');
const jsonld = jt.ontology().jsonLdObject();
const status = jsonld['@graph'].find((n) => {
  return n['@id'] === 'https://myapp.io/Status';
});

console.log(JSON.stringify(status, null, 2));

console.log('\n=== JSON-LD - Pet with oneOf ===');
const pet = jsonld['@graph'].find((n) => {
  return n['@id'] === 'https://myapp.io/Pet';
});

console.log(JSON.stringify(pet, null, 2));

console.log('\n=== JSON-LD - Config with const ===');
const config = jsonld['@graph'].find((n) => {
  return n['@id'] === 'https://myapp.io/Config';
});

console.log(JSON.stringify(config, null, 2));

console.log('\n=== FULL N3 OUTPUT ===');
console.log(jt.ontology().n3());
