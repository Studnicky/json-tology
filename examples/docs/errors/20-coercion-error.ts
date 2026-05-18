/**
 * CoercionError — raised by the coercion path.
 *
 * CoercionError mirrors InstantiationError but is thrown when a
 * coercion call rejects its input. Demonstrates the public surface
 * with a deliberately-constructed instance so the catch shape is
 * exercised without depending on a private coercion site.
 */

import { CoercionError } from '../../../src/index.js';

const synthetic = new CoercionError([{
  'keyword': 'minimum',
  'message': 'must be >= 0',
  'params': {},
  'path': '/total/amount'
}]);

if (synthetic instanceof CoercionError) {
  console.assert(synthetic.code === 'COERCION_FAILED');
  console.assert(synthetic.errors.length === 1);
}
