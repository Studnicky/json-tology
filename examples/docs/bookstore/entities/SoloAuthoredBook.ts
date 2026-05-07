import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';

/**
 * SoloAuthoredBook — a Book with exactly one author. Demonstrates
 * `Compose.cardinality(prop, n)`.
 *
 * The OWL TBox emits:
 *   _:b1 a owl:Restriction ;
 *        owl:onProperty   urn:bookstore:Book#authors ;
 *        owl:cardinality  "1"^^xsd:nonNegativeInteger .
 */

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

export const SoloAuthoredBookSchema = Compose.subClassOf(
  Compose.cardinality(AUTHORS_PROP, 1),
  Compose.subClassOf(BookSchema, {
    '$id': 'urn:bookstore:SoloAuthoredBook',
    'type': 'object'
  } as const)
);
