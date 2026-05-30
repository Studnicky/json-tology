/**
 * Compose.intersection — Example 3: getDefaults on an intersection schema
 *
 * `Compose.getDefaults` walks each constituent schema's `properties`
 * and returns the merged default values. The bookstore OrderSchema
 * has no top-level `default` keyword on its primitives, so the
 * extracted defaults are empty — exactly the documented behaviour.
 */

import { Compose } from '../../../src/index.js';
import { OrderSchema } from '../bookstore/index.js';

const defaults = Compose.getDefaults(OrderSchema);

// Order properties carry $ref to primitives but no top-level default keys,
// so getDefaults returns no recognised default fields.
console.assert(typeof defaults === 'object');
console.log('OrderSchema getDefaults (no declared defaults):', defaults);
