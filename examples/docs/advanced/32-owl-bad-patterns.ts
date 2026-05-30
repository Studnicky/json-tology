/**
 * Bad patterns — three OWL 2 property-characteristic combinations that
 * are mutually exclusive. Each one is flagged at compile time by
 * ValidatePropertyCharacteristicsType so the offending property is
 * surfaced in IDE hover.
 *
 * These are NOT registered with the bookstore graph — they would be
 * rejected at SchemaRegistry.set() with code PROPERTY_CHARACTERISTIC_CONFLICT.
 */

import type { ValidatePropertyCharacteristicsType } from '../../../src/types/TypeErrors.js';

// Bad 1 — symmetric + asymmetric are mutually exclusive.
// @ts-expect-error — PropertyCharacteristicConflictInterface<'relates', ['symmetric', 'asymmetric']>
const _bad1: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad1';
  readonly 'properties': {
    readonly 'relates': { readonly 'asymmetric': true;
      readonly 'symmetric': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad1',
  'properties': {
    'relates': {
      'asymmetric': true,
      'symmetric': true
    }
  },
  'type': 'object'
} as const;

// Bad 2 — reflexive + irreflexive are mutually exclusive.
// @ts-expect-error — PropertyCharacteristicConflictInterface<'rel', ['reflexive', 'irreflexive']>
const _bad2: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad2';
  readonly 'properties': {
    readonly 'rel': { readonly 'irreflexive': true;
      readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad2',
  'properties': {
    'rel': {
      'irreflexive': true,
      'reflexive': true
    }
  },
  'type': 'object'
} as const;

// Bad 3 — asymmetric implies irreflexive; explicit reflexive contradicts it.
// @ts-expect-error — PropertyCharacteristicConflictInterface<'edge', ['asymmetric', 'reflexive']>
const _bad3: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad3';
  readonly 'properties': {
    readonly 'edge': { readonly 'asymmetric': true;
      readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad3',
  'properties': {
    'edge': {
      'asymmetric': true,
      'reflexive': true
    }
  },
  'type': 'object'
} as const;

void _bad1;
void _bad2;
void _bad3;

// Each @ts-expect-error above confirms the conflict brand fires at the definition site.
// All three pairs are OWL 2 logical impossibilities detected at compile time.
console.log('bad patterns: symmetric+asymmetric, reflexive+irreflexive, asymmetric+reflexive all rejected at compile time');
