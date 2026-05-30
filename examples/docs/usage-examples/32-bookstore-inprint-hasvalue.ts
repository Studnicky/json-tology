/**
 * Bookstore taxonomy — InPrintBookSchema: hasValue on printStatus
 *
 * The canonical `InPrintBookSchema` pins `Book.printStatus` to the
 * literal `'inPrint'` via `Compose.hasValue`. The TBox emits an
 * anonymous `owl:Restriction` referenced from the class via
 * `rdfs:subClassOf`; this is a TBox semantic for reasoners, not a
 * structural validation rule. Editorial state (`printStatus`) is
 * orthogonal to inventory state (`inStock`).
 */

import {
  bookstoreEntities, InPrintBookSchema
} from '../bookstore/index.js';

const inPrint = {
  'authors': ['Cornelia Funke'],
  'inStock': true,
  'isbn': '9783791504650',
  'price': {
    'amount': 18.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'publishedOn': '2002-09-01',
  'stockLevel': 25,
  'title': 'Tintenherz'
};

const okErrs = bookstoreEntities.validate(InPrintBookSchema.$id, inPrint);

console.assert(okErrs.length === 0);

// The TBox carries an owl:Restriction with owl:hasValue 'inPrint' on
// https://bookstore.example/printStatus.
const owl = bookstoreEntities.ontology().jsonLdObject();
const graphNodes = owl['@graph'] as ReadonlyArray<Record<string, unknown>>;
const inPrintNode = graphNodes.find((node) => {
  return node['@id'] === InPrintBookSchema.$id;
});

console.assert(inPrintNode !== undefined);

const subClassOf = inPrintNode?.['http://www.w3.org/2000/01/rdf-schema#subClassOf'];
const subClassEntries = Array.isArray(subClassOf) ? subClassOf as ReadonlyArray<Record<string, unknown>> : [];
const hasValueRestriction = subClassEntries.find((entry) => {
  return entry['http://www.w3.org/2002/07/owl#hasValue'] === 'inPrint';
});

console.assert(hasValueRestriction !== undefined);
