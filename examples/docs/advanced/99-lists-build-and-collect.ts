/**
 * Lists.build / Lists.collect — RDF list emission and walking.
 *
 * RDF lists are encoded as the standard `rdf:first` / `rdf:rest` / `rdf:nil`
 * triple chain. There is no project-internal "list term" — the list head
 * (a BlankNode) appears in the parent triple's object position and the chain
 * materialises as additional quads.
 *
 * `Lists.build(items)` returns `{ head, triples }` so the caller can attach
 * `head` to the parent triple and concatenate `triples` into the output quad
 * array. `Lists.collect(head, allQuads)` walks the chain back into an item
 * array.
 */

import {
  Lists, Terms
} from '../../../src/index.js';

const SHAPE = 'https://example.com/Shape';
const SH_OR = 'http://www.w3.org/ns/shacl#or';

// Emit: ex:Shape sh:or ( ex:Circle ex:Square ) .
const {
  head, triples
} = Lists.build([
  Terms.iri('https://example.com/Circle'),
  Terms.iri('https://example.com/Square')
]);

const quads = [
  Terms.quad(Terms.iri(SHAPE), Terms.iri(SH_OR), head),
  ...triples
];

console.assert(quads.length === 5, 'parent quad + 2 rdf:first + 2 rdf:rest');
console.assert(head.termType === 'BlankNode', 'head is a blank node');

// Walk the list back into an item array.
const items = Lists.collect(head, quads);

console.assert(items.length === 2, 'walked two items');
const item0 = items[0];
const item1 = items[1];

if (item0 === undefined || item1 === undefined) {
  throw new Error('expected two walked items');
}

console.assert(item0.termType === 'NamedNode' && item0.value === 'https://example.com/Circle');
console.assert(item1.termType === 'NamedNode' && item1.value === 'https://example.com/Square');

console.log('list head:', head.value);
console.log('walked items:', items.map((item) => {
  return item.value;
}));
