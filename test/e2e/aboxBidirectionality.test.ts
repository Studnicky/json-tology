/**
 * ABox bi-directionality e2e test: instance ⇄ quads.
 *
 * For every fixture in `aboxFixtures`, exercises the full
 *   instantiate → toQuads → fromQuads
 * round-trip and asserts the output matches the input (modulo the
 * documented non-reconstructable fields listed below).
 *
 * Call shape mirrors the proven sites in
 *   test/smoke/bookstoreFixtures.test.ts and
 *   test/e2e/ontologyRoundTrip.test.ts:
 *     instantiate(SchemaObject, fixture) → typed value
 *     toQuads(SchemaObject, value, opts) → QuadInterface[]
 *     fromQuads(SchemaObject.$id, quads) → typed[]
 *
 * Temporal + decimal round-trip:
 *   - `placedAt` / `postedAt` (Iso8601 / xsd:dateTime) and `publishedOn`
 *     (PublicationDate / xsd:date) lift back to their original lexical ISO
 *     strings (not Date objects), passing the schema's format validator.
 *   - Nested Money (`amount` xsd:decimal → number, `currency` enum → string)
 *     round-trips; a Money node shared by two parent properties deduplicates
 *     to a single scalar rather than a spurious array.
 *
 * Non-reconstructable fields (documented limitations, NOT failures here):
 *   - `reviewWithAnnotatedEdge.reviewsBook`: RDF-star annotated edges are
 *     projected (base triple + triple-term annotation quad) but fromQuads does
 *     not lift them back to the `reviewsBook` field — write-only today.
 *
 * ABox-projection hint coverage:
 *   B-1  Customer scalars + nested addresses + flat customerId predicate
 *   B-2  Order quads (customerId flat, placedAt xsd:dateTime) + OrderLine RT
 *   B-3  Review quads (flat customerId, postedAt, rating) — full round-trip
 *   B-4  EBook iri-ref → NamedNode + full round-trip
 *   B-5  PrintBook full scalar round-trip
 *   B-6  RareBook full round-trip (publishedOn xsd:date → lexical string)
 *   B-7  SignedFirstEdition language-tagged literal + round-trip
 *   B-8  SimilarBook (symmetric) round-trip
 *   B-9  Sequel (asymmetric) round-trip
 *   B-10 BookListPage pagination round-trip
 *   B-11 reviewWithAnnotatedEdge RDF-star edge in quad stream
 *   B-12 flat shared predicate disambiguation by subject rdf:type
 *   B-13 CURIE predicate expansion (rdf:type → full IRI)
 *   B-14 BookCatalogEntry embedded-$id projection round-trip (variants array)
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  aboxFixtures,
  BookCatalogEntrySchema,
  BookListPageSchema,
  bookstoreEntities,
  CustomerSchema,
  EBookSchema,
  OrderLineSchema,
  OrderSchema,
  PrintBookSchema,
  RareBookSchema,
  ReviewSchema,
  SequelSchema,
  SignedFirstEditionSchema,
  SimilarBookSchema
} from '../../examples/docs/bookstore/index.js';

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const FLAT_CUSTOMER_ID = 'https://bookstore.example/customerId';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD_DATETIME = 'http://www.w3.org/2001/XMLSchema#dateTime';
const XSD_INTEGER = 'http://www.w3.org/2001/XMLSchema#integer';

// The embedded `$id` ref is resolved at runtime by the same-graph node scan
// (B-14), but compile-time InferType cannot follow a `$ref` to an embedded
// `$defs` `$id` (a separate, pre-existing type-derivation limitation), so a
// lifted variant statically types as ReferenceNotFoundType. Read its runtime
// fields through this narrowing guard rather than a cast.
function readVariant(variant: unknown): { 'kind': unknown;
  'variantPrice': unknown } {
  if (typeof variant !== 'object' || variant === null) {
    return {
      'kind': undefined,
      'variantPrice': undefined
    };
  }

  const record: Record<string, unknown> = { ...variant };

  return {
    'kind': record.kind,
    'variantPrice': record.variantPrice
  };
}

// ---------------------------------------------------------------------------
// B-1: Customer
// ---------------------------------------------------------------------------

void describe('B-1: Customer toQuads → fromQuads', () => {
  void it('scalar properties + nested addresses round-trip', () => {
    const validated = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);
    const quads = bookstoreEntities.toQuads(CustomerSchema, validated);
    const lifted = bookstoreEntities.fromQuads(CustomerSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one customer lifted');

    const output = lifted.at(0);

    if (output === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(output.customerId, aboxFixtures.customer.customerId, 'customerId round-trips');
    assert.equal(output.email, aboxFixtures.customer.email, 'email round-trips');
    assert.equal(output.name, aboxFixtures.customer.name, 'name round-trips');

    const addresses = output.addresses;

    assert.ok(addresses !== undefined, 'addresses present after round-trip');
    assert.equal(addresses.length, 1, 'one address round-trips');

    const roundTrippedAddress = addresses.at(0);

    if (roundTrippedAddress === undefined) {
      throw new Error('addresses[0] is undefined');
    }

    const expected = aboxFixtures.customer.addresses.at(0);

    if (expected === undefined) {
      throw new Error('aboxFixtures.customer.addresses[0] is undefined');
    }

    assert.equal(roundTrippedAddress.street, expected.street, 'address.street round-trips');
    assert.equal(roundTrippedAddress.city, expected.city, 'address.city round-trips');
    assert.equal(roundTrippedAddress.country, expected.country, 'address.country round-trips');
    assert.equal(roundTrippedAddress.postalCode, expected.postalCode, 'address.postalCode round-trips');
  });

  void it('customerId emits with the flat predicate IRI (not class-scoped)', () => {
    const validated = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);
    const quads = bookstoreEntities.toQuads(CustomerSchema, validated);

    const custIdQuad = quads.find((quad) => {
      return quad.predicate.value === FLAT_CUSTOMER_ID;
    });

    assert.ok(custIdQuad, `customerId must emit with predicate ${FLAT_CUSTOMER_ID}`);
    assert.equal(custIdQuad.object.value, aboxFixtures.customer.customerId, 'customerId value correct');

    const classScoped = quads.filter((quad) => {
      return quad.predicate.value.includes('#customerId');
    });

    assert.equal(classScoped.length, 0, 'no class-scoped customerId predicate emitted');
  });
});

// ---------------------------------------------------------------------------
// B-2: Order
// ---------------------------------------------------------------------------

void describe('B-2: Order toQuads → fromQuads', () => {
  void it('Order quads carry customerId as the flat predicate IRI', () => {
    const validated = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
    const quads = bookstoreEntities.toQuads(OrderSchema, validated);

    const custIdQuad = quads.find((quad) => {
      return quad.predicate.value === FLAT_CUSTOMER_ID;
    });

    assert.ok(custIdQuad, `Order.customerId must emit with flat predicate ${FLAT_CUSTOMER_ID}`);
    assert.equal(custIdQuad.object.value, aboxFixtures.order.customerId, 'customerId value correct');
  });

  void it('Order quads carry orderId and a xsd:dateTime placedAt literal', () => {
    const validated = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
    const quads = bookstoreEntities.toQuads(OrderSchema, validated);

    const orderIdQuad = quads.find((quad) => {
      return quad.predicate.value === 'https://bookstore.example/orderId';
    });

    assert.ok(orderIdQuad, 'orderId quad present');
    assert.equal(orderIdQuad.object.value, aboxFixtures.order.orderId, 'orderId value round-trips');
    assert.equal(orderIdQuad.object.termType, 'Literal', 'orderId emitted as Literal');

    const placedAtQuad = quads.find((quad) => {
      return quad.predicate.value === 'https://bookstore.example/placedAt';
    });

    assert.ok(placedAtQuad, 'placedAt quad present');
    assert.equal(placedAtQuad.object.termType, 'Literal', 'placedAt is a Literal');
    assert.equal(
      (placedAtQuad.object as { 'datatype': { 'value': string } }).datatype.value,
      XSD_DATETIME,
      'placedAt emitted as xsd:dateTime'
    );
    assert.equal(placedAtQuad.object.value, aboxFixtures.order.placedAt, 'placedAt value preserved in quad');
  });

  void it('OrderLine round-trips through toQuads → fromQuads', () => {
    const input = aboxFixtures.order.orderLines[0];
    const validated = bookstoreEntities.instantiate(OrderLineSchema, input);
    const quads = bookstoreEntities.toQuads(OrderLineSchema, validated);
    const lifted = bookstoreEntities.fromQuads(OrderLineSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one orderLine lifted');

    const liftedLine = lifted.at(0);

    if (liftedLine === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(typeof liftedLine.bookIsbn, 'string', 'bookIsbn is a string after round-trip');
    assert.equal(liftedLine.bookIsbn, input.bookIsbn, 'bookIsbn round-trips');
    assert.equal(typeof liftedLine.quantity, 'number', 'quantity is a number after round-trip');
    assert.equal(liftedLine.quantity, input.quantity, 'quantity round-trips');
  });

  void it('full Order fromQuads losslessly reconstructs date-time + nested Money', () => {
    // Order.placedAt (xsd:dateTime) lifts back to its original ISO string;
    // nested Money.amount (xsd:decimal) lifts to a number and Money.currency
    // (enum) to its string value. The shared Money node referenced by both
    // orderTotal and unitPrice deduplicates to a single scalar (not an array),
    // so the full Order round-trips through fromQuads' instantiate() step.
    const validated = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
    const quads = bookstoreEntities.toQuads(OrderSchema, validated);
    const lifted = bookstoreEntities.fromQuads(OrderSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one order lifted');

    const output = lifted.at(0);

    if (output === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(output.orderId, aboxFixtures.order.orderId, 'orderId round-trips');
    assert.equal(output.customerId, aboxFixtures.order.customerId, 'customerId round-trips');
    assert.equal(
      output.placedAt,
      aboxFixtures.order.placedAt,
      'placedAt round-trips as the original ISO date-time string (not a Date)'
    );

    assert.deepEqual(
      output.orderTotal,
      {
        'amount': aboxFixtures.order.orderTotal.amount,
        'currency': aboxFixtures.order.orderTotal.currency
      },
      'orderTotal Money round-trips: amount as number, currency as enum string'
    );

    const orderLines = output.orderLines;

    assert.equal(orderLines.length, 1, 'one orderLine round-trips');

    const firstOrderLine = orderLines.at(0);

    if (firstOrderLine === undefined) {
      throw new Error('orderLines[0] is undefined');
    }

    const firstFixtureOrderLine = aboxFixtures.order.orderLines.at(0);

    if (firstFixtureOrderLine === undefined) {
      throw new Error('aboxFixtures.order.orderLines[0] is undefined');
    }

    assert.equal(firstOrderLine.bookIsbn, firstFixtureOrderLine.bookIsbn, 'orderLine.bookIsbn round-trips');
    assert.equal(firstOrderLine.quantity, firstFixtureOrderLine.quantity, 'orderLine.quantity round-trips');
    assert.deepEqual(
      firstOrderLine.unitPrice,
      {
        'amount': firstFixtureOrderLine.unitPrice.amount,
        'currency': firstFixtureOrderLine.unitPrice.currency
      },
      'orderLine.unitPrice Money round-trips: amount number + currency enum'
    );

    const shippingAddress = output.shippingAddress;

    assert.equal(shippingAddress.street, aboxFixtures.order.shippingAddress.street, 'shippingAddress.street round-trips');
    assert.equal(shippingAddress.city, aboxFixtures.order.shippingAddress.city, 'shippingAddress.city round-trips');
    assert.equal(shippingAddress.country, aboxFixtures.order.shippingAddress.country, 'shippingAddress.country round-trips');
    assert.equal(
      shippingAddress.postalCode,
      aboxFixtures.order.shippingAddress.postalCode,
      'shippingAddress.postalCode round-trips'
    );
  });
});

// ---------------------------------------------------------------------------
// B-3: Review
// ---------------------------------------------------------------------------

void describe('B-3: Review toQuads → fromQuads', () => {
  void it('Review quads carry all scalar predicates with correct values', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.review);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated);

    const predMap = new Map(quads.map((quad) => {
      return [
        quad.predicate.value.replace('https://bookstore.example/', ''),
        quad.object.value
      ];
    }));

    assert.equal(predMap.get('reviewId'), aboxFixtures.review.reviewId, 'reviewId quad present');
    assert.equal(predMap.get('bookIsbn'), aboxFixtures.review.bookIsbn, 'bookIsbn quad present');
    assert.equal(predMap.get('customerId'), aboxFixtures.review.customerId, 'customerId quad present (flat)');
    assert.equal(Number(predMap.get('rating')), aboxFixtures.review.rating, 'rating quad present');
  });

  void it('Review.customerId uses the flat predicate IRI (not class-scoped)', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.review);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated);

    const flatCustId = quads.find((quad) => {
      return quad.predicate.value === FLAT_CUSTOMER_ID;
    });

    assert.ok(flatCustId, `Review.customerId must use flat predicate ${FLAT_CUSTOMER_ID}`);

    const classScoped = quads.filter((quad) => {
      return quad.predicate.value.includes('#customerId');
    });

    assert.equal(classScoped.length, 0, 'no class-scoped customerId predicate emitted by Review');
  });

  void it('Review.rating emits as xsd:integer literal', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.review);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated);

    const ratingQuad = quads.find((quad) => {
      return quad.predicate.value === 'https://bookstore.example/rating';
    });

    assert.ok(ratingQuad, 'rating quad present');
    assert.equal(ratingQuad.object.termType, 'Literal', 'rating is a Literal');
    assert.equal(
      (ratingQuad.object as { 'datatype': { 'value': string } }).datatype.value,
      XSD_INTEGER,
      'rating emitted as xsd:integer'
    );
    assert.equal(Number(ratingQuad.object.value), 5, 'rating value is 5');
  });

  void it('Review.postedAt emits a xsd:dateTime literal (value preserved in quad)', () => {
    // postedAt round-trips both as a quad VALUE and back through fromQuads —
    // Lift returns the original ISO lexical string, which passes the
    // format:"date-time" validator. Asserted at quad level here; the full
    // object round-trip is asserted below.
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.review);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated);

    const postedAtQuad = quads.find((quad) => {
      return quad.predicate.value === 'https://bookstore.example/postedAt';
    });

    assert.ok(postedAtQuad, 'postedAt quad present');
    assert.equal(
      (postedAtQuad.object as { 'datatype': { 'value': string } }).datatype.value,
      XSD_DATETIME,
      'postedAt emitted as xsd:dateTime'
    );
    assert.equal(postedAtQuad.object.value, aboxFixtures.review.postedAt, 'postedAt value preserved in quad');
  });

  void it('full Review fromQuads losslessly reconstructs the date-time postedAt', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.review);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated);
    const lifted = bookstoreEntities.fromQuads(ReviewSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one review lifted');

    const output = lifted.at(0);

    if (output === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(output.reviewId, aboxFixtures.review.reviewId, 'reviewId round-trips');
    assert.equal(output.bookIsbn, aboxFixtures.review.bookIsbn, 'bookIsbn round-trips');
    assert.equal(output.customerId, aboxFixtures.review.customerId, 'customerId round-trips');
    assert.equal(output.body, aboxFixtures.review.body, 'body round-trips');
    assert.equal(output.rating, aboxFixtures.review.rating, 'rating round-trips as a number');
    assert.equal(
      output.postedAt,
      aboxFixtures.review.postedAt,
      'postedAt round-trips as the original ISO date-time string (not a Date)'
    );
  });
});

// ---------------------------------------------------------------------------
// B-4: EBook — iri-ref NamedNode
// ---------------------------------------------------------------------------

void describe('B-4: EBook — iri-ref NamedNode and round-trip', () => {
  void it('downloadUrl emits as a NamedNode (x-jt-iriRef: true)', () => {
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

  void it('EBook round-trips through toQuads → fromQuads', () => {
    const validated = bookstoreEntities.instantiate(EBookSchema, aboxFixtures.ebook);
    const quads = bookstoreEntities.toQuads(EBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(EBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one ebook lifted');

    const liftedEbook = lifted.at(0);

    if (liftedEbook === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedEbook.isbn, aboxFixtures.ebook.isbn, 'isbn round-trips');
    assert.equal(liftedEbook.title, aboxFixtures.ebook.title, 'title round-trips');
    assert.equal(liftedEbook.fileFormat, aboxFixtures.ebook.fileFormat, 'fileFormat round-trips');
    assert.equal(liftedEbook.fileSizeBytes, aboxFixtures.ebook.fileSizeBytes, 'fileSizeBytes round-trips');
    assert.equal(liftedEbook.downloadUrl, aboxFixtures.ebook.downloadUrl, 'downloadUrl (iri-ref) round-trips');
    assert.ok('epubVersion' in liftedEbook, 'conditional then-branch property epubVersion present');
    assert.equal(liftedEbook.epubVersion, aboxFixtures.ebook.epubVersion, 'epubVersion round-trips');
  });
});

// ---------------------------------------------------------------------------
// B-5: PrintBook
// ---------------------------------------------------------------------------

void describe('B-5: PrintBook toQuads → fromQuads', () => {
  void it('PrintBook round-trips all scalar properties', () => {
    const validated = bookstoreEntities.instantiate(PrintBookSchema, aboxFixtures.printBook);
    const quads = bookstoreEntities.toQuads(PrintBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(PrintBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one printBook lifted');

    const liftedPrintBook = lifted.at(0);

    if (liftedPrintBook === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedPrintBook.isbn, aboxFixtures.printBook.isbn, 'isbn round-trips');
    assert.equal(liftedPrintBook.title, aboxFixtures.printBook.title, 'title round-trips');
    assert.equal(liftedPrintBook.binding, aboxFixtures.printBook.binding, 'binding round-trips');
    assert.equal(liftedPrintBook.pageCount, aboxFixtures.printBook.pageCount, 'pageCount round-trips');
    assert.equal(liftedPrintBook.weightGrams, aboxFixtures.printBook.weightGrams, 'weightGrams round-trips');
    assert.equal(liftedPrintBook.printStatus, aboxFixtures.printBook.printStatus, 'printStatus round-trips');
    assert.deepEqual(liftedPrintBook.authors, [...aboxFixtures.printBook.authors], 'authors array round-trips');
  });
});

// ---------------------------------------------------------------------------
// B-6: RareBook — full round-trip incl. publishedOn (xsd:date → lexical string)
// ---------------------------------------------------------------------------

void describe('B-6: RareBook toQuads → fromQuads', () => {
  void it('RareBook scalar properties round-trip (including publishedOn)', () => {
    const validated = bookstoreEntities.instantiate(RareBookSchema, aboxFixtures.rareBook);
    const quads = bookstoreEntities.toQuads(RareBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(RareBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one rareBook lifted');

    const liftedRareBook = lifted.at(0);

    if (liftedRareBook === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedRareBook.isbn, aboxFixtures.rareBook.isbn, 'isbn round-trips');
    assert.equal(liftedRareBook.title, aboxFixtures.rareBook.title, 'title round-trips');
    assert.equal(liftedRareBook.binding, aboxFixtures.rareBook.binding, 'binding round-trips');
    assert.equal(liftedRareBook.pageCount, aboxFixtures.rareBook.pageCount, 'pageCount round-trips');
    assert.equal(liftedRareBook.weightGrams, aboxFixtures.rareBook.weightGrams, 'weightGrams round-trips');
    assert.equal(liftedRareBook.printStatus, aboxFixtures.rareBook.printStatus, 'printStatus round-trips');
    assert.equal(liftedRareBook.firstEditionYear, aboxFixtures.rareBook.firstEditionYear, 'firstEditionYear round-trips');
    assert.equal(liftedRareBook.estimatedAgeYears, aboxFixtures.rareBook.estimatedAgeYears, 'estimatedAgeYears round-trips');
    assert.equal(liftedRareBook.inStock, aboxFixtures.rareBook.inStock, 'inStock round-trips');
    assert.equal(liftedRareBook.stockLevel, aboxFixtures.rareBook.stockLevel, 'stockLevel round-trips');
  });

  void it('RareBook.publishedOn (xsd:date) lifts back to the exact lexical date string', () => {
    // publishedOn (PublicationDate / xsd:date, format:"date") lifts back to its
    // original lexical value '1979-09-01' — NOT a reformatted Date ISO string
    // like '1979-09-01T00:00:00.000Z' — so it passes the format:"date" validator
    // inside fromQuads' instantiate() step.
    const validated = bookstoreEntities.instantiate(RareBookSchema, aboxFixtures.rareBook);
    const quads = bookstoreEntities.toQuads(RareBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(RareBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one rareBook lifted');

    const liftedRareBookForDate = lifted.at(0);

    if (liftedRareBookForDate === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(
      liftedRareBookForDate.publishedOn,
      aboxFixtures.rareBook.publishedOn,
      'publishedOn round-trips as the exact lexical date string'
    );
  });
});

// ---------------------------------------------------------------------------
// B-7: SignedFirstEdition — language-tagged literal
// ---------------------------------------------------------------------------

void describe('B-7: SignedFirstEdition — language-tagged literal and round-trip', () => {
  void it('provenance emits as a langString with @de tag (x-jt-language: de)', () => {
    const validated = bookstoreEntities.instantiate(SignedFirstEditionSchema, aboxFixtures.signedFirstEdition);
    const quads = bookstoreEntities.toQuads(SignedFirstEditionSchema, validated);

    const provenanceQuad = quads.find((quad) => {
      return quad.object.value === aboxFixtures.signedFirstEdition.provenance;
    });

    assert.ok(provenanceQuad, 'provenance quad emitted');
    assert.equal(provenanceQuad.object.termType, 'Literal', 'provenance is a Literal');
    assert.equal(
      (provenanceQuad.object as { 'language': string }).language,
      'de',
      'provenance literal carries @de language tag'
    );
  });

  void it('SignedFirstEdition round-trips through toQuads → fromQuads', () => {
    const validated = bookstoreEntities.instantiate(SignedFirstEditionSchema, aboxFixtures.signedFirstEdition);
    const quads = bookstoreEntities.toQuads(SignedFirstEditionSchema, validated);
    const lifted = bookstoreEntities.fromQuads(SignedFirstEditionSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one signedFirstEdition lifted');

    const liftedSfe = lifted.at(0);

    if (liftedSfe === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedSfe.isbn, aboxFixtures.signedFirstEdition.isbn, 'isbn round-trips');
    assert.equal(liftedSfe.signedBy, aboxFixtures.signedFirstEdition.signedBy, 'signedBy round-trips');
    assert.equal(liftedSfe.provenance, aboxFixtures.signedFirstEdition.provenance, 'provenance (lang-tagged) round-trips');
    assert.equal(liftedSfe.firstEditionYear, aboxFixtures.signedFirstEdition.firstEditionYear, 'firstEditionYear round-trips');
    assert.equal(liftedSfe.binding, aboxFixtures.signedFirstEdition.binding, 'binding round-trips');
  });
});

// ---------------------------------------------------------------------------
// B-8: SimilarBook (symmetric)
// ---------------------------------------------------------------------------

void describe('B-8: SimilarBook toQuads → fromQuads', () => {
  void it('SimilarBook round-trips both books (a and b)', () => {
    const validated = bookstoreEntities.instantiate(SimilarBookSchema, aboxFixtures.similarBook);
    const quads = bookstoreEntities.toQuads(SimilarBookSchema, validated);
    const lifted = bookstoreEntities.fromQuads(SimilarBookSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one similarBook lifted');

    const liftedSimilarBook = lifted.at(0);

    if (liftedSimilarBook === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    const bookA = liftedSimilarBook.a;
    const bookB = liftedSimilarBook.b;

    assert.equal(bookA.isbn, aboxFixtures.similarBook.a.isbn, 'a.isbn round-trips');
    assert.equal(bookA.title, aboxFixtures.similarBook.a.title, 'a.title round-trips');
    assert.equal(bookB.isbn, aboxFixtures.similarBook.b.isbn, 'b.isbn round-trips');
    assert.equal(bookB.title, aboxFixtures.similarBook.b.title, 'b.title round-trips');
  });
});

// ---------------------------------------------------------------------------
// B-9: Sequel (asymmetric)
// ---------------------------------------------------------------------------

void describe('B-9: Sequel toQuads → fromQuads', () => {
  void it('Sequel round-trips book and predecessor', () => {
    const validated = bookstoreEntities.instantiate(SequelSchema, aboxFixtures.sequel);
    const quads = bookstoreEntities.toQuads(SequelSchema, validated);
    const lifted = bookstoreEntities.fromQuads(SequelSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one sequel lifted');

    const liftedSequel = lifted.at(0);

    if (liftedSequel === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    const book = liftedSequel.book;
    const predecessor = liftedSequel.predecessor;

    assert.equal(book.isbn, aboxFixtures.sequel.book.isbn, 'book.isbn round-trips');
    assert.equal(book.title, aboxFixtures.sequel.book.title, 'book.title round-trips');
    assert.equal(predecessor.isbn, aboxFixtures.sequel.predecessor.isbn, 'predecessor.isbn round-trips');
    assert.equal(predecessor.title, aboxFixtures.sequel.predecessor.title, 'predecessor.title round-trips');
  });
});

// ---------------------------------------------------------------------------
// B-10: BookListPage
// ---------------------------------------------------------------------------

void describe('B-10: BookListPage toQuads → fromQuads', () => {
  void it('BookListPage pagination properties round-trip', () => {
    const validated = bookstoreEntities.instantiate(BookListPageSchema, aboxFixtures.bookListPage);
    const quads = bookstoreEntities.toQuads(BookListPageSchema, validated);
    const lifted = bookstoreEntities.fromQuads(BookListPageSchema.$id, quads);

    assert.equal(lifted.length, 1, 'one bookListPage lifted');

    const liftedPage = lifted.at(0);

    if (liftedPage === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(liftedPage.resultCount, aboxFixtures.bookListPage.resultCount, 'resultCount round-trips');
    assert.equal(liftedPage.page, aboxFixtures.bookListPage.page, 'page round-trips');
    assert.equal(liftedPage.pageSize, aboxFixtures.bookListPage.pageSize, 'pageSize round-trips');
    assert.equal(liftedPage.totalPages, aboxFixtures.bookListPage.totalPages, 'totalPages round-trips');
    assert.equal(liftedPage.hasNext, aboxFixtures.bookListPage.hasNext, 'hasNext round-trips');
    assert.equal(liftedPage.hasPrev, aboxFixtures.bookListPage.hasPrev, 'hasPrev round-trips');
  });
});

// ---------------------------------------------------------------------------
// B-11: reviewWithAnnotatedEdge — RDF-star annotated edge
// ---------------------------------------------------------------------------

void describe('B-11: reviewWithAnnotatedEdge — RDF-star annotated edge', () => {
  const REVIEWS_GRAPH = 'urn:bookstore:named-graph:reviews';
  const EDGE_PREDICATE = 'https://bookstore.example/reviews';

  void it('emits the base reviews triple targeting the book IRI', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated, { 'graphIri': REVIEWS_GRAPH });

    const baseTriples = quads.filter((quad) => {
      return quad.predicate.value === EDGE_PREDICATE
        && quad.subject.termType === 'NamedNode';
    });

    assert.equal(baseTriples.length, 1, 'one base triple for the reviews edge');

    const baseTriple = baseTriples.at(0);

    if (baseTriple === undefined) {
      throw new Error('baseTriples[0] is undefined');
    }

    assert.equal(
      baseTriple.object.value,
      aboxFixtures.reviewWithAnnotatedEdge.reviewsBook.target,
      'base triple object is the book IRI (reviewsBook.target)'
    );
    assert.equal(baseTriple.object.termType, 'NamedNode', 'reviews object is a NamedNode');
  });

  void it('emits triple-term annotation quads for ratingGiven and verifiedPurchase with grounded predicates', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated, { 'graphIri': REVIEWS_GRAPH });

    const annotationQuads = quads.filter((quad) => {
      return quad.subject.termType === 'Quad';
    });

    assert.equal(annotationQuads.length, 2, 'two annotation (triple-term) quads: ratingGiven + verifiedPurchase');

    const ratingAnnotation = annotationQuads.find((quad) => {
      return quad.predicate.value === 'https://schema.org/ratingValue';
    });
    const verifiedAnnotation = annotationQuads.find((quad) => {
      return quad.predicate.value === 'https://schema.org/verified';
    });

    assert.ok(ratingAnnotation, 'ratingGiven annotation grounded to schema.org/ratingValue');
    assert.equal(ratingAnnotation.object.value, '5', 'ratingGiven annotation value is 5');
    assert.ok(verifiedAnnotation, 'verifiedPurchase annotation grounded to schema.org/verified');
    assert.equal(verifiedAnnotation.object.value, 'true', 'verifiedPurchase annotation value is true');
  });

  void it('base Review scalars are still present alongside the annotated edge', () => {
    const validated = bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge);
    const quads = bookstoreEntities.toQuads(ReviewSchema, validated, { 'graphIri': REVIEWS_GRAPH });

    const reviewIdQuad = quads.find((quad) => {
      return quad.predicate.value === 'https://bookstore.example/reviewId';
    });

    assert.ok(reviewIdQuad, 'reviewId quad present even with the annotated edge');
    assert.equal(
      reviewIdQuad.object.value,
      aboxFixtures.reviewWithAnnotatedEdge.reviewId,
      'reviewId value correct'
    );
  });
});

// ---------------------------------------------------------------------------
// B-12: Flat shared predicate disambiguation by subject rdf:type
// ---------------------------------------------------------------------------

void describe('B-12: flat shared predicate disambiguation by subject rdf:type', () => {
  void it('Customer, Order, Review all emit customerId with the identical flat predicate IRI', () => {
    const customerQuads = bookstoreEntities.toQuads(
      CustomerSchema,
      bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer)
    );
    const orderQuads = bookstoreEntities.toQuads(
      OrderSchema,
      bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order)
    );
    const reviewQuads = bookstoreEntities.toQuads(
      ReviewSchema,
      bookstoreEntities.instantiate(ReviewSchema, aboxFixtures.review)
    );

    for (const [
      label,
      quads
    ] of [
        [
          'Customer',
          customerQuads
        ] as const,
        [
          'Order',
          orderQuads
        ] as const,
        [
          'Review',
          reviewQuads
        ] as const
      ]) {
      const flat = quads.filter((quad) => {
        return quad.predicate.value === FLAT_CUSTOMER_ID;
      });

      assert.ok(flat.length > 0, `${label}: customerId uses flat predicate ${FLAT_CUSTOMER_ID}`);

      const classScoped = quads.filter((quad) => {
        return quad.predicate.value.includes('#customerId');
      });

      assert.equal(classScoped.length, 0, `${label}: no class-scoped customerId predicate`);
    }
  });

  void it('each subject carries the correct rdf:type for disambiguation', () => {
    const customerQuads = bookstoreEntities.toQuads(
      CustomerSchema,
      bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer)
    );

    const typeQuad = customerQuads.find((quad) => {
      return quad.predicate.value === RDF_TYPE && quad.object.value === CustomerSchema.$id;
    });

    assert.ok(typeQuad, `Customer instance carries rdf:type = ${CustomerSchema.$id} for disambiguation`);
  });
});

// ---------------------------------------------------------------------------
// B-13: CURIE predicate expansion — rdf:type emits as full IRI
// ---------------------------------------------------------------------------

void describe('B-13: rdf:type predicate emits as full IRI (CURIE expansion)', () => {
  void it('PrintBook toQuads emits rdf:type with the full rdf-syntax-ns IRI', () => {
    const validated = bookstoreEntities.instantiate(PrintBookSchema, aboxFixtures.printBook);
    const quads = bookstoreEntities.toQuads(PrintBookSchema, validated);

    const typeQuad = quads.find((quad) => {
      return quad.predicate.value === RDF_TYPE;
    });

    assert.ok(typeQuad, 'rdf:type quad present with the full IRI (not a CURIE)');
    assert.equal(typeQuad.predicate.termType, 'NamedNode', 'rdf:type predicate is a NamedNode');
  });
});

// ---------------------------------------------------------------------------
// B-14: BookCatalogEntry — embedded-$id projection round-trip
// ---------------------------------------------------------------------------

void describe('B-14: BookCatalogEntry embedded-$id projection', () => {
  // BookCatalogEntry.variants $refs the embedded $id
  // `urn:bookstore:BookCatalogEntryVariant` declared inside $defs. That $id is
  // not a separately-registered schema, so resolution scans the current graph's
  // nodes() for the matching node — the same-graph embedded-$id fallback shared
  // by Projection.resolveNode, Materializer.resolveTargetGraphAndNode, and
  // Lift.resolveLocalRef. toQuads emits one typed node per variant linked via the
  // `variants` predicate; fromQuads follows those refs back to nested objects.

  void it('bookCatalogEntry round-trips its variants array (embedded-$id ref)', () => {
    const validated = bookstoreEntities.instantiate(BookCatalogEntrySchema, aboxFixtures.bookCatalogEntry);
    const quads = bookstoreEntities.toQuads(BookCatalogEntrySchema, validated);
    const lifted = bookstoreEntities.fromQuads(BookCatalogEntrySchema.$id, quads);

    assert.equal(lifted.length, 1, 'one bookCatalogEntry lifted');

    const output = lifted.at(0);

    if (output === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(output.isbn, aboxFixtures.bookCatalogEntry.isbn, 'isbn round-trips');
    assert.equal(output.variants.length, 2, 'both variants round-trip');
    assert.deepEqual(
      output.variants.map((variant) => {
        return readVariant(variant);
      }),
      aboxFixtures.bookCatalogEntry.variants.map((variant) => {
        return {
          'kind': variant.kind,
          'variantPrice': variant.variantPrice
        };
      }),
      'each variant lifts back to its kind + variantPrice object'
    );
  });

  void it('bookCatalogEntryWithVariant round-trips its single variant', () => {
    const validated = bookstoreEntities.instantiate(
      BookCatalogEntrySchema,
      aboxFixtures.bookCatalogEntryWithVariant
    );
    const quads = bookstoreEntities.toQuads(BookCatalogEntrySchema, validated);
    const lifted = bookstoreEntities.fromQuads(BookCatalogEntrySchema.$id, quads);

    assert.equal(lifted.length, 1, 'one bookCatalogEntryWithVariant lifted');

    const output = lifted.at(0);

    if (output === undefined) {
      throw new Error('lifted[0] is undefined');
    }

    assert.equal(output.isbn, aboxFixtures.bookCatalogEntryWithVariant.isbn, 'isbn round-trips');
    assert.equal(output.variants.length, 1, 'single variant round-trips');

    const firstVariant = output.variants.at(0);

    if (firstVariant === undefined) {
      throw new Error('output.variants[0] is undefined');
    }

    const variant = readVariant(firstVariant);

    const firstFixtureVariant = aboxFixtures.bookCatalogEntryWithVariant.variants.at(0);

    if (firstFixtureVariant === undefined) {
      throw new Error('aboxFixtures.bookCatalogEntryWithVariant.variants[0] is undefined');
    }

    assert.equal(variant.kind, firstFixtureVariant.kind, 'variant.kind round-trips');
    assert.equal(
      variant.variantPrice,
      firstFixtureVariant.variantPrice,
      'variant.variantPrice round-trips'
    );
  });
});
