/**
 * Unit tests for the `annotationEmitMode` projection option on annotated edges.
 *
 * An annotated edge (`Compose.annotatedEdge`) carries property annotations that
 * are projected to RDF in one of three modes:
 *
 * - `'star-only'` (default): annotations as RDF 1.2 triple-term (RDF-star)
 *   quads whose subject is the quoted base triple `<< s p o >>`. Lossless
 *   round-trip via `fromQuads`.
 * - `'flat-only'`: annotations as plain flat triples `<s> <annPred> <value>`.
 *   No triple-term subjects. Emission-oriented — `fromQuads` cannot recover the
 *   annotation structure (lifted `annotations` is empty).
 * - `'both'`: emits the flat triples AND the RDF-star quads. Lossless round-trip.
 *
 * The base edge triple `<s> <edgePredicate> <o>` is ALWAYS emitted, in every
 * mode. Only the annotation projection differs.
 *
 * Fixture: a bookstore Review `reviews` a Book, annotated with `ratingGiven 5`
 * and `verifiedPurchase true`, asserted in the named graph
 * `https://bookstore.example/graph/reviews`. With `baseIRI`
 * `https://bookstore.example`, the canonical predicate resolver maps the
 * annotation property names to flat IRIs `…/ratingGiven` and `…/verifiedPurchase`.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';

import { Compose } from '../../src/modules/composition/Compose.js';
import { JsonTology } from '../../src/index.js';
import { isRecord } from '../../src/modules/data/DataTypes.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

// ---------------------------------------------------------------------------
// Fixture schemas
// ---------------------------------------------------------------------------

const BASE_IRI = 'https://bookstore.example';
const REVIEWS_GRAPH = 'https://bookstore.example/graph/reviews';
const BOOK_IRI = 'urn:bookstore:instances/book/978-0-06-112008-4';

const EDGE_PREDICATE = 'https://bookstore.example/reviews';
const RATING_PREDICATE = 'https://bookstore.example/ratingGiven';
const VERIFIED_PREDICATE = 'https://bookstore.example/verifiedPurchase';

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
  'predicate': EDGE_PREDICATE,
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
    'baseIRI': BASE_IRI,
    'enableStrictGraph': false
  });

  jt.set(BookSchema);
  jt.set(RatingScoreSchema);
  jt.set(VerifiedPurchaseSchema);
  jt.set(ReviewSchema);

  return jt;
}

// ---------------------------------------------------------------------------
// Quad classification helpers
// ---------------------------------------------------------------------------

/** The flat base edge triple: `<NamedNode subject> edgePredicate <book>`. */
function baseEdgeTriples(quads: readonly QuadInterface[]): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
  });
}

/** Star annotation quads: subject is a quoted triple term (`termType === 'Quad'`). */
function starAnnotationQuads(quads: readonly QuadInterface[]): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject.termType === 'Quad';
  });
}

/**
 * Flat annotation triples: `<NamedNode subject> <annotationPredicate> <value>`
 * where the predicate is one of the resolved annotation predicate IRIs (NOT the
 * edge predicate, NOT a star quad).
 */
function flatAnnotationTriples(quads: readonly QuadInterface[]): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject.termType === 'NamedNode'
      && (quad.predicate.value === RATING_PREDICATE || quad.predicate.value === VERIFIED_PREDICATE);
  });
}

function byPredicate(quads: readonly QuadInterface[]): Map<string, QuadInterface> {
  return new Map(quads.map((quad) => {
    return [
      quad.predicate.value,
      quad
    ] as const;
  }));
}

/** Canonical string form of each quad (subject/predicate/typed-object/graph), sorted. */
function normalizeQuads(quads: readonly QuadInterface[]): string[] {
  return quads.map((quad) => {
    const subj = quad.subject.termType === 'Quad'
      ? `<<${quad.subject.subject.value} ${quad.subject.predicate.value} ${quad.subject.object.value}>>`
      : quad.subject.value;
    const objType = quad.object.termType === 'Literal'
      ? `${quad.object.value}^^${quad.object.datatype.value}`
      : quad.object.value;

    return `${subj} | ${quad.predicate.value} | ${objType} | ${quad.graph.value}`;
  }).sort();
}

