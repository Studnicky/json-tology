import { Compose } from '../../../../src/index.js';
import { AuthorNameSchema } from './AuthorName.js';
import { PrintBookSchema } from './PrintBook.js';

/**
 * RareBook — a PrintBook subclass with OWL property restrictions attached.
 *
 * Demonstrates `Compose.subClassOf` chained with restriction descriptors:
 *
 *   - `Compose.maxCardinality(authors, 1)`   — a rare book is authored by at
 *     most one person (the OWL semantic; JSON Schema's `minItems: 1` from the
 *     parent still requires at least one).
 *   - `Compose.someValuesFrom(authors, AuthorName)` — at least one value of
 *     `authors` is an instance of AuthorName (a tautology here, included to
 *     show the wiring in the TBox projection).
 *
 * The TBox emits two anonymous `owl:Restriction` blank nodes referenced from
 * `urn:bookstore:RareBook` via `rdfs:subClassOf`.
 *
 * All properties reference named primitives (strict-graph compliant):
 *   - estimatedAgeYears → EstimatedAgeYears (non-negative integer)
 *   - firstEditionYear  → FirstEditionYear (1450–2100 integer)
 */

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

export const RareBookSchema = Compose.subClassOf(
  Compose.maxCardinality(AUTHORS_PROP, 1),
  Compose.subClassOf(
    Compose.someValuesFrom(AUTHORS_PROP, AuthorNameSchema.$id),
    Compose.subClassOf(PrintBookSchema, {
      '$id': 'urn:bookstore:RareBook',
      'properties': {
        'estimatedAgeYears': { '$ref': 'urn:bookstore:EstimatedAgeYears' },
        'firstEditionYear': { '$ref': 'urn:bookstore:FirstEditionYear' }
      },
      'required': ['firstEditionYear'],
      'type': 'object'
    } as const)
  )
);
