/**
 * e2e-reasoning.ts — Project → encode → reason → decode with EYE/N3
 *
 * Demonstrates json-tology's encode/decode Transform codecs as the bridge
 * between TypeScript bookstore objects and the typed literal syntax a real
 * OWL/N3 reasoner consumes.
 *
 * The data flow is HONEST: every domain fact is projected from a real,
 * validated TypeScript object via `jt.toQuads(...)`. The ONLY codec-injected
 * fact is the encoded epoch integer the reasoner's math built-ins need — the
 * codec's legitimate job, bridging the projected xsd:dateTime to the integer
 * EYE's `math:` built-ins compare.
 *
 * The codec's WIRE form IS the reasoner's typed literal:
 *   • encode: TS value → reasoner literal   (before reasoning)
 *   • decode: reasoner literal → TS value   (after reasoning)
 *
 * SCENARIO 1 — Refund eligibility (date-window reasoning)
 *   Real Order objects are projected to quads. `:forBook` is DERIVED from the
 *   projected order→orderLines→bookIsbn→book.isbn chain. An order is
 *   refund-eligible if placed within 30 days of a reference date AND the
 *   ordered book is returnable. In-print books are returnable; RareBook is
 *   final-sale (no returnable rule fires), so it is excluded.
 *
 * SCENARIO 2 — Review processing
 *   "Verified purchaser" is DERIVED by reasoning over real projected data: a
 *   customer who BOTH purchased (via Order line items) AND reviewed the same
 *   book is a verified reviewer of it. A verified reviewer's review with
 *   rating >= 4 → featuredReview. A review whose author never purchased the
 *   book (genuinely unverified) with rating <= 2 → flaggedForModeration. The
 *   inferred status IRI is decoded back to a TS verdict.
 *
 * On `verifiedPurchase` projection: ReviewSchema's `verifiedPurchase`
 * (`https://schema.org/verified`) does NOT project as a flat fact on the
 * review subject — it projects only as an RDF-star triple-term annotation
 * quad whose SUBJECT is the quoted `<< review reviews book >>` triple. A
 * plain N3 rule cannot key on a quoted-triple subject, so verified-purchaser
 * status is derived from purchased ∧ reviewed instead of a boolean flag.
 *
 * Prerequisites: npm run build
 * Run: tsx examples/e2e-reasoning.ts
 *
 * Note: this example requires the optional `eyereasoner` peer dependency.
 * When absent it prints a skip notice and exits cleanly.
 */

import {
  Parser, Writer
} from 'n3';
import {
  Lists, Transform
} from '../src/index.js';
import type { QuadInterface } from '../src/interfaces/index.js';
import {
  aboxFixtures,
  bookstoreEntities,
  CustomerSchema,
  InPrintBookSchema,
  OrderSchema,
  RareBookSchema,
  ReviewSchema
} from './docs/bookstore/index.js';

// ---------------------------------------------------------------------------
// Guard: skip cleanly if eyereasoner is not installed
// ---------------------------------------------------------------------------

type N3ReasonerFn = (data: string, query: string) => Promise<string>;

async function loadReasoner(): Promise<N3ReasonerFn | null> {
  try {
    const mod = await import('eyereasoner');

    if (typeof (mod as { 'n3reasoner'?: unknown }).n3reasoner === 'function') {
      return (mod as { 'n3reasoner': N3ReasonerFn }).n3reasoner;
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: RDF/JS quads → N3 string
// ---------------------------------------------------------------------------

async function quadsToN3(quads: readonly QuadInterface[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ 'format': 'N3' });

    writer.addQuads([...quads] as never);
    writer.end((err: Error | null, result: string) => {
      if (err !== null) {
        reject(err);

        return;
      }
      resolve(result);
    });
  });
}

// ---------------------------------------------------------------------------
// CODEC 1 — OrderClockSchema
//
// The codec's wire form is the reasoner's typed literal: an epoch-seconds
// integer that the EYE math:notLessThan built-in can compare directly.
//
//   encode: ISO string → epoch integer  (TS date → reasoner literal)
//   decode: epoch integer → ISO string  (reasoner literal → TS value)
// ---------------------------------------------------------------------------

const OrderClockSchema = Transform.create(
  {
    '$id': 'urn:example:OrderClock',
    'format': 'date-time',
    'type': 'string'
  } as const,
  {
    'decode': (epochSeconds: number): string => {
      return new Date(epochSeconds * 1000).toISOString();
    },
    'encode': (isoString: string): number => {
      return Math.floor(new Date(isoString).getTime() / 1000);
    }
  }
);

