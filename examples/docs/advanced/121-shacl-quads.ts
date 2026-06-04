/**
 * OntologyBuilder.shaclQuads — raw SHACL shape quad array.
 *
 * `toShacl()` returns an `OntologyBuilder` whose SHACL quad store is
 * populated by the SHACL serializer. `shaclQuads()` exposes those quads
 * directly as an `QuadInterface[]`, giving consumers a quad-level workaround
 * surface for post-processing, filtering, or feeding into custom RDF pipelines.
 *
 * The OWL quad store (`quads()`) is empty for a `toShacl()` builder — SHACL
 * content lives exclusively in `shaclQuads()`.
 */

import { bookstoreEntities } from '../bookstore/index.js';
import {
  RDF, SH
} from '../../../src/constants/IRI.js';

const shaclBuilder = bookstoreEntities.toShacl();

// shaclQuads() returns the raw SHACL shape quads from the SHACL store.
const shQuads = shaclBuilder.shaclQuads();

console.assert(
  shQuads.length > 0,
  'shaclQuads() must return at least one quad'
);

// Every SHACL node shape is expressed as an rdf:type sh:NodeShape triple.
const hasNodeShape = shQuads.some((quad) => {
  return (
    quad.predicate.value === RDF.type
    && quad.object.value === SH.NodeShape
  );
});

console.assert(
  hasNodeShape,
  'shaclQuads() must contain at least one rdf:type sh:NodeShape quad'
);

// The OWL quad store is empty for a toShacl() builder.
const owlQuads = shaclBuilder.quads();

console.assert(
  owlQuads.length === 0,
  'quads() must be empty for a toShacl() builder'
);

console.log('shaclQuads() count:', shQuads.length);
console.log('contains sh:NodeShape typed quad:', hasNodeShape);
console.log('quads() length (must be 0):', owlQuads.length);

// Sample the first sh:NodeShape subject IRI for visibility.
const nodeShapeQuad = shQuads.find((quad) => {
  return quad.predicate.value === RDF.type && quad.object.value === SH.NodeShape;
});

if (nodeShapeQuad !== undefined) {
  console.log('first sh:NodeShape subject:', nodeShapeQuad.subject.value);
}
