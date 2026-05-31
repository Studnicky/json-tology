import {
  BookSchema, bookstoreEntities,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// price is Book's own retail property; under the allOf composition it lives at /allOf/1/properties/price
const priceSub = jt.subschemaAt(BookSchema.$id, '/allOf/1/properties/price');

const candidatePrice = 29.99;

const priceIsValid = bookstoreEntities.is(priceSub, candidatePrice);

if (priceIsValid) {
  console.assert(true, 'Price should be valid');
} else {
  console.error('price is not a valid Amount');
}

console.log('price sub-schema id:', priceSub.$id);
console.log('is(priceSub, 29.99):', priceIsValid);