// ---------------------------------------------------------------------------
// CODEC 2 — ReviewVerdictSchema
//
// The wire form is the reasoner's inferred status IRI; decode maps it to a
// TS discriminated union so callers get a type-safe verdict value.
//
//   encode: 'featured' | 'flagged' | 'standard' → IRI  (emit into N3)
//   decode: IRI → TS union                             (reasoner output → TS)
// ---------------------------------------------------------------------------

type ReviewVerdict = 'featured' | 'flagged' | 'standard';

const IRI_FEATURED = 'urn:example:featuredReview';
const IRI_FLAGGED = 'urn:example:flaggedForModeration';

const IRI_TO_VERDICT: Partial<Record<string, ReviewVerdict>> = {
  [IRI_FEATURED]: 'featured',
  [IRI_FLAGGED]: 'flagged'
};

const VERDICT_TO_IRI: Partial<Record<string, string>> = {
  'featured': IRI_FEATURED,
  'flagged': IRI_FLAGGED,
  'standard': 'urn:example:standardReview'
};

const ReviewVerdictSchema = Transform.create(
  {
    '$id': 'urn:example:ReviewVerdict',
    'enum': [
      'featured',
      'flagged',
      'standard'
    ],
    'type': 'string'
  } as const,
  {
    'decode': (statusIri: string): ReviewVerdict => {
      return IRI_TO_VERDICT[statusIri] ?? 'standard';
    },
    'encode': (verdict: string): string => {
      return VERDICT_TO_IRI[verdict] ?? 'urn:example:standardReview';
    }
  }
);

const jt = bookstoreEntities;

// ---------------------------------------------------------------------------
// Projected predicate IRIs (the flat predicates jt.toQuads emits)
// ---------------------------------------------------------------------------

const PRED_CUSTOMER_ID = 'https://bookstore.example/customerId';
const PRED_ORDER_LINES = 'https://bookstore.example/orderLines';
const PRED_BOOK_ISBN = 'https://bookstore.example/bookIsbn';
const PRED_ISBN = 'https://bookstore.example/isbn';
const PRED_RATING = 'https://bookstore.example/rating';

// ---------------------------------------------------------------------------
// FIXED reference date — deterministic, never uses Date.now()
// ---------------------------------------------------------------------------

const REFERENCE_NOW = '2026-06-14T00:00:00Z';
const REFERENCE_EPOCH = Math.floor(new Date(REFERENCE_NOW).getTime() / 1000);
const CUTOFF_EPOCH = REFERENCE_EPOCH - 30 * 24 * 3600;

console.log('Reference date  :', REFERENCE_NOW);
console.log('Cutoff epoch    :', CUTOFF_EPOCH, '(30 days before reference)');
console.log();

// ---------------------------------------------------------------------------
// SCENARIO 1 — Refund eligibility (real Order objects)
// ---------------------------------------------------------------------------

console.log('=== SCENARIO 1: Refund eligibility ===');
console.log();

const PRED_EPOCH = 'urn:example:placedAtEpoch';
const PRED_FOR_BOOK = 'urn:example:forBook';
const PRED_RETURNABLE = 'urn:example:returnable';
const PRED_REFUND_ELIGIBLE = 'urn:example:refundEligible';
const PRED_CUTOFF = 'urn:example:refundCutoffEpoch';
const POLICY_IRI = 'urn:example:policy';

const MOMO_ISBN = '9783522129503';
const inPrintBookIri = `urn:bookstore:book:${MOMO_ISBN}`;
const rareBookIri = `urn:bookstore:book:${aboxFixtures.rareBook.isbn}`;

const MOMO_PRICE = {
  'amount': 380,
  'currency': 'EUR'
} as const;

// Real in-print book (Momo) — returnable.
const inPrintBook = {
  'authors': ['Michael Ende'],
  'isbn': MOMO_ISBN,
  'price': MOMO_PRICE,
  'printStatus': 'inPrint' as const,
  'title': 'Momo'
};

// Three REAL Order objects — vary only orderId, placedAt, and the orderLines'
// bookIsbn (in-print Momo vs the rare Neverending Story first edition).
const recentOrder = {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': '11111111-0001-4001-8001-000000000001',
  'orderLines': [{
    'bookIsbn': MOMO_ISBN,
    'quantity': 1,
    'unitPrice': MOMO_PRICE
  }],
  'orderTotal': MOMO_PRICE,
  'placedAt': '2026-05-25T10:00:00Z',
  'shippingAddress': aboxFixtures.customer.addresses[0]
};

