/**
 * Format → XSD datatype mapping in the TBox.
 *
 * Primitive schemas with a `format` hint emit an `rdfs:range` triple pointing
 * at the corresponding XSD datatype. PublicationDate (`format: 'date'`) maps
 * to `xsd:date`; Iso8601 (`format: 'date-time'`) maps to `xsd:dateTime`.
 *
 * Demonstrates: TBox JSON-LD carries XSD range assertions for date primitives.
 */

import {
  bookstoreEntities, Iso8601Schema, PublicationDateSchema
} from '../bookstore/index.js';

const tbox = bookstoreEntities.toTbox();
const jsonLd = tbox.jsonLd();

// Both bookstore date primitives must appear in the TBox
console.assert(
  jsonLd.includes(PublicationDateSchema.$id),
  'TBox includes PublicationDate class IRI'
);
console.assert(
  jsonLd.includes(Iso8601Schema.$id),
  'TBox includes Iso8601 class IRI'
);

// The XSD namespace must be referenced for date/dateTime range assertions
console.assert(
  jsonLd.includes('XMLSchema'),
  'TBox carries XSD namespace reference for date ranges'
);

console.log('XSD mapping: PublicationDate in TBox:', jsonLd.includes(PublicationDateSchema.$id), '| Iso8601 in TBox:', jsonLd.includes(Iso8601Schema.$id), '| XSD in TBox:', jsonLd.includes('XMLSchema'));
