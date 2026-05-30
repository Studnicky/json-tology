import {
  createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const sub = jt.subschemaAt(OrderSchema.$id, '/properties/orderLines');

console.assert(
  typeof sub.$id === 'string' && sub.$id.includes('/properties/orderLines'),
  'Subschema should have synthesized $id with fragment'
);

console.log('orderLines sub-schema $id:', sub.$id);
