/**
 * Resolver: override a single flag for one call
 *
 * Resolver.merge allows per-call option overrides without mutating the base
 * options object or constructing a full options object each time.
 */

import { Resolver } from '../../../src/index.js';

const defaultOpts = {
  'enableDefaults': true,
  'enableThrow': false,
  'enableValidation': true
};

// Per-call: turn off defaults for one strict parse
const strictOpts = Resolver.merge(defaultOpts, { 'enableDefaults': false });

console.assert(!strictOpts.enableDefaults, 'defaults disabled');
console.assert(strictOpts.enableValidation, 'validation enabled');
console.assert(!strictOpts.enableThrow, 'throw disabled');

// undefined does not erase base values
const sameAsDefault = Resolver.merge(defaultOpts, { 'enableDefaults': undefined });

console.assert(sameAsDefault.enableDefaults, 'base value used when override is undefined');
