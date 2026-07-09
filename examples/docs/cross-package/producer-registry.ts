/**
 * Cross-package typing — the "producer" side.
 *
 * Stands in for a package that owns and registers a hash-namespace schema
 * (`$id: 'https://ns#Class'`) — the idiomatic OWL form. `BookGenreSchema`
 * references its sibling primitive `BookGenreLabelSchema` with a CURIE
 * `$ref` (`'bk:BookGenreLabel'`), the recommended pattern for referencing a
 * schema within the same hash namespace. `enableStrictGraph` is on by
 * default (see /advanced/strict-graph-mode) and is satisfied here because
 * `label` is a `$ref` to a registered schema, not an inline constrained
 * shape.
 *
 * A consumer package imports `genreEntities` (the registry instance) to
 * call `instantiate`, and imports the schema consts as types to build a
 * local `InferType` reference map — see
 * `examples/docs/cross-package/consumer-typed-instantiate.ts`.
 */

import { JsonTology } from '../../../src/index.js';

export const BookGenreLabelSchema = {
  '$id': 'https://bookstore.example/ontology#BookGenreLabel',
  'type': 'string'
} as const;

export const BookGenreSchema = {
  '$id': 'https://bookstore.example/ontology#BookGenre',
  'properties': { 'label': { '$ref': 'bk:BookGenreLabel' } },
  'required': ['label'],
  'type': 'object'
} as const;

export const genreEntities = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'prefixes': { 'bk': 'https://bookstore.example/ontology#' },
  'schemas': [
    BookGenreLabelSchema,
    BookGenreSchema
  ]
});