const oldOrder = {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': '22222222-0002-4002-8002-000000000002',
  'orderLines': [{
    'bookIsbn': MOMO_ISBN,
    'quantity': 1,
    'unitPrice': MOMO_PRICE
  }],
  'orderTotal': MOMO_PRICE,
  'placedAt': '2026-03-01T10:00:00Z',
  'shippingAddress': aboxFixtures.customer.addresses[0]
};

const rareOrder = {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': '33333333-0003-4003-8003-000000000003',
  'orderLines': [{
    'bookIsbn': aboxFixtures.rareBook.isbn,
    'quantity': 1,
    'unitPrice': aboxFixtures.rareBook.price
  }],
  'orderTotal': aboxFixtures.rareBook.price,
  'placedAt': '2026-05-30T10:00:00Z',
  'shippingAddress': aboxFixtures.customer.addresses[0]
};

const recentOrderIri = `urn:bookstore:order:${recentOrder.orderId}`;
const oldOrderIri = `urn:bookstore:order:${oldOrder.orderId}`;
const rareOrderIri = `urn:bookstore:order:${rareOrder.orderId}`;

// encode: ISO date string → epoch integer (the only codec-injected fact).
const recentEpoch = jt.encode(OrderClockSchema, recentOrder.placedAt);
const oldEpoch = jt.encode(OrderClockSchema, oldOrder.placedAt);
const rareEpoch = jt.encode(OrderClockSchema, rareOrder.placedAt);

console.log('encode(recentOrder.placedAt) →', recentEpoch, '(epoch seconds for reasoner)');
console.log('encode(oldOrder.placedAt)    →', oldEpoch);
console.log('encode(rareOrder.placedAt)   →', rareEpoch);
console.log();

// decode: epoch seconds → ISO string (round-trip demonstration).
const decodedRecent = jt.instantiate(OrderClockSchema, recentEpoch);

console.log('decode(', recentEpoch, ') →', decodedRecent, '(ISO string back in TS)');
console.log();

const n3reasoner = await loadReasoner();

if (n3reasoner === null) {
  console.log('eyereasoner not installed — skipping reasoner execution.');
  console.log('Install the optional peer: npm install --save-optional eyereasoner');
  process.exit(0);
}

// Validate + project the books and the three real Order objects.
const inPrintBookInstance = jt.instantiate(InPrintBookSchema, inPrintBook);
const rareBookInstance = jt.instantiate(RareBookSchema, aboxFixtures.rareBook);
const recentInstance = jt.instantiate(OrderSchema, recentOrder);
const oldInstance = jt.instantiate(OrderSchema, oldOrder);
const rareInstance = jt.instantiate(OrderSchema, rareOrder);

const refundProjected = [
  ...jt.toQuads(InPrintBookSchema, inPrintBookInstance, { 'iriFor': inPrintBookIri }),
  ...jt.toQuads(RareBookSchema, rareBookInstance, { 'iriFor': rareBookIri }),
  ...jt.toQuads(OrderSchema, recentInstance, { 'iriFor': recentOrderIri }),
  ...jt.toQuads(OrderSchema, oldInstance, { 'iriFor': oldOrderIri }),
  ...jt.toQuads(OrderSchema, rareInstance, { 'iriFor': rareOrderIri })
];

const refundAboxN3 = await quadsToN3(refundProjected);

const refundFacts = `${refundAboxN3}

<${POLICY_IRI}> <${PRED_CUTOFF}> ${CUTOFF_EPOCH}.

<${recentOrderIri}> <${PRED_EPOCH}> ${recentEpoch}.
<${oldOrderIri}> <${PRED_EPOCH}> ${oldEpoch}.
<${rareOrderIri}> <${PRED_EPOCH}> ${rareEpoch}.
`;

const refundRules = `
@prefix math: <http://www.w3.org/2000/10/swap/math#>.

{ ?b a <urn:bookstore:InPrintBook> } => { ?b <${PRED_RETURNABLE}> true }.

{ ?o <${PRED_ORDER_LINES}> ?line.
  ?line <${PRED_BOOK_ISBN}> ?isbn.
  ?b <${PRED_ISBN}> ?isbn.
} => { ?o <${PRED_FOR_BOOK}> ?b }.

{ ?o <${PRED_EPOCH}> ?e.
  <${POLICY_IRI}> <${PRED_CUTOFF}> ?c.
  ?e math:notLessThan ?c.
  ?o <${PRED_FOR_BOOK}> ?b.
  ?b <${PRED_RETURNABLE}> true.
} => { ?o <${PRED_REFUND_ELIGIBLE}> true }.
`;

