/**
 * Bookstore taxonomy — OutOfPrintBookSchema as Compose.complementOf
 *
 * The canonical `OutOfPrintBookSchema` is the OWL complement of
 * `InPrintBookSchema`, bounded to the Book universe via
 * `allOf: [{ $ref: BookSchema }]`. Without that bound, OWL's
 * open-world semantics would match anything that is not an
 * `InPrintBook` — including customers and orders.
 */

import {
  bookstoreEntities, OutOfPrintBookSchema
} from '../bookstore/index.js';

// The TBox carries `owl:complementOf` pointing at InPrintBook.
// Verify the projection emits the expected complement edge.
const owl = bookstoreEntities.ontology().jsonLdObject();
const graphNodes = owl['@graph'] as ReadonlyArray<Record<string, unknown>>;
const outNode = graphNodes.find((node) => {
  return node['@id'] === OutOfPrintBookSchema.$id;
});

console.assert(outNode !== undefined);

const OWL_COMPLEMENT_OF = 'http://www.w3.org/2002/07/owl#complementOf';
const complementOf = outNode?.[OWL_COMPLEMENT_OF] as undefined | { readonly '@id': string };

console.assert(complementOf !== undefined);
console.assert(complementOf['@id'] === 'urn:bookstore:InPrintBook');
