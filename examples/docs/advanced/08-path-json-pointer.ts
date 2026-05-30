/**
 * Path: convert JSON Pointer to JS access notation
 *
 * Path.toAccess converts RFC 6901 JSON Pointers to JS dot/bracket notation
 * for use in UI error display and form libraries.
 */

import { Path } from '../../../src/index.js';

const tests = [
  [
    '/items/0/quantity',
    'items[0].quantity'
  ],
  [
    '/customer/name',
    'customer.name'
  ],
  [
    '/oddly-shaped-key',
    '["oddly-shaped-key"]'
  ],
  [
    '',
    ''
  ]
];

for (const [
  pointer,
  expected
] of tests) {
  const result = Path.toAccess(pointer);

  console.assert(result === expected, `${pointer} -> ${result}`);
  console.log(`Path.toAccess(${JSON.stringify(pointer)}) => ${JSON.stringify(result)}`);
}
