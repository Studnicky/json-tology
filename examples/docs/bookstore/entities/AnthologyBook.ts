import { Compose } from '../../../../src/index.js';
import { AuthorNameSchema } from './AuthorName.js';
import { BookSchema } from './Book.js';

/**
 * AnthologyBook — a Book with two or more contributing authors, every one
 * of which is a named AuthorName. Demonstrates `Compose.minCardinality`
 * and `Compose.allValuesFrom` chained on the same property.
 *
 * The OWL TBox emits two anonymous `owl:Restriction` blank nodes referenced
 * via `rdfs:subClassOf` from urn:bookstore:AnthologyBook:
 *
 *   _:b1 a owl:Restriction ;
 *        owl:onProperty      urn:bookstore:Book#authors ;
 *        owl:minCardinality  "2"^^xsd:nonNegativeInteger .
 *
 *   _:b2 a owl:Restriction ;
 *        owl:onProperty     urn:bookstore:Book#authors ;
 *        owl:allValuesFrom  urn:bookstore:AuthorName .
 */

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

export const AnthologyBookSchema = Compose.subClassOf(
  Compose.minCardinality(AUTHORS_PROP, 2),
  Compose.subClassOf(
    Compose.allValuesFrom(AUTHORS_PROP, AuthorNameSchema.$id),
    Compose.subClassOf(BookSchema, {
      '$id': 'urn:bookstore:AnthologyBook',
      'type': 'object'
    } as const)
  )
);