/** Project the fixture under a mode, lift back, and return the `book` edge object. */
function liftedReviewEdge(mode: 'both' | 'flat-only' | 'star-only'): Record<string, unknown> {
  const jt = freshJt();
  const quads = jt.toQuads(ReviewSchema, reviewInstance, {
    'annotationEmitMode': mode,
    'graphIRI': REVIEWS_GRAPH
  });
  const lifted = jt.fromQuads(ReviewSchema, quads);

  assert.equal(lifted.length, 1, 'one lifted instance');

  const instance = lifted[0];

  assert.ok(isRecord(instance), 'lifted instance is a record');

  const edge = instance.book;

  assert.ok(isRecord(edge), 'book edge present');

  return edge;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('annotationEmitMode — annotated-edge annotation projection', () => {
  void describe("'star-only' (and default/unset)", () => {
    void it("'star-only': base flat triple + star annotation quads; NO flat annotation triple", () => {
      const jt = freshJt();
      const quads = jt.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'star-only',
        'graphIRI': REVIEWS_GRAPH
      });

      // Base flat edge triple present (exactly one).
      const base = baseEdgeTriples(quads);

      assert.equal(base.length, 1, 'exactly one base flat edge triple');
      assert.equal(base[0].object.value, BOOK_IRI);

      // Two star annotation quads (Quad subjects).
      const star = starAnnotationQuads(quads);

      assert.equal(star.length, 2, 'two star (triple-term) annotation quads');

      const starByPred = byPredicate(star);
      const ratingStar = starByPred.get(RATING_PREDICATE);
      const verifiedStar = starByPred.get(VERIFIED_PREDICATE);

      assert.ok(ratingStar, 'ratingGiven star quad present');
      assert.ok(verifiedStar, 'verifiedPurchase star quad present');
      assert.equal(ratingStar.object.value, '5');
      assert.equal(verifiedStar.object.value, 'true');

      // The inner triple term equals the base triple.
      assert.equal(ratingStar.subject.termType, 'Quad');
      const innerTriple = ratingStar.subject;

      assert.equal(innerTriple.predicate.value, EDGE_PREDICATE);
      assert.equal(innerTriple.object.value, BOOK_IRI);

      // NO flat annotation triple exists in star-only mode.
      const flat = flatAnnotationTriples(quads);

      assert.equal(flat.length, 0, 'star-only emits NO flat annotation triples');
    });

    void it('default (unset) emits an IDENTICAL quad set to star-only', () => {
      const jt1 = freshJt();
      const jt2 = freshJt();

      const unsetQuads = jt1.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });
      const starQuads = jt2.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'star-only',
        'graphIRI': REVIEWS_GRAPH
      });

      assert.equal(unsetQuads.length, starQuads.length, 'same quad count');

      assert.deepEqual(
        normalizeQuads(unsetQuads),
        normalizeQuads(starQuads),
        'default (unset) === star-only — identical quad sets'
      );
    });
  });

  void describe("'flat-only'", () => {
    void it("'flat-only': base flat triple + flat annotation triples; NO Quad-subject quad", () => {
      const jt = freshJt();
      const quads = jt.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'flat-only',
        'graphIRI': REVIEWS_GRAPH
      });

      // Base flat edge triple present (exactly one).
      const base = baseEdgeTriples(quads);

      assert.equal(base.length, 1, 'exactly one base flat edge triple');
      assert.equal(base[0].object.value, BOOK_IRI);

      // Two flat annotation triples with the correct resolved predicates +
      // typed literal values. Subject is the review instance IRI (NamedNode),
      // not a triple term.
      const flat = flatAnnotationTriples(quads);

      assert.equal(flat.length, 2, 'two flat annotation triples');

      const flatByPred = byPredicate(flat);
      const ratingFlat = flatByPred.get(RATING_PREDICATE);
      const verifiedFlat = flatByPred.get(VERIFIED_PREDICATE);

      assert.ok(ratingFlat, 'ratingGiven flat triple present');
      assert.ok(verifiedFlat, 'verifiedPurchase flat triple present');

      // Subject is the instance IRI (NamedNode), shared with the base triple.
      assert.equal(ratingFlat.subject.termType, 'NamedNode');
      assert.equal(ratingFlat.subject.value, base[0].subject.value, 'flat annotation subject === instance subject');
      assert.equal(verifiedFlat.subject.value, base[0].subject.value);

      // Typed literal values.
      assert.equal(ratingFlat.object.termType, 'Literal');
      assert.equal(ratingFlat.object.value, '5');
      assert.match(ratingFlat.object.datatype.value, /integer$/u);
      assert.equal(verifiedFlat.object.termType, 'Literal');
      assert.equal(verifiedFlat.object.value, 'true');
      assert.match(verifiedFlat.object.datatype.value, /boolean$/u);

      // NO Quad-subject (star) quad exists in flat-only mode.
      const star = starAnnotationQuads(quads);

      assert.equal(star.length, 0, 'flat-only emits NO Quad-subject (star) quads');
    });

    void it("'flat-only' stamps the flat annotation triples with the same graphIRI", () => {
      const jt = freshJt();
      const quads = jt.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'flat-only',
        'graphIRI': REVIEWS_GRAPH
      });

      for (const quad of flatAnnotationTriples(quads)) {
        assert.equal(quad.graph.termType, 'NamedNode');
        assert.equal(quad.graph.value, REVIEWS_GRAPH);
      }
    });
  });

  void describe("'both'", () => {
    void it("'both': base + star annotation quads + flat annotation triples all present", () => {
      const jt = freshJt();
      const quads = jt.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'both',
        'graphIRI': REVIEWS_GRAPH
      });

      const base = baseEdgeTriples(quads);

      assert.equal(base.length, 1, 'exactly one base flat edge triple');

      const star = starAnnotationQuads(quads);

      assert.equal(star.length, 2, 'two star annotation quads');

      const flat = flatAnnotationTriples(quads);

      assert.equal(flat.length, 2, 'two flat annotation triples');

      // Both predicate IRIs appear in BOTH the star and flat forms.
      const starPreds = new Set(star.map((quad) => {
        return quad.predicate.value;
      }));
      const flatPreds = new Set(flat.map((quad) => {
        return quad.predicate.value;
      }));

      assert.ok(starPreds.has(RATING_PREDICATE) && starPreds.has(VERIFIED_PREDICATE), 'both star predicates present');
      assert.ok(flatPreds.has(RATING_PREDICATE) && flatPreds.has(VERIFIED_PREDICATE), 'both flat predicates present');
    });

    void it("'both' emits strictly more quads than star-only (the extra flat triples)", () => {
      const jtStar = freshJt();
      const jtBoth = freshJt();

      const starQuads = jtStar.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'star-only',
        'graphIRI': REVIEWS_GRAPH
      });
      const bothQuads = jtBoth.toQuads(ReviewSchema, reviewInstance, {
        'annotationEmitMode': 'both',
        'graphIRI': REVIEWS_GRAPH
      });

      assert.equal(
        bothQuads.length,
        starQuads.length + 2,
        "'both' adds exactly the two flat annotation triples over star-only"
      );
    });
  });

  // -------------------------------------------------------------------------
  // Round-trip: toQuads -> fromQuads
  // -------------------------------------------------------------------------

  void describe('round-trip (toQuads -> fromQuads)', () => {
    void it("'star-only' round-trips losslessly — annotations reconstructed", () => {
      const edge = liftedReviewEdge('star-only');

      assert.equal(edge.target, BOOK_IRI);

      const annotations = edge.annotations;

      assert.ok(isRecord(annotations), 'annotations present');
      assert.equal(annotations.ratingGiven, 5);
      assert.equal(annotations.verifiedPurchase, true);
    });

    void it("'both' round-trips losslessly — annotations reconstructed (star form present)", () => {
      const edge = liftedReviewEdge('both');

      assert.equal(edge.target, BOOK_IRI);

      const annotations = edge.annotations;

      assert.ok(isRecord(annotations), 'annotations present');
      assert.equal(annotations.ratingGiven, 5);
      assert.equal(annotations.verifiedPurchase, true);
    });

    void it("'flat-only' is lossy on lift — target reconstructed, annotations EMPTY (documented limitation)", () => {
      const edge = liftedReviewEdge('flat-only');

      // The base triple is always emitted, so the target survives.
      assert.equal(edge.target, BOOK_IRI, 'target reconstructed from the always-emitted base triple');

      // fromQuads recovers annotations only from triple-term subjects. flat-only
      // has none, so annotations come back empty. This pins the documented
      // limitation as a behavioural test (not just prose in the TSDoc).
      const annotations = edge.annotations;

      assert.ok(isRecord(annotations), 'annotations object present (empty)');
      assert.equal(
        Object.keys(annotations).length,
        0,
        'flat-only: annotation structure is NOT recoverable via fromQuads — empty annotations'
      );
    });
  });
});

