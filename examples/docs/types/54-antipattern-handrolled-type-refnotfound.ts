/**
 * Anti-pattern: hand-rolling a type when InferType shows RefNotFoundType.
 *
 * Without a reference map, a cross-schema $ref that InferType cannot resolve
 * infers to RefNotFoundType<'...'> — `{ kind: 'RefNotFound'; unresolvedRef:
 * '...' }` — a deliberate compile-error brand, not a silent `unknown`.
 * Reading that shape as "inference degrades" and hand-rolling a replacement
 * type defeats InferType: the hand-rolled type silently drifts from the
 * schema the moment a property is added or renamed. The fix is to thread
 * the reference map, not to hand-roll a type.
 */

import type { InferType } from '../../../src/types/index.js';

const _BookGenreLabelSchema = {
  '$id': 'https://bookstore.example/ontology#BookGenreLabel',
  'type': 'string'
} as const;

const _BookGenreSchema = {
  '$id': 'https://bookstore.example/ontology#BookGenre',
  'properties': { 'label': { '$ref': 'bk:BookGenreLabel' } },
  'required': ['label'],
  'type': 'object'
} as const;

type AssertExtendsType<TLeft, TRight>
  = [TLeft] extends [TRight] ? true : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

// ⊥ Without the reference map, `label` is RefNotFoundType<'bk:BookGenreLabel'>
// — { kind: 'RefNotFound'; unresolvedRef: 'bk:BookGenreLabel' }.
type UnresolvedLabel = InferType<typeof _BookGenreSchema>['label'];

assert<AssertExtendsType<
  UnresolvedLabel,
  { readonly 'kind': 'RefNotFound';
    readonly 'unresolvedRef': 'bk:BookGenreLabel'; }
>>();

// ⊥ Don't do this — hand-rolling a replacement type because the $ref "looks
// broken" defeats InferType and drifts from BookGenreSchema silently.
type BookGenreHandRolled = {
  // hand-rolled — comment claims "cross-file inference degrades to unknown"
  'label': string;
};

// ✓ Do this — thread the reference map, keyed by the $ref string as written.
type BookGenre = InferType<
  typeof _BookGenreSchema,
  { 'bk:BookGenreLabel': typeof _BookGenreLabelSchema; }
>;

const handRolled: BookGenreHandRolled = { 'label': 'Fantasy' };
const derived: BookGenre = { 'label': 'Fantasy' };

console.assert(handRolled.label === derived.label);
console.log('Unresolved $ref shape (RefNotFoundType): kind + unresolvedRef fields.');
console.log('Recommended: InferType + reference map, not a hand-rolled type.');
