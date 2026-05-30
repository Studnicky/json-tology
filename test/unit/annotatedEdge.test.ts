/**
 * Unit tests for RDF 1.2 triple-term (edge-annotation) emission.
 *
 * Exercises a bookstore fixture: a Review `reviews` a Book, annotated with
 * `ratingGiven 5` and `verifiedPurchase true`, all asserted in the named graph
 * `https://bookstore.example/graph/reviews`.
 *
 * Covers:
 * - `toQuads` emits the base triple plus one `Quad`-subject (triple-term)
 *   annotation quad per annotation, ALL stamped with the same `graphIRI`.
 * - The same-graph invariant: no annotation quad lands in a different graph.
 * - `fromQuads` round-trips the emitted quads back to the instance shape.
 * - The N3 v2 `Writer` serializes `Quad`-subject quads as Turtle 1.2 `<< s p o >>`.
 * - Missing `graphIRI` for an annotated edge raises an intelligible error.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { Writer } from 'n3';

import { Compose } from '../../src/modules/composition/Compose.js';
import { JsonTology } from '../../src/index.js';
import { MaterializationError } from '../../src/errors/MaterializationError.js';
import { isRecord } from '../../src/modules/data/DataTypes.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

type TripleTermQuad = QuadInterface & { 'subject': QuadInterface };

// ---------------------------------------------------------------------------
// Fixture schemas
// ---------------------------------------------------------------------------

const REVIEWS_GRAPH = 'https://bookstore.example/graph/reviews';
const BOOK_IRI = 'urn:bookstore:instances/book/978-0-06-112008-4';

const BookSchema = {
  '$id': 'urn:bookstore:Book',
  'properties': { 'title': { 'type': 'string' } },
  'required': ['title'],
  'type': 'object'
} as const;

const RatingScoreSchema = {
  '$id': 'urn:bookstore:RatingScore',
  'maximum': 5,
  'minimum': 1,
  'type': 'integer'
} as const;

const VerifiedPurchaseSchema = {
  '$id': 'urn:bookstore:VerifiedPurchase',
  'type': 'boolean'
} as const;

const ReviewsBookEdge = Compose.annotatedEdge({
  'annotations': {
    'ratingGiven': { '$ref': 'urn:bookstore:RatingScore' },
    'verifiedPurchase': { '$ref': 'urn:bookstore:VerifiedPurchase' }
  },
  'predicate': 'https://bookstore.example/reviews',
  'targetRef': 'urn:bookstore:Book'
});

const ReviewSchema = {
  '$id': 'urn:bookstore:Review',
  'properties': {
    'book': ReviewsBookEdge,
    'reviewId': { 'type': 'string' }
  },
  'required': ['reviewId'],
  'type': 'object'
} as const;

const EDGE_PREDICATE = 'https://bookstore.example/reviews';
const RATING_PREDICATE = 'urn:bookstore:Review#/properties/book#ratingGiven';
const VERIFIED_PREDICATE = 'urn:bookstore:Review#/properties/book#verifiedPurchase';

const reviewInstance = {
  'book': {
    'annotations': {
      'ratingGiven': 5,
      'verifiedPurchase': true
    },
    'target': BOOK_IRI
  },
  'reviewId': 'rev-001'
};

function freshJt(): ReturnType<typeof JsonTology.create> {
  const jt = JsonTology.create({
    'baseIRI': 'https://bookstore.example',
    'enableStrictGraph': false
  });

  jt.set(BookSchema);
  jt.set(RatingScoreSchema);
  jt.set(VerifiedPurchaseSchema);
  jt.set(ReviewSchema);

  return jt;
}

function isTripleTermSubject(quad: QuadInterface): quad is TripleTermQuad {
  return quad.subject.termType === 'Quad';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('annotated edge (RDF 1.2 triple-term) emission', () => {
  void it('emits the base triple plus one Quad-subject quad per annotation', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });

    const baseTriples = quads.filter((quad) => {
      return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
    });

    assert.equal(baseTriples.length, 1, 'exactly one base triple');
    assert.equal(baseTriples[0].object.value, BOOK_IRI);

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    assert.equal(annotationQuads.length, 2, 'two annotation (triple-term) quads');

    const byPredicate = new Map(annotationQuads.map((quad) => {
      return [
        quad.predicate.value,
        quad
      ] as const;
    }));

    const ratingQuad = byPredicate.get(RATING_PREDICATE);
    const verifiedQuad = byPredicate.get(VERIFIED_PREDICATE);

    assert.ok(ratingQuad, 'ratingGiven annotation present');
    assert.ok(verifiedQuad, 'verifiedPurchase annotation present');
    assert.equal(ratingQuad.object.value, '5');
    assert.equal(verifiedQuad.object.value, 'true');
  });

  void it('stamps the base triple AND every annotation quad with the same graphIRI', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });

    const edgeRelatedQuads = quads.filter((quad) => {
      return (quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode')
        || isTripleTermSubject(quad);
    });

    assert.equal(edgeRelatedQuads.length, 3, 'one base + two annotation quads');

    for (const quad of edgeRelatedQuads) {
      assert.equal(quad.graph.termType, 'NamedNode', 'edge quad is in a named graph');
      assert.equal(quad.graph.value, REVIEWS_GRAPH, 'same-graph invariant: all edge quads share graphIRI');
    }
  });

  void it('the inner triple term of every annotation quad equals the base triple', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    for (const quad of annotationQuads) {
      const subject = quad.subject;

      assert.equal(subject.termType, 'Quad');
      assert.equal(subject.predicate.value, EDGE_PREDICATE);
      assert.equal(subject.object.value, BOOK_IRI);
      assert.equal(subject.subject.termType, 'NamedNode');
    }
  });

  void it('round-trips through fromQuads back to the instance shape', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });

    const lifted = jt.fromQuads(ReviewSchema, quads);

    assert.equal(lifted.length, 1, 'one lifted instance');

    const instance = lifted[0];

    assert.ok(isRecord(instance), 'lifted instance is a record');

    const edge = instance.book;

    assert.ok(isRecord(edge), 'book edge present');
    assert.equal(edge.target, BOOK_IRI);

    const annotations = edge.annotations;

    assert.ok(isRecord(annotations), 'annotations present');
    assert.equal(annotations.ratingGiven, 5);
    assert.equal(annotations.verifiedPurchase, true);
  });

  void it('round-trips through instantiate (validate passes)', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });
    const lifted = jt.fromQuads(ReviewSchema, quads);

    const validated = jt.instantiate(ReviewSchema, lifted[0]);

    assert.ok(isRecord(validated), 'validated instance is a record');
    assert.equal(validated.reviewId, 'rev-001');

    const edge = validated.book;

    assert.ok(isRecord(edge), 'book edge present');
    assert.equal(edge.target, BOOK_IRI);
  });

  void it('raises an intelligible error when graphIRI is absent for an annotated edge', () => {
    const jt = freshJt();

    assert.throws(
      () => {
        jt.toQuads(ReviewSchema, reviewInstance);
      },
      (error: unknown) => {
        assert.ok(error instanceof MaterializationError);
        assert.equal(error.code, 'MISSING_GRAPH_IRI');
        assert.match(error.message, /graphIRI/u);

        return true;
      }
    );
  });

  void it('serializes Quad-subject quads as Turtle 1.2 << s p o >> via the N3 v2 Writer', async () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    const turtle = await new Promise<string>((resolve, reject) => {
      const writer = new Writer({ 'format': 'application/trig' });

      writer.addQuads(annotationQuads);
      writer.end((error: Error | null, result: string) => {
        if (error !== null) {
          reject(error);

          return;
        }
        resolve(result);
      });
    });

    // N3 v2 emits RDF 1.2 / Turtle 1.2 quoted triples. The base triple appears
    // as the quoted-triple subject `<< ... >>` (N3.js renders the inner triple
    // with parentheses: `<<( s p o )>>`). Assert each component is present in a
    // quoted-triple region rather than via one catastrophic-backtracking regex.
    const quoteStart = turtle.indexOf('<<');

    assert.notEqual(quoteStart, -1, 'turtle contains a quoted-triple opener `<<`');

    const quoteEnd = turtle.indexOf('>>', quoteStart);

    assert.notEqual(quoteEnd, -1, 'turtle contains a quoted-triple closer `>>`');

    const quotedTriple = turtle.slice(quoteStart, quoteEnd);

    assert.ok(quotedTriple.includes('Review'), 'quoted triple references the subject');
    assert.ok(
      quotedTriple.includes('<https://bookstore.example/reviews>'),
      'quoted triple references the edge predicate'
    );
    assert.ok(
      quotedTriple.includes('<urn:bookstore:instances/book/978-0-06-112008-4>'),
      'quoted triple references the target object'
    );

    // Both the named graph and the annotation predicates are present.
    assert.ok(
      turtle.includes('<https://bookstore.example/graph/reviews>'),
      'named graph IRI is present'
    );
    assert.match(turtle, /ratingGiven>\s+5\b/u);
  });
});
