/**
 * BaseError constructor — the standard Error(message, options) convention.
 *
 * `message` is the required positional. `code` and all optional fields
 * (`cause`, `retryable`) travel in the required options bag.
 * `retryable` defaults to `false` when omitted from options.
 */

import { BaseError } from '../../../src/index.js';

const ioFailure = new Error('socket closed');

const bare = new BaseError('human description', { 'code': 'SOMETHING_FAILED' });
const retryable = new BaseError('human description', {
  'code': 'SOMETHING_FAILED',
  'retryable': true
});
const chained = new BaseError('human description', {
  'cause': ioFailure,
  'code': 'SOMETHING_FAILED',
  'retryable': true
});

console.assert(!bare.retryable);
console.assert(retryable.retryable);
console.assert(chained.cause === ioFailure);

console.log('bare.retryable:', bare.retryable);
console.log('retryable.retryable:', retryable.retryable);
console.log('chained.code:', chained.code);
console.log('chained.cause.message:', (chained.cause as Error).message);
