/**
 * Compile-time assertions for SAME-DOCUMENT `$ref` resolution — local `$defs`
 * keys, named `$anchor`s, and JSON Pointers — proving they resolve when present
 * and fail UNIFORMLY when absent.
 *
 * A reference the document does not reach resolves to `AnchorNotFoundType`
 * (base `'#'` for same-document fragments), consistent with cross-schema misses
 * yielding `ReferenceNotFoundType`. No local miss degrades to a silent `unknown`.
 *
 * Validates by compiling under `npm run type-check:tests`.
 */

import type { InferType } from '../../src/types/Schema.js';
import type { AnchorNotFoundType } from '../../src/types/TypeErrors.js';

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

const LocalSchema = {
  '$defs': {
    'Money': {
      '$anchor': 'moneyAnchor',
      'properties': { 'amount': { 'type': 'number' } },
      'required': ['amount'],
      'type': 'object'
    }
  },
  '$id': 'urn:local:Doc',
  'properties': {
    'label': { 'type': 'string' },
    'missingAnchor': { '$ref': '#noSuchAnchor' },
    'missingComplex': { '$ref': '#/$defs/Money/properties/nope' },
    'missingDef': { '$ref': '#/$defs/Nope' },
    'missingPointer': { '$ref': '#/properties/nope' },
    'priceComplex': { '$ref': '#/$defs/Money/properties/amount' },
    'priceDef': { '$ref': '#/$defs/Money' },
    'viaAnchor': { '$ref': '#moneyAnchor' },
    'viaPointer': { '$ref': '#/properties/label' }
  },
  // Every asserted property is required so the resolved type carries no
  // `| undefined` from optionality — the assertions inspect the ref result
  // itself, not its presence modifier.
  'required': [
    'missingAnchor',
    'missingComplex',
    'missingDef',
    'missingPointer',
    'priceComplex',
    'priceDef',
    'viaAnchor',
    'viaPointer'
  ],
  'type': 'object'
} as const;

void LocalSchema;

type Doc = InferType<typeof LocalSchema>;

// --- Present references resolve to their target shapes ---
assert<AssertAssignable<Doc['priceDef'], { readonly 'amount': number }>>();
assert<AssertAssignable<Doc['viaAnchor'], { readonly 'amount': number }>>();
assert<AssertAssignable<Doc['viaPointer'], string>>();
assert<AssertAssignable<Doc['priceComplex'], number>>();

// --- Absent references fail uniformly as AnchorNotFoundType, not unknown ---
assert<AssertAssignable<
  Doc['missingDef'],
  AnchorNotFoundType<'#', '/$defs/Nope'>
>>();
assert<AssertAssignable<
  Doc['missingAnchor'],
  AnchorNotFoundType<'#', 'noSuchAnchor'>
>>();
assert<AssertAssignable<
  Doc['missingPointer'],
  AnchorNotFoundType<'#', '/properties/nope'>
>>();
assert<AssertAssignable<
  Doc['missingComplex'],
  AnchorNotFoundType<'#', '/$defs/Money/properties/nope'>
>>();

// --- Negative: a miss must NOT be a silent unknown ---
assert<AssertAssignable<
  unknown extends Doc['missingDef'] ? false : true,
  true
>>();
