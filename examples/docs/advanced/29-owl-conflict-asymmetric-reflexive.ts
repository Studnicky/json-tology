/**
 * Compile-time conflict: asymmetric + reflexive.
 *
 * Asymmetric implies irreflexive in OWL 2; an explicit reflexive
 * directly contradicts that. The brand surfaces both characteristics
 * in its `conflicts` tuple.
 */

import type { ValidatePropertyCharacteristicsType } from '../../../src/types/TypeErrors.js';

// @ts-expect-error — 'edge' sets asymmetric:true and reflexive:true
//                     (PropertyCharacteristicConflictType)
const _bad: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad';
  readonly 'properties': {
    readonly 'edge': { readonly 'asymmetric': true;
      readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad',
  'properties': {
    'edge': {
      'asymmetric': true,
      'reflexive': true
    }
  },
  'type': 'object'
} as const;

void _bad;

// The @ts-expect-error above confirms the brand fires at the definition site.
// At runtime the object is structurally valid; the conflict is a compile-time guarantee.
console.log('asymmetric+reflexive conflict detected at compile time (PropertyCharacteristicConflictType)');
