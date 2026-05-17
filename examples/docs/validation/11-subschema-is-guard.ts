import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const priceSub = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/price');

const candidatePrice = 29.99;

if (bookstoreEntities.is(priceSub, candidatePrice)) {
  console.assert(true, 'Price should be valid');
} else {
  console.error('price is not a valid Amount');
}
