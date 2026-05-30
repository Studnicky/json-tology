/**
 * `x-jt-iriRef` (NamedNode) and `x-jt-language` (rdf:langString).
 *
 * Two bookstore schemas demonstrate how `toQuads` adjusts the RDF term
 * type for a string property based on schema-level annotations:
 *
 * - `DownloadUrl` carries `x-jt-iriRef: true` — the download URL is a
 *   dereferenceable resource, not merely a string value. `toQuads` emits
 *   it as a `NamedNode` (termType: 'NamedNode') rather than an xsd:string
 *   literal.
 *
 * - `Provenance` carries `x-jt-language: 'de'` — the chain-of-custody
 *   text for the Thienemann Verlag first edition is German prose. `toQuads`
 *   emits it as an `rdf:langString` literal tagged `@de`.
 *
 * Both fixtures are from the canonical bookstore ABox (Bastian Balthazar Bux
 * ordering a signed 1979 first edition of Die unendliche Geschichte).
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures,
  bookstoreSchemas,
  EBookSchema,
  SignedFirstEditionSchema
} from '../bookstore/index.js';

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': bookstoreSchemas
});

// ── x-jt-iriRef: true → NamedNode ─────────────────────────────────────────
const ebook = jt.instantiate(EBookSchema, aboxFixtures.ebook);
const ebookQuads = jt.toQuads(EBookSchema, ebook);

const downloadUrlQuad = ebookQuads.find((quad) => {
  return quad.predicate.value === 'https://bookstore.example/downloadUrl';
});

console.assert(downloadUrlQuad !== undefined, 'downloadUrl quad present');
console.assert(
  downloadUrlQuad?.object.termType === 'NamedNode',
  'downloadUrl emitted as NamedNode (x-jt-iriRef: true)'
);
console.assert(
  downloadUrlQuad?.object.value === aboxFixtures.ebook.downloadUrl,
  'NamedNode value matches the download URL'
);

console.log('downloadUrl quad:');
console.log('  predicate:', downloadUrlQuad?.predicate.value);
console.log('  object termType:', downloadUrlQuad?.object.termType);
console.log('  object value:', downloadUrlQuad?.object.value);

// ── x-jt-language: 'de' → rdf:langString @de ──────────────────────────────
const signedEd = jt.instantiate(SignedFirstEditionSchema, aboxFixtures.signedFirstEdition);
const signedQuads = jt.toQuads(SignedFirstEditionSchema, signedEd);

const provenanceQuad = signedQuads.find((quad) => {
  return quad.predicate.value === 'https://bookstore.example/provenance';
});

console.assert(provenanceQuad !== undefined, 'provenance quad present');
console.assert(
  provenanceQuad?.object.termType === 'Literal',
  'provenance emitted as Literal (rdf:langString)'
);

// Narrow to Literal to access .datatype and .language without casting.
const provObj = provenanceQuad?.object;
const provLiteral = provObj?.termType === 'Literal' ? provObj : undefined;

// rdf:langString datatype IRI per the RDF 1.1 specification.
console.assert(
  provLiteral?.datatype.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString',
  'provenance datatype is rdf:langString'
);

// Language tag is 'de' (x-jt-language: 'de' on ProvenanceSchema).
console.assert(
  provLiteral?.language === 'de',
  'provenance literal carries @de language tag'
);

console.log('\nprovenance quad:');
console.log('  predicate:', provenanceQuad?.predicate.value);
console.log('  object termType:', provenanceQuad?.object.termType);
console.log('  object datatype:', provLiteral?.datatype.value);
console.log('  object language:', provLiteral?.language);
console.log('  object value (first 60 chars):', provenanceQuad?.object.value.slice(0, 60));