// ---------------------------------------------------------------------------
// x-jt-predicate grounding — BY DESIGN, not by accident.
//
// The default fixture's annotations omit `x-jt-predicate`, so they resolve to
// the canonical `baseIRI + propertyName` fallback. These tests use annotations
// that DO carry `x-jt-predicate`, proving the flat path honours the grounded
// predicate IRI: `emitFlatAnnotationQuads` resolves through the SAME
// `PredicateResolver` (passed the annotation's `propertySchema`) as the star
// path, and that resolver reads `x-jt-predicate` first.
// ---------------------------------------------------------------------------

const SCHEMA_ORG_VERIFIED = 'https://schema.org/verified';
const SCHEMA_ORG_RATING = 'https://schema.org/ratingValue';

const GroundedReviewsBookEdge = Compose.annotatedEdge({
  'annotations': {
    'ratingGiven': {
      '$ref': 'urn:bookstore:RatingScore',
      'x-jt-predicate': SCHEMA_ORG_RATING
    },
    'verifiedPurchase': {
      '$ref': 'urn:bookstore:VerifiedPurchase',
      'x-jt-predicate': SCHEMA_ORG_VERIFIED
    }
  },
  'predicate': EDGE_PREDICATE,
  'targetRef': 'urn:bookstore:Book'
});

