/**
 * Compile-time conflict: symmetric + asymmetric are mutually exclusive.
 *
 * ValidatePropertyCharacteristicsType brands the schema with
 * PropertyCharacteristicConflictType when a property declares both.
 * The @ts-expect-error directive proves the brand fires at the property
 * definition site.
 */

import type { ValidatePropertyCharacteristicsType } from '../../../src/types/TypeErrors.js';

// @ts-expect-error — 'relates' sets symmetric:true and asymmetric:true
//                     (PropertyCharacteristicConflictType)
const _bad: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad';
  readonly 'properties': {
    readonly 'relates': { readonly 'asymmetric': true;
      readonly 'symmetric': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad',
  'properties': {
    'relates': {
      'asymmetric': true,
      'symmetric': true
    }
  },
  'type': 'object'
} as const;

void _bad;

// The @ts-expect-error above confirms the brand fires at the definition site.
// At runtime the object is structurally valid; the conflict is a compile-time guarantee.
console.log('symmetric+asymmetric conflict detected at compile time (PropertyCharacteristicConflictType)');
