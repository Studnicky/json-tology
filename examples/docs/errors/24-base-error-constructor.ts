/**
 * BaseError constructor — the options-bag argument convention.
 *
 * `code` and `message` are required positionals. Everything optional
 * (`cause`, `retryable`) travels in a single trailing options bag.
 * `retryable` defaults to `false` when the bag is omitted.
 */

import { BaseError } from '../../../src/index.js';

const ioFailure = new Error('socket closed');

const bare = new BaseError('SOMETHING_FAILED', 'human description');
const retryable = new BaseError('SOMETHING_FAILED', 'human description', { 'retryable': true });
const chained = new BaseError('SOMETHING_FAILED', 'human description', {
  'cause': ioFailure,
  'retryable': true
});

console.assert(!bare.retryable);
console.assert(retryable.retryable);
console.assert(chained.cause === ioFailure);

console.log('bare.retryable:', bare.retryable);
console.log('retryable.retryable:', retryable.retryable);
console.log('chained.code:', chained.code);
console.log('chained.cause.message:', (chained.cause as Error).message);
