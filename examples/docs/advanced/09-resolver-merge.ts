/**
 * Resolver: merge per-call options without mutating base
 *
 * Resolver.merge implements safe per-call option merging where undefined
 * values in the override do not erase base values.
 */

import { Resolver } from '../../../src/index.js';

const base = {
  'enableDefaults': true,
  'enableValidation': true
};
const merged = Resolver.merge(base, { 'enableDefaults': false });

console.assert(!merged.enableDefaults, 'override takes precedence');
console.assert(merged.enableValidation, 'base value preserved');

const sameAsBase = Resolver.merge(base, {});

console.assert(sameAsBase.enableDefaults, 'undefined does not erase');

console.log('Resolver.merge — override wins:', merged.enableDefaults, '(was true, overridden to false)');
console.log('Resolver.merge — base preserved:', merged.enableValidation);
console.log('Resolver.merge — undefined does not erase:', sameAsBase.enableDefaults);