const refundQuery = `{ ?o <${PRED_REFUND_ELIGIBLE}> true } => { ?o <${PRED_REFUND_ELIGIBLE}> true }.`;

console.log('Running EYE reasoner — refund eligibility...');
const refundResult = await n3reasoner(`${refundFacts}\n${refundRules}`, refundQuery);

const refundParser = new Parser({ 'format': 'N3' });
const refundInferred = Lists.narrowExternalQuads(refundParser.parse(refundResult));

const eligibleOrders = refundInferred
  .filter((quad) => {
    return quad.predicate.value === PRED_REFUND_ELIGIBLE;
  })
  .map((quad) => {
    return quad.subject.value;
  });

console.log('Inferred :refundEligible on:', eligibleOrders);
console.log();

console.assert(eligibleOrders.includes(recentOrderIri), 'recent order must be eligible');
console.assert(!eligibleOrders.includes(oldOrderIri), 'old order must NOT be eligible');
console.assert(!eligibleOrders.includes(rareOrderIri), 'rare-book order must NOT be eligible (final-sale)');

console.log('SCENARIO 1 assertions:');
console.log('  recent order refund-eligible :', eligibleOrders.includes(recentOrderIri));
console.log('  old order refund-eligible    :', eligibleOrders.includes(oldOrderIri));
console.log('  rare-book order eligible     :', eligibleOrders.includes(rareOrderIri));
console.log();

// ---------------------------------------------------------------------------
// SCENARIO 2 — Review processing (derive verified purchaser from real data)
// ---------------------------------------------------------------------------

console.log('=== SCENARIO 2: Review processing ===');
console.log();

const PRED_PURCHASED = 'urn:example:purchased';
const PRED_REVIEWED = 'urn:example:reviewed';
const PRED_VERIFIED_REVIEWER = 'urn:example:isVerifiedReviewerOf';

const bastianIri = `urn:bookstore:customer:${aboxFixtures.customer.customerId}`;
const bastianOrderIri = `urn:bookstore:order:${aboxFixtures.order.orderId}`;
const verifiedReviewIri = `urn:bookstore:review:${aboxFixtures.review.reviewId}`;

// Unverified reviewer: a DIFFERENT customer who reviewed the rare book but
// never ordered it. rating 2. Genuinely unverified — no Order links them.
const skepticCustomerId = 'b7e6d5c4-3210-4567-89ab-cdef01234567';
const skepticReviewId = 'd1e2f3a4-5678-4901-bcde-f01234567890';
const skepticCustomerIri = `urn:bookstore:customer:${skepticCustomerId}`;
const flaggedReviewIri = `urn:bookstore:review:${skepticReviewId}`;

const skepticCustomer = {
  'addresses': aboxFixtures.customer.addresses,
  'customerId': skepticCustomerId,
  'email': 'skeptic@bookstore.example',
  'name': 'Carl Conrad Coreander'
};

const skepticReview = {
  'body': 'Overpriced and the binding felt loose; I would not buy this rare printing again.',
  'bookIsbn': aboxFixtures.rareBook.isbn,
  'customerId': skepticCustomerId,
  'postedAt': '2026-05-10T12:00:00Z',
  'rating': 2,
  'reviewId': skepticReviewId
};

// Validate + project: Bastian's customer/order/review + the skeptic's
// customer/review, plus the rare book (so both reviews chain to it).
const rareBookForReview = jt.instantiate(RareBookSchema, aboxFixtures.rareBook);
const bastianCustomer = jt.instantiate(CustomerSchema, aboxFixtures.customer);
const bastianOrder = jt.instantiate(OrderSchema, aboxFixtures.order);
const bastianReview = jt.instantiate(ReviewSchema, aboxFixtures.review);
const skepticCustomerInstance = jt.instantiate(CustomerSchema, skepticCustomer);
const skepticReviewInstance = jt.instantiate(ReviewSchema, skepticReview);

