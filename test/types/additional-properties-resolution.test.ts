/**
 * Compile-time assertions for schema-valued `additionalProperties` on an object
 * that declares NO `properties`. The value schema types the index signature, so
 * a primitive resolves, a `$ref` resolves through the graph, and a missing
 * `$ref` brands — rather than the whole object collapsing to
 * `Record<string, unknown>`.
 *
 * `additionalProperties: false` / absent stay open `Record<string, unknown>`
 * (unchanged). Validates by compiling under `npm run type-check:tests:all`.
 */

import type { InferType } from '../../src/types/Schema.js';
import type { AnchorNotFoundInterface } from '../../src/types/TypeErrors.js';

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

const Doc = {
  '$defs': {
    'Money': {
      'properties': { 'amt': { 'type': 'number' } },
      'required': ['amt'],
      'type': 'object'
    }
  },
  '$id': 'urn:ap:Doc',
  'properties': {
    'closed': {
      'additionalProperties': false,
      'type': 'object'
    },
    'mapMiss': {
      'additionalProperties': { '$ref': '#/$defs/Nope' },
      'type': 'object'
    },
    'mapNum': {
      'additionalProperties': { 'type': 'number' },
      'type': 'object'
    },
    'mapRef': {
      'additionalProperties': { '$ref': '#/$defs/Money' },
      'type': 'object'
    }
  },
  'required': [
    'closed',
    'mapMiss',
    'mapNum',
    'mapRef'
  ],
  'type': 'object'
} as const;

void Doc;

type R = InferType<typeof Doc>;

// Primitive value schema types the index signature.
assert<AssertAssignable<R['mapNum'], Readonly<Record<string, number>>>>();

// $ref value schema resolves through the graph.
assert<AssertAssignable<R['mapRef'], Readonly<Record<string, { readonly 'amt': number }>>>>();

// A missing $ref brands per-value — never a silent Record<string, unknown>.
assert<AssertAssignable<
  R['mapMiss'],
  Readonly<Record<string, AnchorNotFoundInterface<'#', '/$defs/Nope'>>>
>>();

// additionalProperties: false stays an open record (unchanged behavior).
assert<AssertAssignable<R['closed'], Record<string, unknown>>>();
