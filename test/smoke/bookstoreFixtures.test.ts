import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  BookCatalogEntrySchema,
  BookListPageSchema,
  bookstoreEntities,
  CustomerSchema,
  EBookSchema,
  OrderSchema,
  PrintBookSchema,
  RareBookSchema,
  ReviewSchema,
  SequelSchema,
  SignedFirstEditionSchema,
  SimilarBookSchema
} from '../../examples/docs/bookstore/index.js';
import {
  aboxFixtures,
  NEVERENDING_BOOK_IRI
} from '../../examples/docs/bookstore/aboxFixtures.js';

const REVIEWS_GRAPH = 'https://bookstore.example/graph/reviews';

void describe('bookstore aboxFixtures', () => {
  // ── Existing fixtures ────────────────────────────────────────────────────

  void it('customer fixture validates against CustomerSchema', () => {
    const errs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

    assert.deepEqual([...errs], [], 'customer must validate');
  });

  void it('order fixture validates against OrderSchema (structural + invariant)', () => {
    const errs = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

    assert.deepEqual([...errs], [], 'order must validate (incl. orderTotalMatchesItems)');
  });

  void it('rareBook fixture validates against RareBookSchema', () => {
    const errs = bookstoreEntities.validate(RareBookSchema.$id, aboxFixtures.rareBook);

    assert.deepEqual([...errs], [], 'rareBook must validate');
  });

  void it('review fixture validates against ReviewSchema', () => {
    const errs = bookstoreEntities.validate(ReviewSchema.$id, aboxFixtures.review);

    assert.deepEqual([...errs], [], 'review must validate');
  });

  void it('tampered order total trips orderTotalMatchesItems invariant', () => {
    const tampered = {
      ...aboxFixtures.order,
      'orderTotal': {
        'amount': 999,
        'currency': 'USD'
      }
    };
    const errs = [...bookstoreEntities.validate(OrderSchema.$id, tampered)];

    const invariantErr = errs.find((err) => {
      return err.keyword === 'jt:invariant';
    });

    assert.ok(invariantErr, 'expected jt:invariant error in collection');
    assert.equal(
      invariantErr.params.invariant,
      'orderTotalMatchesItems'
    );
    assert.match(invariantErr.message, /does not equal/u);
  });

  // ── New fixtures (Task A) ────────────────────────────────────────────────

  void it('ebook fixture validates against EBookSchema', () => {
    const errs = bookstoreEntities.validate(EBookSchema.$id, aboxFixtures.ebook);

    assert.deepEqual([...errs], [], 'ebook must validate');
  });

  void it('printBook fixture validates against PrintBookSchema', () => {
    const errs = bookstoreEntities.validate(PrintBookSchema.$id, aboxFixtures.printBook);

    assert.deepEqual([...errs], [], 'printBook must validate');
  });

  void it('signedFirstEdition fixture validates against SignedFirstEditionSchema (incl. solo-author invariant)', () => {
    const errs = bookstoreEntities.validate(
      SignedFirstEditionSchema.$id,
      aboxFixtures.signedFirstEdition
    );

    assert.deepEqual([...errs], [], 'signedFirstEdition must validate');
  });

  void it('similarBook fixture validates against SimilarBookSchema', () => {
    const errs = bookstoreEntities.validate(SimilarBookSchema.$id, aboxFixtures.similarBook);

    assert.deepEqual([...errs], [], 'similarBook must validate');
  });

  void it('sequel fixture validates against SequelSchema', () => {
    const errs = bookstoreEntities.validate(SequelSchema.$id, aboxFixtures.sequel);

    assert.deepEqual([...errs], [], 'sequel must validate');
  });

  void it('bookListPage fixture validates against BookListPageSchema', () => {
    const errs = bookstoreEntities.validate(BookListPageSchema.$id, aboxFixtures.bookListPage);

    assert.deepEqual([...errs], [], 'bookListPage must validate');
  });

  void it('bookCatalogEntry fixture validates against BookCatalogEntrySchema', () => {
    const errs = bookstoreEntities.validate(
      BookCatalogEntrySchema.$id,
      aboxFixtures.bookCatalogEntry
    );

    assert.deepEqual([...errs], [], 'bookCatalogEntry must validate');
  });

  void it('bookCatalogEntryWithVariant fixture validates against BookCatalogEntrySchema', () => {
    const errs = bookstoreEntities.validate(
      BookCatalogEntrySchema.$id,
      aboxFixtures.bookCatalogEntryWithVariant
    );

    assert.deepEqual([...errs], [], 'bookCatalogEntryWithVariant must validate');
  });

  // ── Task B: reviewWithAnnotatedEdge (jt:annotatedEdge) ──────────────────

  void it('reviewWithAnnotatedEdge fixture validates against ReviewSchema', () => {
    const errs = bookstoreEntities.validate(
      ReviewSchema.$id,
      aboxFixtures.reviewWithAnnotatedEdge
    );

    assert.deepEqual([...errs], [], 'reviewWithAnnotatedEdge must validate');
  });

  void it('reviewWithAnnotatedEdge: toQuads emits base triple + 2 annotation quads with grounded predicates', () => {
    // Use instantiate to get a typed value before passing to toQuads.
    const validated = bookstoreEntities.instantiate(
      ReviewSchema,
      aboxFixtures.reviewWithAnnotatedEdge
    );
    const quads = bookstoreEntities.toQuads(
      ReviewSchema,
      validated,
      { 'graphIRI': REVIEWS_GRAPH }
    );

    const EDGE_PREDICATE = 'https://bookstore.example/reviews';

    const baseTriples = quads.filter((quad) => {
      return quad.predicate.value === EDGE_PREDICATE
        && quad.subject.termType === 'NamedNode';
    });

    assert.equal(baseTriples.length, 1, 'one base triple for the reviews edge');

    const baseTriple = baseTriples.at(0);

    if (baseTriple === undefined) {
      throw new Error('baseTriples[0] is undefined');
    }

    assert.equal(baseTriple.object.value, NEVERENDING_BOOK_IRI, 'target is the book IRI');

    const annotationQuads = quads.filter((quad) => {
      return quad.subject.termType === 'Quad';
    });

    assert.equal(annotationQuads.length, 2, 'two annotation (triple-term) quads: ratingGiven + verifiedPurchase');

    const ratingAnnotation = annotationQuads.find((quad) => {
      return quad.predicate.value === 'https://schema.org/ratingValue';
    });

    assert.ok(ratingAnnotation, 'ratingGiven annotation uses grounded schema.org/ratingValue predicate');
    assert.equal(ratingAnnotation.object.value, '5', 'ratingGiven annotation value is 5');

    const verifiedAnnotation = annotationQuads.find((quad) => {
      return quad.predicate.value === 'https://schema.org/verified';
    });

    assert.ok(verifiedAnnotation, 'verifiedPurchase annotation uses grounded schema.org/verified predicate');
    assert.equal(verifiedAnnotation.object.value, 'true', 'verifiedPurchase annotation value is true');
  });

  // ── Task D: ABox round-trips ─────────────────────────────────────────────
  // toQuads → fromQuads must reconstruct the key scalar fields.
  // Date-typed fields (publishedOn: format 'date') are decoded to Date
  // objects by Lift, not strings, so they are excluded from assertions.
  // Use instantiate first to get a correctly-typed value for toQuads.

  void it('ebook round-trips through toQuads → fromQuads', () => {
    // EBook carries an if/then conditional (fileFormat: 'epub' → requires
    // epubVersion). instantiate, toQuads, and fromQuads all preserve the
    // conditional-branch property `epubVersion` through the round-trip.
    const validated = bookstoreEntities.instantiate(EBookSchema, aboxFixtures.ebook);
    const quads = bookstoreEntities.toQuads(EBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(EBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one ebook lifted');

    const liftedEbook = lifted.at(0);

    if (liftedEbook === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedEbook.title, aboxFixtures.ebook.title, 'title preserved');
    assert.equal(liftedEbook.fileFormat, aboxFixtures.ebook.fileFormat, 'fileFormat preserved');
    assert.equal(
      liftedEbook.fileSizeBytes,
      aboxFixtures.ebook.fileSizeBytes,
      'fileSizeBytes preserved'
    );
    // epubVersion lives under the then-branch; it must survive the round-trip.
    // `in` narrows the discriminated union to the epub (then-branch) member.
    assert.ok(
      'epubVersion' in liftedEbook,
      'lifted ebook carries the conditional then-branch property epubVersion'
    );
    assert.equal(
      liftedEbook.epubVersion,
      aboxFixtures.ebook.epubVersion,
      'epubVersion (conditional then-branch property) preserved'
    );
    // downloadUrl is emitted as a NamedNode (x-jt-iriRef: true) and lifted back
    // as a string IRI.
    assert.equal(
      liftedEbook.downloadUrl,
      aboxFixtures.ebook.downloadUrl,
      'downloadUrl (iri-ref) preserved'
    );
  });

  void it('printBook round-trips through toQuads → fromQuads', () => {
    const validated = bookstoreEntities.instantiate(PrintBookSchema, aboxFixtures.printBook);
    const quads = bookstoreEntities.toQuads(PrintBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(PrintBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one printBook lifted');

    const liftedPrintBook = lifted.at(0);

    if (liftedPrintBook === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedPrintBook.title, aboxFixtures.printBook.title, 'title preserved');
    assert.equal(liftedPrintBook.binding, aboxFixtures.printBook.binding, 'binding preserved');
    assert.equal(liftedPrintBook.pageCount, aboxFixtures.printBook.pageCount, 'pageCount preserved');
  });

  void it('signedFirstEdition: provenance literal has x-jt-language de tag in quads', () => {
    const validated = bookstoreEntities.instantiate(
      SignedFirstEditionSchema,
      aboxFixtures.signedFirstEdition
    );
    const quads = bookstoreEntities.toQuads(SignedFirstEditionSchema, validated);

    // Find the quad whose object value matches the provenance text
    const provenanceQuad = quads.find((quad) => {
      return quad.object.value === aboxFixtures.signedFirstEdition.provenance;
    });

    assert.ok(provenanceQuad, 'provenance quad emitted');
    assert.equal(
      provenanceQuad.object.termType,
      'Literal',
      'provenance is a Literal'
    );
    // The Literal must carry a language tag (@de) from x-jt-language: 'de'.
    assert.equal(
      (provenanceQuad.object as { 'language': string }).language,
      'de',
      'provenance literal carries @de language tag'
    );
  });

  void it('ebook: downloadUrl quad is emitted as a NamedNode (x-jt-iriRef)', () => {
    const validated = bookstoreEntities.instantiate(EBookSchema, aboxFixtures.ebook);
    const quads = bookstoreEntities.toQuads(EBookSchema, validated);

    const downloadQuad = quads.find((quad) => {
      return quad.object.value === aboxFixtures.ebook.downloadUrl;
    });

    assert.ok(downloadQuad, 'downloadUrl quad emitted');
    assert.equal(
      downloadQuad.object.termType,
      'NamedNode',
      'downloadUrl emitted as NamedNode (x-jt-iriRef: true)'
    );
  });
});
