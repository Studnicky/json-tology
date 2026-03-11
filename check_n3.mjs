import { JsonTology } from './dist/index.js';

const UserSchema = {
  '$id': 'https://myapp.io/User',
  'description': 'An application user',
  'properties': {
    'active': { 'type': 'boolean' },
    'age': { 'type': 'number' },
    'email': { 'type': 'string' },
    'name': { 'type': 'string' },
    'status': {
      'enum': [
        'active',
        'inactive'
      ]
    },
    'tags': {
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': [
    'name',
    'email'
  ],
  'title': 'User',
  'type': 'object'
};

const jt = new JsonTology({
  'baseIRI': 'https://myapp.io',
  'schemas': [UserSchema]
});

console.log('=== JSON-LD OBJECT ===');
console.log(JSON.stringify(jt.ontology().jsonLdObject(), null, 2));
console.log('\n=== N3 OUTPUT ===');
console.log(jt.ontology().n3());
