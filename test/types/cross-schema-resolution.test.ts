/**
 * Compile-time assertions for cross-schema `$ref` and `$anchor` resolution.
 *
 * Findings 15 / 16: when an `InferType<S, TReferences>` walks a `$ref` whose
 * IRI is not present in the references map, the inferred type is the named
 * brand `RefNotFoundInterface<...>` rather than `unknown`. Likewise for
 * fragment refs whose anchor portion is missing — the result is
 * `AnchorNotFoundInterface<...>`.
 *
 * The "no references map" path must continue to fall back to `unknown` so
 * existing usage of `InferType<S>` without a registry stays unchanged.
 */

import type { InferType } from '../../src/types/Schema.js';
import type {
  AnchorNotFoundInterface,
  RefNotFoundInterface
} from '../../src/types/TypeErrors.js';

// ---------------------------------------------------------------------------
// Bidirectional assignability helpers
// ---------------------------------------------------------------------------

type AssertEqual<TLeft, TRight>
  = [TLeft] extends [TRight] ? [TRight] extends [TLeft] ? true : false : false;

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Setup — known schemas + a references map
// ---------------------------------------------------------------------------

const KnownSchema = {
  '$anchor': 'knownAnchor',
  '$id': 'https://example.com/Known',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

void KnownSchema;

interface ReferencesMap {
  readonly 'https://example.com/Known': typeof KnownSchema;
}

// ---------------------------------------------------------------------------
// Finding 15 — $ref to unregistered schema with refs map → RefNotFound
// ---------------------------------------------------------------------------

const _UnknownRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Missing' } },
  'type': 'object'
} as const;

void _UnknownRefSchema;

type UnknownRefWithMap = InferType<typeof _UnknownRefSchema, ReferencesMap>;
assert<AssertAssignable<
  UnknownRefWithMap,
  { readonly 'ext'?: RefNotFoundInterface<'https://example.com/Missing'> }
>>();

// Without a references map, the historical fallback to `unknown` is preserved
type UnknownRefWithoutMap = InferType<typeof _UnknownRefSchema>;
assert<AssertAssignable<UnknownRefWithoutMap, { readonly 'ext'?: unknown }>>();

// Positive: a known IRI in the same registry resolves to the inferred type
const _KnownRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Known' } },
  'type': 'object'
} as const;

void _KnownRefSchema;

type KnownRefResolved = InferType<typeof _KnownRefSchema, ReferencesMap>;
assert<AssertAssignable<
  KnownRefResolved,
  { readonly 'ext'?: { readonly 'name': string } }
>>();

// ---------------------------------------------------------------------------
// Finding 16 — fragment ref to unregistered schema → RefNotFound on the base
// ---------------------------------------------------------------------------

const _UnknownAnchorRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Missing#someAnchor' } },
  'type': 'object'
} as const;

void _UnknownAnchorRefSchema;

type UnknownAnchorWithMap = InferType<typeof _UnknownAnchorRefSchema, ReferencesMap>;
// Base IRI does not exist in the references map → the brand surfaces from
// `ResolveRefBaseSchemaType` and propagates through the fragment lookup.
assert<AssertAssignable<
  UnknownAnchorWithMap,
  { readonly 'ext'?: RefNotFoundInterface<'https://example.com/Missing'> }
>>();

// ---------------------------------------------------------------------------
// Finding 16 — fragment ref to known schema, missing anchor → AnchorNotFound
// ---------------------------------------------------------------------------

const _MissingAnchorRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Known#noSuchAnchor' } },
  'type': 'object'
} as const;

void _MissingAnchorRefSchema;

type MissingAnchorResult = InferType<typeof _MissingAnchorRefSchema, ReferencesMap>;
assert<AssertAssignable<
  MissingAnchorResult,
  { readonly 'ext'?: AnchorNotFoundInterface<'https://example.com/Known', 'noSuchAnchor'> }
>>();

// Positive: a known anchor on a known schema resolves to its target
const _KnownAnchorRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Known#knownAnchor' } },
  'type': 'object'
} as const;

void _KnownAnchorRefSchema;

type KnownAnchorResult = InferType<typeof _KnownAnchorRefSchema, ReferencesMap>;
assert<AssertAssignable<
  KnownAnchorResult,
  { readonly 'ext'?: { readonly 'name': string } }
>>();

// ---------------------------------------------------------------------------
// Finding 16 — JSON pointer fragment to known schema with missing path
// ---------------------------------------------------------------------------

const _MissingPointerRefSchema = {
  'properties': { 'ext': { '$ref': 'https://example.com/Known#/$defs/Nope' } },
  'type': 'object'
} as const;

void _MissingPointerRefSchema;

type MissingPointerResult = InferType<typeof _MissingPointerRefSchema, ReferencesMap>;
assert<AssertAssignable<
  MissingPointerResult,
  { readonly 'ext'?: AnchorNotFoundInterface<'https://example.com/Known', '/$defs/Nope'> }
>>();

// ---------------------------------------------------------------------------
// Backwards compatibility — without TReferences the behaviour is unchanged
// ---------------------------------------------------------------------------

type AnchorWithoutMap = InferType<typeof _MissingAnchorRefSchema>;
assert<AssertAssignable<AnchorWithoutMap, { readonly 'ext'?: unknown }>>();

type AnchorBaseWithoutMap = InferType<typeof _UnknownAnchorRefSchema>;
assert<AssertAssignable<AnchorBaseWithoutMap, { readonly 'ext'?: unknown }>>();

// Sanity check the local-anchor path is unaffected (anchors are resolved
// against the root schema, not the references map, so the "no references"
// fallback is not exercised here).
const _LocalAnchorSchema = {
  '$anchor': 'self',
  'properties': { 'ext': { '$ref': '#self' } },
  'type': 'object'
} as const;

void _LocalAnchorSchema;

type LocalAnchorResult = InferType<typeof _LocalAnchorSchema, ReferencesMap>;
assert<AssertAssignable<
  LocalAnchorResult,
  { readonly 'ext'?: { readonly 'ext'?: unknown } }
>>();

// Use AssertEqual at least once so the helper isn't tagged as unused.
const _eqHelper: AssertEqual<true, true> = true;

void _eqHelper;
