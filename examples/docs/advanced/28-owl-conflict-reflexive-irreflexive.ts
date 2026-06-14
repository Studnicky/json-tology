/**
 * Compile-time conflict: reflexive + irreflexive are mutually exclusive.
 *
 * An individual cannot both relate and not relate to itself.
 * ValidatePropertyCharacteristicsType surfaces the conflict at compile time.
 */

import type { ValidatePropertyCharacteristicsType } from '../../../src/types/TypeErrors.js';

// @ts-expect-error — 'rel' sets reflexive:true and irreflexive:true
//                     (PropertyCharacteristicConflictType)
const _bad: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad';
  readonly 'properties': {
    readonly 'rel': { readonly 'irreflexive': true;
      readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad',
  'properties': {
    'rel': {
      'irreflexive': true,
      'reflexive': true
    }
  },
  'type': 'object'
} as const;

void _bad;

// The @ts-expect-error above confirms the brand fires at the definition site.
// At runtime the object is structurally valid; the conflict is a compile-time guarantee.
console.log('reflexive+irreflexive conflict detected at compile time (PropertyCharacteristicConflictType)');
