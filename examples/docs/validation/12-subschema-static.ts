import { JsonTology } from '../../../src/index.js';
import { OrderSchema } from '../bookstore/index.js';

const sub = JsonTology.subschemaAt(OrderSchema, '/properties/customerId');

console.assert(
  typeof sub.$id === 'string' && sub.$id.includes('/properties/customerId'),
  'Static subschemaAt should synthesize correct $id'
);

console.log('static subschema $id:', sub.$id);
