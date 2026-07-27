/**
 * Compile-time assertions for the registry-derived type helpers.
 *
 * A `JsonTology` instance created via `JsonTology.create({ schemas })` carries
 * its references map as the `TRefs` type parameter, so `typeof jt` already
 * holds every registered schema keyed by `$id`. `RegisteredCanonicalType`,
 * `RegisteredMaterializedType`, and `RegisteredOutputType` read the resolved
 * type back out of that instance type — the consumer names a registered schema
 * by `$id` and cross-schema `$ref`s resolve against the registry's references,
 * with NO hand-rolled `SchemaReferencesMapType<typeof tuple>`.
 *
 * This file validates by compiling under `npm run type-check:tests`.
 */

import {
  JsonTology
} from '../../src/JsonTology.js';
import type {
  RegisteredCanonicalType,
  RegisteredMaterializedType,
  RegisteredOutputType,
  RegistryReferencesType
} from '../../src/types/RegisteredTypes.js';
import type { ReferenceNotFoundType } from '../../src/types/TypeErrors.js';

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Setup — two schemas, one cross-referencing the other by absolute IRI
// ---------------------------------------------------------------------------

const ChannelSchema = {
  '$id': 'urn:demo:Channel',
  'properties': { 'id': { 'type': 'string' } },
  'required': ['id'],
  'type': 'object'
} as const;

const MessageSchema = {
  '$id': 'urn:demo:Message',
  'properties': {
    'channel': { '$ref': 'urn:demo:Channel' },
    'priority': {
      'default': 0,
      'type': 'number'
    },
    'text': { 'type': 'string' }
  },
  'required': [
    'channel',
    'text'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIri': 'urn:demo:',
  'schemas': [
    ChannelSchema,
    MessageSchema
  ]
});

void jt;

// ---------------------------------------------------------------------------
// 1. RegistryReferencesType recovers the { [$id]: schema } map
// ---------------------------------------------------------------------------

type Refs = RegistryReferencesType<typeof jt>;

// The registered $ids are present as keys.
assert<AssertAssignable<'urn:demo:Channel' | 'urn:demo:Message', keyof Refs & string>>();

// ---------------------------------------------------------------------------
// 2. RegisteredCanonicalType — cross-schema $ref resolves via the registry,
// no references map passed by hand. `channel` is the Channel shape, NOT
// ReferenceNotFoundType.
// ---------------------------------------------------------------------------

type Message = RegisteredCanonicalType<typeof jt, 'urn:demo:Message'>;

assert<AssertAssignable<Message['channel'], { readonly 'id': string }>>();
assert<AssertAssignable<Message['text'], string>>();

// Negative: it must NOT be the unresolved brand the bare `CanonicalShapeType`
// (no references) would have produced.
assert<AssertAssignable<
  Message['channel'] extends ReferenceNotFoundType<string> ? false : true,
  true
>>();

// ---------------------------------------------------------------------------
// 3. RegisteredMaterializedType — required + defaulted fields non-optional.
// `priority` carries a default, so it is present (not optional) here.
// ---------------------------------------------------------------------------

type MaterializedMessage = RegisteredMaterializedType<typeof jt, 'urn:demo:Message'>;

assert<AssertAssignable<
  MaterializedMessage,
  { readonly 'channel': { readonly 'id': string };
    readonly 'priority': number;
    readonly 'text': string }
>>();

// ---------------------------------------------------------------------------
// 4. RegisteredOutputType — the instantiate()/parse() return shape, resolved.
// ---------------------------------------------------------------------------

type OutputMessage = RegisteredOutputType<typeof jt, 'urn:demo:Message'>;

assert<AssertAssignable<OutputMessage, { readonly 'text': string }>>();
