/**
 * GraphError constructor — the options-bag argument convention.
 *
 * `code` and `message` are required positionals; `pointer` and `cause`
 * travel in the trailing options bag. The code values come from the
 * exported `GraphErrorCode` map.
 */

import {
  GraphError, GraphErrorCode
} from '../../../src/index.js';

const pointer = '/orderLines/0';
const cause = new Error('referenced schema absent from registry');

const notFound = new GraphError(GraphErrorCode.POINTER_NOT_FOUND, 'pointer did not resolve', { 'pointer': '/foo/0' });
const refUnresolved = new GraphError(GraphErrorCode.REF_UNRESOLVED, 'cross-schema $ref unresolved', {
  cause,
  pointer
});

console.assert(notFound.code === 'POINTER_NOT_FOUND');
console.assert(notFound.pointer === '/foo/0');
console.assert(refUnresolved.cause === cause);

console.log('notFound.code:', notFound.code);
console.log('notFound.pointer:', notFound.pointer);
console.log('refUnresolved.cause.message:', refUnresolved.cause?.message);