const reviewProjected = [
  ...jt.toQuads(RareBookSchema, rareBookForReview, { 'iriFor': rareBookIri }),
  ...jt.toQuads(CustomerSchema, bastianCustomer, { 'iriFor': bastianIri }),
  ...jt.toQuads(OrderSchema, bastianOrder, { 'iriFor': bastianOrderIri }),
  ...jt.toQuads(ReviewSchema, bastianReview, { 'iriFor': verifiedReviewIri }),
  ...jt.toQuads(CustomerSchema, skepticCustomerInstance, { 'iriFor': skepticCustomerIri }),
  ...jt.toQuads(ReviewSchema, skepticReviewInstance, { 'iriFor': flaggedReviewIri })
];

const reviewAboxN3 = await quadsToN3(reviewProjected);

const reviewRules = `
@prefix math: <http://www.w3.org/2000/10/swap/math#>.
@prefix log:  <http://www.w3.org/2000/10/swap/log#>.

{ ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?order <${PRED_CUSTOMER_ID}> ?cid.
  ?order <${PRED_ORDER_LINES}> ?line.
  ?line <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
} => { ?customer <${PRED_PURCHASED}> ?book }.

{ ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
} => { ?customer <${PRED_REVIEWED}> ?book }.

{ ?customer <${PRED_PURCHASED}> ?book.
  ?customer <${PRED_REVIEWED}> ?book.
} => { ?customer <${PRED_VERIFIED_REVIEWER}> ?book }.

{ ?review <${PRED_CUSTOMER_ID}> ?cid.
  ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
  ?customer <${PRED_VERIFIED_REVIEWER}> ?book.
  ?review <${PRED_RATING}> ?n.
  ?n math:notLessThan 4.
} => { ?review <${IRI_FEATURED}> true }.

{ ?review <${PRED_CUSTOMER_ID}> ?cid.
  ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
  ?review <${PRED_RATING}> ?n.
  ?n math:notGreaterThan 2.
  _:scope log:notIncludes { ?customer <${PRED_VERIFIED_REVIEWER}> ?book. }.
} => { ?review <${IRI_FLAGGED}> true }.
`;

const reviewQuery = `
{ ?r <${IRI_FEATURED}> true } => { ?r <${IRI_FEATURED}> true }.
{ ?r <${IRI_FLAGGED}> true }  => { ?r <${IRI_FLAGGED}> true }.
{ ?c <${PRED_VERIFIED_REVIEWER}> ?b } => { ?c <${PRED_VERIFIED_REVIEWER}> ?b }.
`;

console.log('Running EYE reasoner — review processing...');
const reviewResult = await n3reasoner(`${reviewAboxN3}\n${reviewRules}`, reviewQuery);

const reviewParser = new Parser({ 'format': 'N3' });
const reviewInferred = Lists.narrowExternalQuads(reviewParser.parse(reviewResult));

console.log('Inferred triples:');
for (const quad of reviewInferred) {
  console.log(' ', quad.subject.value, quad.predicate.value, quad.object.value);
}
console.log();

// decode operates on REASONER OUTPUT: extract the inferred predicate IRI from
// an actual reasoner-produced quad and decode THAT into the TS verdict.
const featuredQuad = reviewInferred.find((quad) => {
  return quad.predicate.value === IRI_FEATURED && quad.subject.value === verifiedReviewIri;
});
const flaggedQuad = reviewInferred.find((quad) => {
  return quad.predicate.value === IRI_FLAGGED && quad.subject.value === flaggedReviewIri;
});

const featuredVerdict = featuredQuad === undefined
  ? null
  : jt.instantiate(ReviewVerdictSchema, featuredQuad.predicate.value);
const flaggedVerdict = flaggedQuad === undefined
  ? null
  : jt.instantiate(ReviewVerdictSchema, flaggedQuad.predicate.value);

console.log('decode(reasoner-produced featured IRI) →', featuredVerdict, '(TS union value)');
console.log('decode(reasoner-produced flagged IRI)  →', flaggedVerdict, '(TS union value)');
console.log();

console.assert(featuredQuad !== undefined, 'verified reviewer must yield a featured review');
console.assert(flaggedQuad !== undefined, 'unverified low-rating review must be flagged');
console.assert(featuredVerdict === 'featured', 'decoded verdict must be "featured"');
console.assert(flaggedVerdict === 'flagged', 'decoded verdict must be "flagged"');

console.log('SCENARIO 2 assertions:');
console.log('  verified review featured     :', featuredQuad !== undefined);
console.log('  unverified review flagged    :', flaggedQuad !== undefined);
console.log('  decoded featured verdict     :', featuredVerdict);
console.log('  decoded flagged verdict      :', flaggedVerdict);
