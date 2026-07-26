/**
 * SkolemizeFunctionInterface — the function signature accepted by iriForFunction.
 *
 * Custom strategies receive the JSON Pointer path, the current value,
 * and the depth (0 at the root, +1 per nested object). Returning
 * undefined falls through to the default Skolemize.hash minter.
 *
 * Within a single projection call, results are memoized by value
 * reference — the same input object always produces the same IRI
 * within one emission.
 */

import type { SkolemizeFunctionInterface } from '../../../src/interfaces/SkolemizeFunctionInterface.js';

// ctx.path is a JSON-Pointer-style path to the current value.
// ctx.value is the object being projected.
// ctx.depth is 0 at the root and +1 per nested object.
const strategy: SkolemizeFunctionInterface = (ctx) => {
  return ctx.depth === 0
    ? 'https://shop.example.com/root'
    : undefined;
};

console.assert(typeof strategy === 'function', 'SkolemizeFunctionInterface is a function shape');
console.assert(
  strategy({
    'depth': 0,
    'path': '',
    'value': {}
  }) === 'https://shop.example.com/root',
  'root receives the fixed IRI'
);
console.assert(
  strategy({
    'depth': 1,
    'path': '/nested',
    'value': {}
  }) === undefined,
  'nested falls through to default'
);

console.log('root IRI from strategy:', strategy({
  'depth': 0,
  'path': '',
  'value': {}
}));
console.log('nested returns:', strategy({
  'depth': 1,
  'path': '/nested',
  'value': {}
}));
