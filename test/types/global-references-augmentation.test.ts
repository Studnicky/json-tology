/**
 * Compile-time assertions for the global, consumer-augmentable references
 * registry (`JsonTologyReferencesInterface`).
 *
 * After a consumer registers schemas by `$id` via declaration merging, a
 * STANDALONE `CanonicalShapeType<typeof Schema>` / `InferType<typeof Schema>`
 * — no references argument, no `JsonTology` instance — resolves cross-schema
 * `$ref`s automatically against the augmented map. This is the auto-magic layer:
 * the consumer registers once, every standalone type resolves.
 *
 * The augmentation here targets the defining module by its source path, the
 * same in-repo pattern `string-length.test.ts` uses for
 * `JsonTologyTypeConfigInterface`. Published consumers augment
 * `declare module 'json-tology/types'` instead (the named re-export merges into
 * the same canonical declaration).
 *
 * Validates by compiling under `npm run type-check:tests`.
 */

import type {
  CanonicalShapeType, InferType
} from '../../src/types/index.js';
import type { RefNotFoundType } from '../../src/types/TypeErrors.js';

type AssertAssignable<TSource, TTarget>
  = [TSource] extends [TTarget] ? true : false;

function assert<T extends true>(): void {
  void 0 as unknown as T;
}

// ---------------------------------------------------------------------------
// Consumer schemas — one cross-references the other by absolute IRI
// ---------------------------------------------------------------------------

const ChannelSchema = {
  '$id': 'urn:aug:Channel',
  'properties': { 'id': { 'type': 'string' } },
  'required': ['id'],
  'type': 'object'
} as const;

void ChannelSchema;

const ChatMessageSchema = {
  '$id': 'urn:aug:ChatMessage',
  'properties': {
    'channel': { '$ref': 'urn:aug:Channel' },
    'text': { 'type': 'string' }
  },
  'required': [
    'channel',
    'text'
  ],
  'type': 'object'
} as const;

void ChatMessageSchema;

// ---------------------------------------------------------------------------
// Register the schemas in the global references map (declaration merging).
// ---------------------------------------------------------------------------

declare module '../../src/interfaces/JsonTologyReferencesInterface.js' {
  interface JsonTologyReferencesInterface {
    readonly 'urn:aug:Channel': typeof ChannelSchema;
    readonly 'urn:aug:ChatMessage': typeof ChatMessageSchema;
  }
}

// ---------------------------------------------------------------------------
// Auto-magic: bare CanonicalShapeType (NO references arg) resolves the $ref.
// ---------------------------------------------------------------------------

type ChatMessage = CanonicalShapeType<typeof ChatMessageSchema>;

assert<AssertAssignable<ChatMessage['channel'], { readonly 'id': string }>>();
assert<AssertAssignable<ChatMessage['text'], string>>();

// Negative: it must NOT be the unresolved brand that an unregistered $ref
// would produce.
assert<AssertAssignable<
  ChatMessage['channel'] extends RefNotFoundType<string> ? false : true,
  true
>>();

// Bare InferType (the wire-shape entry point) resolves identically.
type ChatMessageWire = InferType<typeof ChatMessageSchema>;

assert<AssertAssignable<ChatMessageWire['channel'], { readonly 'id': string }>>();
