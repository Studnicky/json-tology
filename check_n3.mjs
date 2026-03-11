import { JsonTology } from './dist/index.js';

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  title: 'User',
  description: 'An application user',
  properties: {
    name:   { type: 'string' },
    email:  { type: 'string' },
    age:    { type: 'number' },
    status: { enum: ['active', 'inactive'] },
    tags:   { type: 'array', items: { type: 'string' } },
    active: { type: 'boolean' },
  },
  required: ['name', 'email'],
};

const jt = new JsonTology({ baseIRI: 'https://myapp.io', schemas: [UserSchema] });
console.log('=== JSON-LD OBJECT ===');
console.log(JSON.stringify(jt.ontology().jsonLdObject(), null, 2));
console.log('\n=== N3 OUTPUT ===');
console.log(jt.ontology().n3());
