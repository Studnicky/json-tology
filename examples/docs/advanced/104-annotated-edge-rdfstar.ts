/**
 * RDF-star annotated edge via `jt:annotatedEdge` / `Compose.annotatedEdge`.
 *
 * The bookstore `Review.reviewsBook` property uses an annotated edge: rather
 * than recording the rating only as a scalar on the Review, the annotation
 * attaches `ratingGiven` directly to the edge triple itself using the RDF 1.2
 * triple-term (RDF-star) encoding.
 *
 * `toQuads` emits:
 *   1. A base triple:  <review-IRI> <https://bookstore.example/reviews> <book-IRI>
 *   2. An annotation quad whose subject IS the base triple (triple-term):
 *      << <review-IRI> <https://bookstore.example/reviews> <book-IRI> >>
 *        <…Review#…#ratingGiven>  "5"^^xsd:integer
 *
 * Both quads share the same named graph. A named graph (`graphIRI`) is
 * required — the default graph cannot carry triple-term quads.
 */

import type { QuadInterface } from '../../../src/interfaces/Quad.js';
import {
  aboxFixtures,
  bookstoreEntities,
  ReviewSchema
} from '../bookstore/index.js';

const REVIEWS_GRAPH = 'https://bookstore.example/graph/reviews';

const review = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge);
const quads = bookstoreEntities.toQuads(ReviewSchema, review, { 'graphIRI': REVIEWS_GRAPH });

// ── Base triple ────────────────────────────────────────────────────────────
const baseTriple = quads.find((quad) => {
  return quad.predicate.value === 'https://bookstore.example/reviews'
    && quad.subject.termType === 'NamedNode';
});

if (baseTriple === undefined) {
  throw new Error('expected base triple not found in quad set');
}

console.assert(
  baseTriple.object.termType === 'NamedNode',
  'base triple object is a NamedNode (book IRI)'
);
console.assert(
  baseTriple.object.value === aboxFixtures.reviewWithAnnotatedEdge.reviewsBook.target,
  'base triple object IRI matches fixture target'
);
console.assert(
  baseTriple.graph.value === REVIEWS_GRAPH,
  'base triple stamped with the named graph IRI'
);

// ── Triple-term annotation quad ────────────────────────────────────────────
// The annotation quad's subject is itself a Quad (the base triple).
type TripleTermQuad = QuadInterface & { 'subject': QuadInterface };

function isTripleTermQuad(quad: QuadInterface): quad is TripleTermQuad {
  return quad.subject.termType === 'Quad';
}

const annotationQuads = quads.filter(isTripleTermQuad);

console.assert(annotationQuads.length === 2, 'two annotation quads: ratingGiven + verifiedPurchase');

// Each annotation predicate is grounded to a schema.org term via `x-jt-predicate`
// on its annotation sub-schema, so annotations are addressable by vocabulary IRI.
const ratingAnnotation = annotationQuads.find((quad) => {
  return quad.predicate.value === 'https://schema.org/ratingValue';
});
const verifiedAnnotation = annotationQuads.find((quad) => {
  return quad.predicate.value === 'https://schema.org/verified';
});

if (ratingAnnotation === undefined || verifiedAnnotation === undefined) {
  throw new Error('expected grounded annotation quads not found in quad set');
}

console.assert(
  ratingAnnotation.object.value === String(aboxFixtures.reviewWithAnnotatedEdge.reviewsBook.annotations.ratingGiven),
  'ratingGiven value matches fixture'
);
console.assert(
  verifiedAnnotation.object.value === String(aboxFixtures.reviewWithAnnotatedEdge.reviewsBook.annotations.verifiedPurchase),
  'verifiedPurchase value matches fixture'
);
console.assert(
  ratingAnnotation.graph.value === REVIEWS_GRAPH,
  'annotation quad in the same named graph as the base triple'
);

console.log('Base triple:');
console.log('  subject:', baseTriple.subject.value);
console.log('  predicate:', baseTriple.predicate.value);
console.log('  object:', baseTriple.object.value);
console.log('  graph:', baseTriple.graph.value);

console.log('\nAnnotation quads (triple-term subject, predicates grounded to schema.org):');
for (const annotation of [
  ratingAnnotation,
  verifiedAnnotation
]) {
  console.log('  subject termType:', annotation.subject.termType);
  console.log('  predicate:', annotation.predicate.value);
  console.log('  object:', annotation.object.value);
  console.log('  graph:', annotation.graph.value);
}
