import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';

/**
 * InPrintBook — a Book whose `inStock` flag is fixed to `true` via OWL
 * `owl:hasValue`. Demonstrates `Compose.hasValue`.
 *
 * Wire shape: `{ $id, allOf: [{ $ref: Book }, body], 'jt:restrictions': [{ kind: 'hasValue', ... }] }`.
 *
 * The TBox emits an anonymous `owl:Restriction` referenced via `rdfs:subClassOf`:
 *   _:b1 a owl:Restriction ;
 *        owl:onProperty   urn:bookstore:Book#inStock ;
 *        owl:hasValue     "true"^^xsd:boolean .
 */

const IN_STOCK_PROP = 'urn:bookstore:Book#inStock';

export const InPrintBookSchema = Compose.subClassOf(
  Compose.hasValue(IN_STOCK_PROP, true),
  Compose.subClassOf(BookSchema, {
    '$id': 'urn:bookstore:InPrintBook',
    'type': 'object'
  } as const)
);
