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
import {
  JsonTology, Skolemize
} from '../../src/index.js';
import { MaterializationError } from '../../src/errors/MaterializationError.js';
import { DataType } from '../../src/modules/data/DataType.js';
import type { QuadInterface } from '../../src/interfaces/QuadInterface.js';
import type { SkolemizeFnType } from '../../src/types/SkolemizeFnType.js';

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
const RATING_PREDICATE = 'https://bookstore.example/ratingGiven';
const VERIFIED_PREDICATE = 'https://bookstore.example/verifiedPurchase';

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
    const baseTriple0 = baseTriples.at(0);

    if (baseTriple0 === undefined) {
      throw new Error('expected baseTriples[0] to exist');
    }
    assert.equal(baseTriple0.object.value, BOOK_IRI);

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

    assert.ok(DataType.isRecord(instance), 'lifted instance is a record');

    const edge = instance.book;

    assert.ok(DataType.isRecord(edge), 'book edge present');
    assert.equal(edge.target, BOOK_IRI);

    const annotations = edge.annotations;

    assert.ok(DataType.isRecord(annotations), 'annotations present');
    assert.equal(annotations.ratingGiven, 5);
    assert.equal(annotations.verifiedPurchase, true);
  });

  void it('round-trips through instantiate (validate passes)', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });
    const lifted = jt.fromQuads(ReviewSchema, quads);

    const validated = jt.instantiate(ReviewSchema, lifted[0]);

    assert.ok(DataType.isRecord(validated), 'validated instance is a record');
    assert.equal(validated.reviewId, 'rev-001');

    const edge = validated.book;

    assert.ok(DataType.isRecord(edge), 'book edge present');
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

  // ---------------------------------------------------------------------------
  // Depth-gated iriFor: nested-object annotated-edge target minted at depth+1
  // ---------------------------------------------------------------------------
  //
  // BUG (pre-fix): resolveEdgeTargetIri called minter.mint(..., 0) for nested-
  // object targets.  A depth-gated iriFor that returns a ROOT IRI only at
  // depth===0 would therefore receive depth===0 for BOTH the root instance AND
  // the edge target, collapsing them onto the same IRI.
  //
  // FIX: the call site now passes `depth + 1`, so the iriFor callback sees
  // depth > 0 for the nested target and can return a distinct IRI.
  //
  // This test FAILS against the old `…, 0)` call and PASSES with `depth + 1`.

  void describe('annotated-edge nested-object target is minted at depth+1 (fix: was hardcoded 0)', () => {
    // Schemas for Citation -> cites -> Article with a confidence annotation.
    const ArticleSchema = {
      '$id': 'urn:test:Article',
      'properties': { 'title': { 'type': 'string' } },
      'required': ['title'],
      'type': 'object'
    } as const;

    const ConfidenceSchema = {
      '$id': 'urn:test:Confidence',
      'maximum': 1,
      'minimum': 0,
      'type': 'number'
    } as const;

    const CitesArticleEdge = Compose.annotatedEdge({
      'annotations': { 'confidence': { '$ref': 'urn:test:Confidence' } },
      'predicate': 'https://test.example/cites',
      'targetRef': 'urn:test:Article'
    });

    const CitationSchema = {
      '$id': 'urn:test:Citation',
      'properties': {
        'article': CitesArticleEdge,
        'citationId': { 'type': 'string' }
      },
      'required': ['citationId'],
      'type': 'object'
    } as const;

    const CITATION_GRAPH = 'https://test.example/graph/citations';
    const ROOT_IRI = 'https://test.example/instances/root-citation';
    const NESTED_IRI = 'https://test.example/instances/nested-article';

    // iriFor branches on depth: root instance gets ROOT_IRI, nested target gets NESTED_IRI.
    const depthGatedIriFor: SkolemizeFnType = (ctx) => {
      if (ctx.depth === 0) {
        return ROOT_IRI;
      }

      return NESTED_IRI;
    };

    function freshCitationJt(): ReturnType<typeof JsonTology.create> {
      const jt = JsonTology.create({
        'baseIRI': 'https://test.example',
        'enableStrictGraph': false
      });

      jt.set(ArticleSchema);
      jt.set(ConfidenceSchema);
      jt.set(CitationSchema);

      return jt;
    }

    void it('nested-object target receives depth+1 — base triple object is NESTED_IRI, not ROOT_IRI', () => {
      const jt = freshCitationJt();

      // The target is a NESTED OBJECT (no @id/id) — must be minted via iriFor.
      const instance = {
        'article': {
          'annotations': { 'confidence': 0.9 },
          'target': { 'title': 'Example Article' }
        },
        'citationId': 'cit-001'
      };

      const quads = jt.toQuads(CitationSchema, instance, {
        'graphIRI': CITATION_GRAPH,
        'iriFor': depthGatedIriFor
      });

      const baseTriples = quads.filter((quad) => {
        return quad.predicate.value === 'https://test.example/cites'
          && quad.subject.termType === 'NamedNode';
      });

      assert.equal(baseTriples.length, 1, 'exactly one base triple for the annotated edge');

      const baseTriple0Nested = baseTriples.at(0);

      if (baseTriple0Nested === undefined) {
        throw new Error('expected baseTriples[0] to exist');
      }
      const objectIri = baseTriple0Nested.object.value;

      // With the fix (depth+1): iriFor is called with depth>0 → returns NESTED_IRI.
      // Without the fix (depth 0): iriFor is called with depth===0 → returns ROOT_IRI.
      assert.equal(
        objectIri,
        NESTED_IRI,
        `base triple object must be the nested-target IRI (${NESTED_IRI}), not the root IRI (${ROOT_IRI})`
      );

      assert.notEqual(
        objectIri,
        ROOT_IRI,
        'base triple object must NOT collapse onto the root subject IRI'
      );
    });

    void it('string target on an annotated edge is returned verbatim (regression guard)', () => {
      const jt = freshCitationJt();

      const EXPLICIT_ARTICLE_IRI = 'urn:test:instances/article/well-known';
      const instance = {
        'article': {
          'annotations': { 'confidence': 0.8 },
          'target': EXPLICIT_ARTICLE_IRI
        },
        'citationId': 'cit-002'
      };

      const quads = jt.toQuads(CitationSchema, instance, {
        'graphIRI': CITATION_GRAPH,
        'iriFor': depthGatedIriFor
      });

      const baseTriples = quads.filter((quad) => {
        return quad.predicate.value === 'https://test.example/cites'
          && quad.subject.termType === 'NamedNode';
      });

      assert.equal(baseTriples.length, 1, 'exactly one base triple for the string-target edge');

      const baseTriple0String = baseTriples.at(0);

      if (baseTriple0String === undefined) {
        throw new Error('expected baseTriples[0] to exist');
      }
      // String targets bypass iriFor entirely; the literal IRI is used as-is.
      assert.equal(
        baseTriple0String.object.value,
        EXPLICIT_ARTICLE_IRI,
        'string target is passed through verbatim regardless of iriFor'
      );
    });
  });

  void it('every emitted predicate IRI (including triple-term annotation quads) has at most one #', () => {
    const jt = freshJt();
    const quads = jt.toQuads(ReviewSchema, reviewInstance, { 'graphIRI': REVIEWS_GRAPH });

    for (const quad of quads) {
      const predicate = quad.predicate.value;
      const firstHash = predicate.indexOf('#');

      if (firstHash !== -1) {
        assert.equal(
          predicate.indexOf('#', firstHash + 1),
          -1,
          `predicate IRI has more than one '#': ${predicate}`
        );
      }
    }
  });

  void it('x-jt-predicate binding on an annotation routes to the declared predicate IRI and round-trips', () => {
    const CustomRatingSchema = {
      '$id': 'urn:bookstore:CustomRating',
      'maximum': 5,
      'minimum': 1,
      'type': 'integer'
    } as const;

    const CustomEdge = Compose.annotatedEdge({
      'annotations': {
        'ratingValue': {
          '$ref': 'urn:bookstore:CustomRating',
          'x-jt-predicate': 'https://schema.org/ratingValue'
        }
      },
      'predicate': 'https://bookstore.example/reviews',
      'targetRef': 'urn:bookstore:Book'
    });

    const CustomReviewSchema = {
      '$id': 'urn:bookstore:CustomReview',
      'properties': {
        'book': CustomEdge,
        'reviewId': { 'type': 'string' }
      },
      'required': ['reviewId'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://bookstore.example',
      'enableStrictGraph': false
    });

    jt.set(BookSchema);
    jt.set(CustomRatingSchema);
    jt.set(CustomReviewSchema);

    const instance = {
      'book': {
        'annotations': { 'ratingValue': 4 },
        'target': BOOK_IRI
      },
      'reviewId': 'rev-002'
    };

    const quads = jt.toQuads(CustomReviewSchema, instance, { 'graphIRI': REVIEWS_GRAPH });

    const annotationQuads = quads.filter((quad) => {
      return isTripleTermSubject(quad);
    });

    assert.equal(annotationQuads.length, 1, 'one annotation quad for ratingValue');
    const annotationQuad0 = annotationQuads.at(0);

    if (annotationQuad0 === undefined) {
      throw new Error('expected annotationQuads[0] to exist');
    }
    assert.equal(
      annotationQuad0.predicate.value,
      'https://schema.org/ratingValue',
      'x-jt-predicate binding is honoured for annotation predicate'
    );

    // Round-trip: fromQuads must recover the annotation value
    const lifted = jt.fromQuads(CustomReviewSchema, quads);

    assert.equal(lifted.length, 1, 'one lifted instance');

    const liftedInstance = lifted[0];

    assert.ok(DataType.isRecord(liftedInstance), 'lifted instance is a record');

    const liftedEdge = liftedInstance.book;

    assert.ok(DataType.isRecord(liftedEdge), 'book edge present after round-trip');
    assert.equal(liftedEdge.target, BOOK_IRI);

    const liftedAnnotations = liftedEdge.annotations;

    assert.ok(DataType.isRecord(liftedAnnotations), 'annotations present after round-trip');
    assert.equal(liftedAnnotations.ratingValue, 4, 'ratingValue annotation survives round-trip');
  });

  // ---------------------------------------------------------------------------
  // Nested-object target (minter path)
  // Exercises resolveEdgeTargetIri branches where target is a record, covering
  // @id/@id bypass, IRI minting strategies, and the depth regression.
  // ---------------------------------------------------------------------------

  void describe('nested-object target (minter path)', () => {
    // Happy: @id present → bypasses minting entirely
    void it('@id field on record target bypasses minting and uses that IRI directly', () => {
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 4,
            'verifiedPurchase': false
          },
          'target': {
            '@id': BOOK_IRI,
            'title': 'Dune'
          }
        },
        'reviewId': 'rev-at-id'
      };

      const quads = jt.toQuads(ReviewSchema, instance, { 'graphIRI': REVIEWS_GRAPH });
      const baseTriple = quads.find((quad) => {
        return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
      });

      assert.ok(baseTriple, 'base triple emitted');
      assert.equal(baseTriple.object.value, BOOK_IRI, 'target IRI taken from @id field, not minted');
    });

    // Happy: id present → bypasses minting
    void it('id field on record target bypasses minting and uses that IRI directly', () => {
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 3,
            'verifiedPurchase': true
          },
          'target': { 'id': BOOK_IRI }
        },
        'reviewId': 'rev-id-field'
      };

      const quads = jt.toQuads(ReviewSchema, instance, { 'graphIRI': REVIEWS_GRAPH });
      const baseTriple = quads.find((quad) => {
        return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
      });

      assert.ok(baseTriple, 'base triple emitted');
      assert.equal(baseTriple.object.value, BOOK_IRI, 'target IRI taken from id field, not minted');
    });

    // Happy: @id round-trips through fromQuads as a string IRI
    void it('@id target round-trips through fromQuads as a string IRI', () => {
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 5,
            'verifiedPurchase': true
          },
          'target': {
            '@id': BOOK_IRI,
            'extra': 'ignored'
          }
        },
        'reviewId': 'rev-at-id-rt'
      };

      const quads = jt.toQuads(ReviewSchema, instance, { 'graphIRI': REVIEWS_GRAPH });
      const lifted = jt.fromQuads(ReviewSchema, quads);

      assert.equal(lifted.length, 1);

      const edge = (lifted[0] as Record<string, unknown>).book;

      assert.ok(DataType.isRecord(edge), 'edge present');
      assert.equal(edge.target, BOOK_IRI, 'target round-trips as string IRI');
    });

    // Happy: no @id/id → IRI minted from property value via Skolemize.fromProperty
    void it('mints target IRI from a property value via Skolemize.fromProperty', () => {
      const BASE = 'https://bookstore.example';
      const BOOK_TITLE = 'Dune';
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 5,
            'verifiedPurchase': true
          },
          'target': { 'title': BOOK_TITLE }
        },
        'reviewId': 'rev-from-prop'
      };

      const quads = jt.toQuads(ReviewSchema, instance, {
        'graphIRI': REVIEWS_GRAPH,
        'iriFor': Skolemize.fromProperty('title', { 'baseIRI': BASE })
      });
      const baseTriple = quads.find((quad) => {
        return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
      });

      assert.ok(baseTriple, 'base triple emitted');
      assert.ok(
        baseTriple.object.value.includes(encodeURIComponent(BOOK_TITLE)),
        `target IRI contains encoded title — got: ${baseTriple.object.value}`
      );
      assert.notEqual(
        baseTriple.subject.value,
        baseTriple.object.value,
        'root subject IRI and target IRI are distinct'
      );
    });

    // Happy: no @id/id → IRI minted via Skolemize.hash, distinct from root
    void it('mints target IRI via Skolemize.hash — distinct from root subject IRI', () => {
      const BASE = 'https://bookstore.example';
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 2,
            'verifiedPurchase': false
          },
          'target': {
            'isbn': '978-0-553-80371-0',
            'title': 'Foundation'
          }
        },
        'reviewId': 'rev-hash'
      };

      const quads = jt.toQuads(ReviewSchema, instance, {
        'graphIRI': REVIEWS_GRAPH,
        'iriFor': Skolemize.hash({ 'baseIRI': BASE })
      });
      const baseTriple = quads.find((quad) => {
        return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
      });

      assert.ok(baseTriple, 'base triple emitted');
      const targetIRI = baseTriple.object.value;

      // Verify the target IRI is scoped to BASE with a path separator, preventing
      // bare prefix matches like https://bookstore.example.other.com.
      assert.ok(
        targetIRI === BASE || targetIRI.startsWith(`${BASE}/`),
        `target IRI must be equal to or a path under baseIRI — got: ${targetIRI}`
      );
      assert.notEqual(baseTriple.subject.value, baseTriple.object.value, 'root and target IRIs are distinct');
    });

    // Regression: depth passed to iriFor must be ≥ 1 for nested object targets.
    // Before the fix, resolveEdgeTargetIri hardcoded depth: 0, so every nested
    // object target appeared to be the root — iriFor saw depth 0 for all objects.
    void it('passes depth ≥ 1 to iriFor for a nested object target (regression: was hardcoded 0)', () => {
      const jt = freshJt();
      const capturedDepths: number[] = [];
      const iriFor: SkolemizeFnType = (ctx) => {
        capturedDepths.push(ctx.depth);

        return;
      };

      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 5,
            'verifiedPurchase': true
          },
          'target': { 'title': 'The Left Hand of Darkness' }
        },
        'reviewId': 'rev-depth'
      };

      jt.toQuads(ReviewSchema, instance, {
        'graphIRI': REVIEWS_GRAPH,
        iriFor
      });

      assert.ok(
        capturedDepths.some((depth) => {
          return depth >= 1;
        }),
        `iriFor was never called with depth ≥ 1; depths seen: [${capturedDepths.join(', ')}]`
      );

      const nestedCalls = capturedDepths.filter((depth) => {
        return depth >= 1;
      });

      assert.equal(nestedCalls.length, 1, 'exactly one nested-target iriFor call');
    });

    // Regression (behavioural): a depth-sensitive iriFor must not collapse the
    // target IRI onto the root subject IRI. With depth hardcoded to 0, the
    // root-only strategy returned the same IRI for both, making the base triple
    // self-referential (subject === object).
    void it('target IRI does not collapse onto root subject IRI when iriFor is depth-sensitive', () => {
      const ROOT_IRI = 'https://bookstore.example/reviews/rev-depth-fix';
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {
            'ratingGiven': 5,
            'verifiedPurchase': true
          },
          'target': { 'title': 'The Name of the Wind' }
        },
        'reviewId': 'rev-depth-fix'
      };

      // Returns ROOT_IRI only at depth 0 (the root instance); returns undefined
      // for anything deeper, letting the default content-hash minter take over.
      const iriFor: SkolemizeFnType = (ctx) => {
        return ctx.depth === 0 ? ROOT_IRI : undefined;
      };

      const quads = jt.toQuads(ReviewSchema, instance, {
        'graphIRI': REVIEWS_GRAPH,
        iriFor
      });
      const baseTriple = quads.find((quad) => {
        return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
      });

      assert.ok(baseTriple, 'base triple emitted');
      assert.equal(baseTriple.subject.value, ROOT_IRI, 'root subject carries the depth-0 IRI');
      assert.notEqual(
        baseTriple.object.value,
        ROOT_IRI,
        'target IRI must not collapse onto root subject IRI'
      );
    });

    // Edge: two distinct nested object targets produce two distinct IRIs
    void it('two distinct nested object targets produce distinct minted IRIs', () => {
      const BASE = 'https://bookstore.example';
      const SecondEdge = Compose.annotatedEdge({
        'annotations': {
          'ratingGiven': { '$ref': 'urn:bookstore:RatingScore' },
          'verifiedPurchase': { '$ref': 'urn:bookstore:VerifiedPurchase' }
        },
        'predicate': 'https://bookstore.example/alsoReviews',
        'targetRef': 'urn:bookstore:Book'
      });

      const DualReviewSchema = {
        '$id': 'urn:bookstore:DualReview',
        'properties': {
          'book1': ReviewsBookEdge,
          'book2': SecondEdge,
          'reviewId': { 'type': 'string' }
        },
        'required': ['reviewId'],
        'type': 'object'
      } as const;

      const jt = JsonTology.create({
        'baseIRI': BASE,
        'enableStrictGraph': false
      });

      jt.set(BookSchema);
      jt.set(RatingScoreSchema);
      jt.set(VerifiedPurchaseSchema);
      jt.set(DualReviewSchema);

      const instance = {
        'book1': {
          'annotations': {
            'ratingGiven': 5,
            'verifiedPurchase': true
          },
          'target': { 'title': 'Dune' }
        },
        'book2': {
          'annotations': {
            'ratingGiven': 3,
            'verifiedPurchase': false
          },
          'target': { 'title': 'Foundation' }
        },
        'reviewId': 'rev-dual'
      };

      const quads = jt.toQuads(DualReviewSchema, instance, {
        'graphIRI': REVIEWS_GRAPH,
        'iriFor': Skolemize.fromProperty('title', { 'baseIRI': BASE })
      });

      const baseTriples = quads.filter((quad) => {
        return (
          quad.subject.termType === 'NamedNode'
          && (quad.predicate.value === 'https://bookstore.example/reviews'
            || quad.predicate.value === 'https://bookstore.example/alsoReviews')
        );
      });

      assert.equal(baseTriples.length, 2, 'two base triples emitted');

      const objectIris = baseTriples.map((quad) => {
        return quad.object.value;
      });

      assert.notEqual(objectIris[0], objectIris[1], 'distinct targets produce distinct IRIs');
    });

    // Edge: missing annotations object emits base triple only, no annotation quads
    void it('empty annotations object emits base triple only — no triple-term quads', () => {
      const jt = freshJt();
      const instance = {
        'book': {
          'annotations': {},
          'target': BOOK_IRI
        },
        'reviewId': 'rev-no-ann'
      };

      const quads = jt.toQuads(ReviewSchema, instance, { 'graphIRI': REVIEWS_GRAPH });

      const baseTriples = quads.filter((quad) => {
        return quad.predicate.value === EDGE_PREDICATE && quad.subject.termType === 'NamedNode';
      });
      const annotationQuads = quads.filter((quad) => {
        return quad.subject.termType === 'Quad';
      });

      assert.equal(baseTriples.length, 1, 'one base triple emitted');
      assert.equal(annotationQuads.length, 0, 'no triple-term quads when annotations is empty');
    });
  });
});