const GroundedReviewSchema = {
  '$id': 'urn:bookstore:GroundedReview',
  'properties': {
    'book': GroundedReviewsBookEdge,
    'reviewId': { 'type': 'string' }
  },
  'required': ['reviewId'],
  'type': 'object'
} as const;

function groundedQuads(mode: 'both' | 'flat-only' | 'star-only'): readonly QuadInterface[] {
  const jt = JsonTology.create({
    'baseIRI': BASE_IRI,
    'enableStrictGraph': false
  });

  jt.set(BookSchema);
  jt.set(RatingScoreSchema);
  jt.set(VerifiedPurchaseSchema);
  jt.set(GroundedReviewSchema);

  return jt.toQuads(GroundedReviewSchema, reviewInstance, {
    'annotationEmitMode': mode,
    'graphIRI': REVIEWS_GRAPH
  });
}

function groundedFlatTriples(quads: readonly QuadInterface[]): QuadInterface[] {
  return quads.filter((quad) => {
    return quad.subject.termType === 'NamedNode'
      && (quad.predicate.value === SCHEMA_ORG_VERIFIED || quad.predicate.value === SCHEMA_ORG_RATING);
  });
}

void describe('annotationEmitMode — x-jt-predicate grounding (by design, not by accident)', () => {
  void it("'flat-only': flat triples use the x-jt-predicate-grounded IRI, not the canonical fallback", () => {
    const quads = groundedQuads('flat-only');
    const byPred = byPredicate(groundedFlatTriples(quads));
    const verified = byPred.get(SCHEMA_ORG_VERIFIED);
    const rating = byPred.get(SCHEMA_ORG_RATING);

    assert.ok(verified, 'verifiedPurchase flat triple uses https://schema.org/verified');
    assert.ok(rating, 'ratingGiven flat triple uses https://schema.org/ratingValue');
    assert.equal(verified.object.value, 'true');
    assert.equal(rating.object.value, '5');

    // The canonical baseIRI+propertyName fallback must NOT appear when grounded.
    const fallback = quads.filter((quad) => {
      return quad.predicate.value === VERIFIED_PREDICATE || quad.predicate.value === RATING_PREDICATE;
    });

    assert.equal(fallback.length, 0, 'no canonical-fallback predicate when x-jt-predicate is set');
  });

  void it('star and flat paths resolve the SAME grounded predicate IRI (shared resolver)', () => {
    const starPreds = starAnnotationQuads(groundedQuads('star-only')).map((quad) => {
      return quad.predicate.value;
    })
      .sort();
    const flatPreds = groundedFlatTriples(groundedQuads('flat-only')).map((quad) => {
      return quad.predicate.value;
    })
      .sort();

    assert.deepEqual(starPreds, [
      SCHEMA_ORG_RATING,
      SCHEMA_ORG_VERIFIED
    ]);
    assert.deepEqual(flatPreds, starPreds, 'flat and star emit identical grounded predicate IRIs');
  });
});
