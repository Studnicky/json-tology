/**
 * Compile-time conflict: reflexive + irreflexive are mutually exclusive.
 *
 * An individual cannot both relate and not relate to itself.
 * ValidatePropertyCharacteristicsType surfaces the conflict at compile time.
 */

import type { ValidatePropertyCharacteristicsType } from '../../../src/types/TypeErrors.js';

// @ts-expect-error — 'rel' sets reflexive:true and irreflexive:true
//                     (PropertyCharacteristicConflictInterface)
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
