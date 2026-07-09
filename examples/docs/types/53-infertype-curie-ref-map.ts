/**
 * InferType — Example: CURIE-keyed cross-schema $ref resolution.
 *
 * A hash-namespace `$id` (`https://ns#Class`) is the idiomatic OWL form, and
 * the recommended way to reference a sibling schema in that namespace is a
 * CURIE `$ref` (`'ns:Class'`) rather than the expanded IRI. When the `$ref`
 * is written as a CURIE, the reference map passed as InferType's second type
 * argument must be keyed by that exact CURIE string, not the expanded IRI —
 * the map key always matches the `$ref` string as authored.
 */

import type { InferType } from '../../../src/types/index.js';

const _BookGenreLabelSchema = {
  '$id': 'https://bookstore.example/ontology#BookGenreLabel',
  'type': 'string'
} as const;

const BookGenreSchema = {
  '$id': 'https://bookstore.example/ontology#BookGenre',
  'properties': { 'label': { '$ref': 'bk:BookGenreLabel' } },
  'required': ['label'],
  'type': 'object'
} as const;

// Reference map keyed by the CURIE exactly as written in $ref —
// 'bk:BookGenreLabel' — not 'https://bookstore.example/ontology#BookGenreLabel'.
type BookGenre = InferType<
  typeof BookGenreSchema,
  { 'bk:BookGenreLabel': typeof _BookGenreLabelSchema; }
>;

type AssertExtendsType<TLeft, TRight>
  = [TLeft] extends [TRight] ? true : false;

function assert<T extends true>(_proof?: T): void {
  return;
}

// The CURIE-keyed map resolved `label` to `string`, not RefNotFoundType.
assert<AssertExtendsType<BookGenre['label'], string>>();

console.log('BookGenreSchema $id:', BookGenreSchema.$id);
console.log('reference map key (CURIE):', 'bk:BookGenreLabel');
