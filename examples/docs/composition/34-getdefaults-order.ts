/**
 * Compose.getDefaults — Example 2: Pre-populate an Order form
 *
 * OrderSchema's top-level properties all $ref into primitives that do
 * not declare a default. The extracted defaults object reflects that
 * — every required field stays absent for the user to fill in.
 */

import { Compose } from '../../../src/index.js';
import { OrderSchema } from '../bookstore/index.js';

const defaults = Compose.getDefaults(OrderSchema);

console.assert(typeof defaults === 'object');
// orderId, customerId, orderLines, orderTotal, placedAt, shippingAddress have no
// declared default — none appear in the result.
console.assert(!('orderId' in defaults));
console.assert(!('customerId' in defaults));
console.assert(!('orderTotal' in defaults));
console.log('OrderSchema defaults (empty — all fields are user-supplied):', defaults);
