import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const sub = bookstoreEntities.subschemaAt(OrderSchema.$id, '/properties/items');

console.assert(
  sub.$id === 'https://bookstore.example/Order#/properties/items',
  'Subschema should have synthesized $id with fragment'
);
