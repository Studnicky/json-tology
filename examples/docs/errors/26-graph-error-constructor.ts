/**
 * GraphError constructor — the standard Error(message, options) convention.
 *
 * `message` is the required positional. `code`, `pointer`, and `cause`
 * travel in the required options bag. The code values come from the
 * exported `GRAPH_ERROR_CODE` map.
 */

import {
  GRAPH_ERROR_CODE, GraphError
} from '../../../src/index.js';

const pointer = '/orderLines/0';
const cause = new Error('referenced schema absent from registry');

const notFound = new GraphError('pointer did not resolve', {
  'code': GRAPH_ERROR_CODE.POINTER_NOT_FOUND,
  'pointer': '/foo/0'
});
const refUnresolved = new GraphError('cross-schema $ref unresolved', {
  cause,
  'code': GRAPH_ERROR_CODE.REF_UNRESOLVED,
  pointer
});

console.assert(notFound.code === 'POINTER_NOT_FOUND');
console.assert(notFound.pointer === '/foo/0');
console.assert(refUnresolved.cause === cause);

console.log('notFound.code:', notFound.code);
console.log('notFound.pointer:', notFound.pointer);
console.log('refUnresolved.cause.message:', refUnresolved.cause?.message);
