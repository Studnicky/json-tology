/**
 * $ref cross-schema — Example 9: references resolved through the registry
 *
 * A `$ref` points one schema at another by IRI. The runtime resolves it
 * against the registry on first use. Cross-schema `$ref` must point to a
 * `$id` that is registered (or nested within a registered schema), or the
 * runtime throws `GraphError` with code `REF_UNRESOLVED`.
 *
 * `OrderLineSchema` references `IsbnSchema` and `MoneySchema` via `$ref`.
 * This example validates a concrete order line against the registered
 * schema so the resolver exercises the cross-schema path.
 */

import {
  aboxFixtures, bookstoreEntities, OrderLineSchema
} from '../bookstore/index.js';

// The fixture order line has bookIsbn and unitPrice — both are $ref fields.
const line = aboxFixtures.order.orderLines[0];
const errs = bookstoreEntities.validate(OrderLineSchema.$id, line);

console.assert(errs.length === 0);

const bookIsbn: string = line.bookIsbn;
const quantity: number = line.quantity;

console.assert(bookIsbn === '9783522128001');
console.assert(quantity === 1);

console.log('OrderLineSchema.$id:', OrderLineSchema.$id);
console.log('line.bookIsbn ($ref -> IsbnSchema):', bookIsbn);
console.log('line.quantity:', quantity);
console.log('line.unitPrice ($ref -> MoneySchema):', line.unitPrice);
console.log('Validation errors (expect 0):', errs.length);
