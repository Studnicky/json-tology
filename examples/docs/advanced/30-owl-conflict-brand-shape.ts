/**
 * PropertyCharacteristicConflictType — brand shape.
 *
 * The brand interface carries the offending property name and the
 * conflicting characteristics as a tuple. IDE hover on the
 * failing assignment surfaces all three fields directly.
 */

import type { PropertyCharacteristicConflictType } from '../../../src/types/TypeErrors.js';

// Demonstrate the brand shape by typing a value that conforms to it.
const brand: PropertyCharacteristicConflictType<
  'relates',
  ['symmetric', 'asymmetric']
> = {
  'conflicts': [
    'symmetric',
    'asymmetric'
  ],
  'kind': 'PropertyCharacteristicConflict',
  'property': 'relates'
};

// Widen so the structural assertions are useful at runtime.
const widened: {
  'conflicts': readonly string[];
  'kind': string;
  'property': string;
} = brand;

console.assert(widened.kind === 'PropertyCharacteristicConflict', 'kind discriminator');
console.assert(widened.property === 'relates', 'property name surfaced');
console.assert(widened.conflicts.length === 2, 'conflicts tuple');

console.log('brand.kind:', widened.kind);
console.log('brand.property:', widened.property);
console.log('brand.conflicts:', widened.conflicts.join(', '));
