/**
 * Compile-time assertions that `Transform.create` resolves cross-schema `$ref`s
 * in its decode/encode canonical types through the global references registry —
 * the same auto-magic default as `CanonicalShapeType` / `InferType`. A transform
 * authored against registered schemas types decode's output and encode's input
 * as the resolved canonical shape, NOT `RefNotFoundType`.
 *
 * Validates by compiling under `npm run type-check:tests:all`.
 */

import { Transform } from '../../src/modules/transform/Transform.js';

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

const Inner = {
  '$id': 'urn:tr:Inner',
  'properties': { 'x': { 'type': 'string' } },
  'required': ['x'],
  'type': 'object'
} as const;

const Outer = {
  '$id': 'urn:tr:Outer',
  'properties': { 'inner': { '$ref': 'urn:tr:Inner' } },
  'required': ['inner'],
  'type': 'object'
} as const;

void Inner;
void Outer;

declare module '../../src/interfaces/JsonTologyReferencesInterface.js' {
  interface JsonTologyReferencesInterface {
    readonly 'urn:tr:Inner': typeof Inner;
    readonly 'urn:tr:Outer': typeof Outer;
  }
}

// decode's return type is the RESOLVED canonical shape (inner → { x: string }),
// so this object literal type-checks. If the ref degraded to RefNotFound, the
// literal `{ inner: { x: 'a' } }` would be rejected.
const codec = Transform.create(Outer, {
  'decode': (_raw: { 'w': string }) => {
    return { 'inner': { 'x': 'a' } };
  },
  // encode's parameter carries the resolved canonical shape too.
  'encode': (value) => {
    assert<AssertAssignable<typeof value, { readonly 'inner': { readonly 'x': string } }>>();

    return { 'w': value.inner.x };
  }
});

void codec;
