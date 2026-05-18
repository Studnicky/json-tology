import { JsonTology } from '../../../src/index.js';
import { OrderSchema } from '../bookstore/index.js';

const sub = JsonTology.subschemaAt(OrderSchema, '/properties/customerId');

console.assert(
  sub.$id === 'https://bookstore.example/Order#/properties/customerId',
  'Static subschemaAt should synthesize correct $id'
);
