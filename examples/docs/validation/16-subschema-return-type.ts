import {
  createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const sub = jt.subschemaAt(OrderSchema.$id, '/properties/items');

console.assert(
  sub.$id === 'https://bookstore.example/Order#/properties/items',
  'Subschema should have synthesized $id with fragment'
);
