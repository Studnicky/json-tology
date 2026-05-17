/**
 * Bridging json-tology TBox output to an n3 Store
 *
 * The canonical bookstore TBox is emitted as JSON-LD by
 * `bookstoreEntities.toTbox().jsonLd()`. The n3 library parses
 * Turtle / N-Quads, not JSON-LD directly, so this example uses the
 * higher-level structural output: every TBox node carries `@id` and
 * `@type`. A consumer that wants to feed n3.Store can either:
 *   1. Convert JSON-LD to N-Quads first (e.g. via the `jsonld` library), or
 *   2. Iterate the structural output and call `DataFactory` directly.
 *
 * This example demonstrates option 2 — extract `(@id, rdf:type,
 * objectClass)` triples directly from the structured TBox.
 */

import {
  DataFactory, Store
} from 'n3';
import { bookstoreEntities } from '../bookstore/index.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const tbox = bookstoreEntities.toTbox().raw();
const store = new Store();

for (const node of tbox) {
  const id = node['@id'];
  const type = node['@type'];

  if (typeof id !== 'string' || typeof type !== 'string') {
    continue;
  }
  store.addQuad(
    DataFactory.namedNode(id),
    DataFactory.namedNode(RDF_TYPE),
    DataFactory.namedNode(type)
  );
}

const owlClasses = store.getQuads(
  null,
  DataFactory.namedNode(RDF_TYPE),
  DataFactory.namedNode('http://www.w3.org/2002/07/owl#Class'),
  null
);

console.assert(owlClasses.length > 0);
