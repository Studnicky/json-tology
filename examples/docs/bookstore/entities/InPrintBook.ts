import { Compose } from '../../../../src/index.js';
import { BookSchema } from './Book.js';

/**
 * InPrintBook — a Book whose `printStatus` field is fixed to `'inPrint'`
 * via OWL `owl:hasValue`. Discriminates on publisher state, not inventory
 * state (`inStock`). Demonstrates `Compose.hasValue`.
 *
 * Wire shape: `{ $id, allOf: [{ $ref: Book }, body], 'jt:restrictions': [{ kind: 'hasValue', ... }] }`.
 *
 * The TBox emits an anonymous `owl:Restriction` referenced via `rdfs:subClassOf`:
 *   _:b1 a owl:Restriction ;
 *        owl:onProperty   urn:bookstore:Book#printStatus ;
 *        owl:hasValue     "inPrint" .
 */

const PRINT_STATUS_PROP = 'urn:bookstore:Book#printStatus';

export const InPrintBookSchema = Compose.subClassOf(
  Compose.hasValue(PRINT_STATUS_PROP, 'inPrint'),
  Compose.subClassOf(BookSchema, {
    '$id': 'urn:bookstore:InPrintBook',
    'type': 'object'
  } as const)
);
