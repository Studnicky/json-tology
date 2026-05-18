/**
 * Argument conventions: subschemaAt — composable pointer resolution
 *
 * `subschemaAt` resolves a JSON Pointer within a parent schema and returns
 * the sub-schema as a registerable schema object with a synthesized `$id`
 * of the form `<parent.$id>#<pointer>`. The result can be passed directly
 * to any of the four core methods.
 *
 * This example resolves the `items` array item sub-schema of `OrderSchema`
 * and validates a single order line against it.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Resolve the array item sub-schema at /properties/items/items.
const itemSchema = bookstoreEntities.subschemaAt(
  OrderSchema.$id,
  '/properties/items/items'
);

// The returned schema has a synthesized $id.
console.assert(typeof itemSchema.$id === 'string');
console.assert(itemSchema.$id.startsWith(OrderSchema.$id));

// Validate a concrete order line item against the resolved sub-schema.
const line = aboxFixtures.order.items[0];
const errs = bookstoreEntities.validate(itemSchema, line);

console.assert(errs.length === 0);

const bookIsbn: string = line.bookIsbn;

console.assert(bookIsbn === '9783522128001');
