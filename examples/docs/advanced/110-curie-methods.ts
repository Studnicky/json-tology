/**
 * Advanced Example 110 — toCurie / fromCurie round-trip
 *
 * `toCurie(iri)` compacts a full IRI to its CURIE form using the registry's
 * merged prefix map (STANDARD_PREFIXES + any custom prefixes). When no prefix
 * matches, the input is returned unchanged.
 *
 * `fromCurie(value)` is the inverse: it expands a CURIE such as `ex:Customer`
 * to its full IRI. Non-CURIE strings (no matching prefix, no colon, absolute
 * IRIs whose scheme is not a registered prefix) pass through unchanged.
 *
 * Both methods share the same prefix map built at construction time from
 * `STANDARD_PREFIXES` merged with any `prefixes` option passed to `create()`.
 */

import { JsonTology } from '../../../src/index.js';
import { STANDARD_PREFIXES } from '../../../src/constants/STANDARD_PREFIXES.js';

// A small schema so the registry has something registered.
const AuthorSchema = {
  '$id': 'https://bookstore.example/Author',
  'properties': { 'name': { 'type': 'string' } },
  'required': ['name'],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'prefixes': { 'bk': 'https://bookstore.example/' },
  'schemas': [AuthorSchema] as const
});

// ── toCurie — compact full IRIs ───────────────────────────────────────────

// Standard RDFS prefix is built-in via STANDARD_PREFIXES.
const rdfsLabel = `${STANDARD_PREFIXES.rdfs}label`;

console.assert(
  jt.toCurie(rdfsLabel) === 'rdfs:label',
  'toCurie: rdfs:label compacts correctly'
);
console.log('toCurie rdfs:label →', jt.toCurie(rdfsLabel));

// Custom bookstore prefix registered via create() options.
console.assert(
  jt.toCurie('https://bookstore.example/Author') === 'bk:Author',
  'toCurie: bk:Author compacts correctly'
);
console.log('toCurie bk:Author   →', jt.toCurie('https://bookstore.example/Author'));

// No matching prefix — input is returned unchanged.
const unknownIri = 'https://unknown.example.org/Thing';

console.assert(
  jt.toCurie(unknownIri) === unknownIri,
  'toCurie: unknown IRI passes through unchanged'
);
console.log('toCurie unknown     →', jt.toCurie(unknownIri));

// ── fromCurie — expand CURIEs ─────────────────────────────────────────────

// Standard prefix expansion.
console.assert(
  jt.fromCurie('rdf:type') === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
  'fromCurie: rdf:type expands to full IRI'
);
console.log('fromCurie rdf:type  →', jt.fromCurie('rdf:type'));

// Custom prefix expansion.
console.assert(
  jt.fromCurie('bk:Author') === 'https://bookstore.example/Author',
  'fromCurie: bk:Author expands to full IRI'
);
console.log('fromCurie bk:Author →', jt.fromCurie('bk:Author'));

// Unknown prefix — input is returned unchanged.
console.assert(
  jt.fromCurie('unknown:Thing') === 'unknown:Thing',
  'fromCurie: unknown prefix passes through unchanged'
);
console.log('fromCurie unknown   →', jt.fromCurie('unknown:Thing'));

// ── round-trip ────────────────────────────────────────────────────────────

const authorIri = 'https://bookstore.example/Author';
const authorCurie = jt.toCurie(authorIri);
const roundTripped = jt.fromCurie(authorCurie);

console.assert(
  roundTripped === authorIri,
  'round-trip: toCurie then fromCurie restores the original IRI'
);
console.log('\nRound-trip');
console.log('  IRI:        ', authorIri);
console.log('  toCurie:    ', authorCurie);
console.log('  fromCurie:  ', roundTripped);
console.log('  match:', roundTripped === authorIri);
