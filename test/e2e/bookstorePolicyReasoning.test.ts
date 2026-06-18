/**
 * Bookstore policy reasoning — e2e tests.
 *
 * Two business-rule scenarios that exercise json-tology's encode/decode
 * Transform codecs as the bridge between TypeScript values and the typed
 * literal syntax a real OWL/N3 reasoner consumes (EYE via `n3reasoner`).
 *
 * The data flow is HONEST: every domain fact is projected from a real,
 * validated TypeScript bookstore object via `jt.toQuads(...)`. The ONLY
 * codec-injected fact is the encoded epoch integer the reasoner's math
 * built-ins need (the codec's legitimate job — bridging the projected
 * xsd:dateTime literal to the integer EYE's `math:` built-ins compare).
 *
 * Pipeline:
 *   1. Construct real TS Order / Customer / Review objects.
 *   2. Validate + project them to RDF/JS quads via `jt.toQuads`.
 *   3. `jt.encode(OrderClockSchema, order.placedAt)` → epoch integer fact.
 *   4. Append N3 inference rules that chain through the PROJECTED predicates
 *      (orderLines → bookIsbn → isbn, customerId, rating).
 *   5. Run EYE (WASM); parse the inferred triples.
 *   6. Decode a reasoner-produced status IRI back to a TS verdict.
 *
 * SCENARIO 1 — Refund eligibility (date-window reasoning):
 *   An order is refund-eligible if placed within 30 days of a fixed
 *   reference date AND the ordered book is returnable. `:forBook` is
 *   DERIVED from the projected order→orderLines→bookIsbn→book.isbn chain.
 *   In-print books are returnable (rule keyed on rdf:type InPrintBook);
 *   RareBook is final-sale (no returnable rule fires), so it is excluded.
 *
 * SCENARIO 2 — Review processing:
 *   "Verified purchaser" is DERIVED honestly by reasoning over real
 *   projected data: a customer who BOTH purchased (via Order line items)
 *   AND reviewed the same book is a verified reviewer of it. A verified
 *   reviewer with rating >= 4 → featuredReview. A review whose reviewer
 *   did NOT purchase the book (genuinely unverified) with rating <= 2 →
 *   flaggedForModeration. No injected boolean flags.
 *
 * On `verifiedPurchase` projection: ReviewSchema's `verifiedPurchase`
 * (`https://schema.org/verified`) does NOT project as a flat fact on the
 * review subject. It projects ONLY as an RDF-star triple-term annotation
 * quad whose SUBJECT is the quoted `<< review reviews book >>` triple
 * (see test/e2e/aboxBidirectionality.test.ts B-11), so a plain N3 rule
 * `?r <verified> true` cannot key on it. Hence the verified-purchaser
 * status is derived from purchased ∧ reviewed instead of a flat flag.
 *
 * `eyereasoner` is an optional peer dependency. When absent, every test
 * in this file is skipped rather than failed (same pattern as the
 * existing eyeReasoner.test.ts suite).
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  DataFactory, Parser, Writer
} from 'n3';
import {
  Lists, Transform
} from '../../src/index.js';
import type { QuadInterface } from '../../src/interfaces/index.js';
import {
  aboxFixtures,
  bookstoreEntities,
  CustomerSchema,
  InPrintBookSchema,
  OrderSchema,
  RareBookSchema,
  ReviewSchema
} from '../../examples/docs/bookstore/index.js';

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

type N3ReasonerFn = (data: string, query: string) => Promise<string>;
type ReviewVerdict = 'featured' | 'flagged' | 'standard';

// ---------------------------------------------------------------------------
// Optional peer — skip gracefully when eyereasoner is absent
// ---------------------------------------------------------------------------

async function tryLoadN3Reasoner(): Promise<N3ReasonerFn | null> {
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
// Helper: RDF/JS quads → N3 string in the DEFAULT GRAPH (strips named-graph
// context). EYE's N3 rules operate on the default graph; named-graph facts
// inside `<g> { ... }` blocks are invisible to plain `{ ?s ?p ?o }` rule heads.
// DataFactory.quad(s, p, o) — no 4th arg — projects each quad into the
// default graph. QuadInterface terms are compatible with n3's Quad_Subject /
// Quad_Predicate / Quad_Object, so no casts are needed.
// ---------------------------------------------------------------------------

async function quadsToN3DefaultGraph(quads: readonly QuadInterface[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new Writer({ 'format': 'N3' });
    const defaultQuads = quads.map((quad) => {
      return DataFactory.quad(quad.subject, quad.predicate, quad.object);
    });

    writer.addQuads(defaultQuads);
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
// Wire  : number  (Unix epoch seconds — the integer the reasoner's math
//                  built-ins operate on)
// Canon : string  (ISO 8601 date-time — the TS representation)
//
// encode: ISO string → epoch integer  (TS → reasoner literal)
// decode: epoch integer → ISO string  (reasoner output → TS value)
// ---------------------------------------------------------------------------

const OrderClockBaseSchema = {
  '$id': 'urn:example:OrderClock',
  'format': 'date-time',
  'type': 'string'
} as const;

const OrderClockSchema = Transform.create(OrderClockBaseSchema, {
  'decode': (epochSeconds: number): string => {
    return new Date(epochSeconds * 1000).toISOString();
  },
  'encode': (isoString: string): number => {
    return Math.floor(new Date(isoString).getTime() / 1000);
  }
});

// ---------------------------------------------------------------------------
// CODEC 2 — ReviewVerdictSchema
//
// Wire  : string  (status IRI returned by the reasoner, e.g.
//                  'urn:example:featuredReview')
// Canon : ReviewVerdict  ('featured' | 'flagged' | 'standard')
//
// encode: TS union → status IRI  (for emitting into N3 if needed)
// decode: status IRI → TS union  (reasoner output → TS value)
// ---------------------------------------------------------------------------

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

const ReviewVerdictBaseSchema = {
  '$id': 'urn:example:ReviewVerdict',
  'enum': [
    'featured',
    'flagged',
    'standard'
  ],
  'type': 'string'
} as const;

const ReviewVerdictSchema = Transform.create(ReviewVerdictBaseSchema, {
  'decode': (statusIri: string): ReviewVerdict => {
    return IRI_TO_VERDICT[statusIri] ?? 'standard';
  },
  'encode': (verdict: string): string => {
    return VERDICT_TO_IRI[verdict] ?? 'urn:example:standardReview';
  }
});

const jt = bookstoreEntities;

// ---------------------------------------------------------------------------
// Shared projected predicate IRIs (the flat predicates jt.toQuads emits)
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

// ---------------------------------------------------------------------------
// Shared domain individuals
// ---------------------------------------------------------------------------

const MOMO_ISBN = '9783522129503';
const inPrintBookIri = `urn:bookstore:book:${MOMO_ISBN}`;
const rareBookIri = `urn:bookstore:book:${aboxFixtures.rareBook.isbn}`;

// Real in-print book (Momo) — returnable
const inPrintBook = {
  'authors': ['Michael Ende'],
  'isbn': MOMO_ISBN,
  'price': {
    'amount': 380,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint' as const,
  'title': 'Momo'
};

// ---------------------------------------------------------------------------
// SCENARIO 1 — Refund eligibility (real Order objects)
// ---------------------------------------------------------------------------

const PRED_PLACED_AT_EPOCH = 'urn:example:placedAtEpoch';
const PRED_FOR_BOOK = 'urn:example:forBook';
const PRED_RETURNABLE = 'urn:example:returnable';
const PRED_REFUND_ELIGIBLE = 'urn:example:refundEligible';
const PRED_POLICY_CUTOFF = 'urn:example:refundCutoffEpoch';
const POLICY_IRI = 'urn:example:policy';

// Three REAL Order objects — varying only orderId, placedAt, and the
// orderLines' bookIsbn (in-print Momo vs the rare Neverending Story).
const RECENT_ORDER_ID = '11111111-0001-4001-8001-000000000001';
const OLD_ORDER_ID = '22222222-0002-4002-8002-000000000002';
const RARE_ORDER_ID = '33333333-0003-4003-8003-000000000003';

// 20 days before REFERENCE_NOW
const RECENT_PLACED_AT = '2026-05-25T10:00:00Z';
// ~105 days before REFERENCE_NOW
const OLD_PLACED_AT = '2026-03-01T10:00:00Z';
// 15 days before REFERENCE_NOW
const RARE_PLACED_AT = '2026-05-30T10:00:00Z';

const MOMO_PRICE = {
  'amount': 380,
  'currency': 'EUR'
} as const;

const recentOrder = {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': RECENT_ORDER_ID,
  'orderLines': [{
    'bookIsbn': MOMO_ISBN,
    'quantity': 1,
    'unitPrice': MOMO_PRICE
  }],
  'orderTotal': MOMO_PRICE,
  'placedAt': RECENT_PLACED_AT,
  'shippingAddress': aboxFixtures.customer.addresses[0]
};

const oldOrder = {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': OLD_ORDER_ID,
  'orderLines': [{
    'bookIsbn': MOMO_ISBN,
    'quantity': 1,
    'unitPrice': MOMO_PRICE
  }],
  'orderTotal': MOMO_PRICE,
  'placedAt': OLD_PLACED_AT,
  'shippingAddress': aboxFixtures.customer.addresses[0]
};

const rareOrder = {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': RARE_ORDER_ID,
  'orderLines': [{
    'bookIsbn': aboxFixtures.rareBook.isbn,
    'quantity': 1,
    'unitPrice': aboxFixtures.rareBook.price
  }],
  'orderTotal': aboxFixtures.rareBook.price,
  'placedAt': RARE_PLACED_AT,
  'shippingAddress': aboxFixtures.customer.addresses[0]
};

const recentOrderIri = `urn:bookstore:order:${RECENT_ORDER_ID}`;
const oldOrderIri = `urn:bookstore:order:${OLD_ORDER_ID}`;
const rareOrderIri = `urn:bookstore:order:${RARE_ORDER_ID}`;

function refundRulesN3(): string {
  return `
@prefix math: <http://www.w3.org/2000/10/swap/math#>.

# In-print books are returnable; RareBook is final-sale (no rule fires).
{ ?b a <urn:bookstore:InPrintBook> } => { ?b <${PRED_RETURNABLE}> true }.

# Derive :forBook from the PROJECTED order → orderLines → bookIsbn → isbn chain.
{
  ?o <${PRED_ORDER_LINES}> ?line.
  ?line <${PRED_BOOK_ISBN}> ?isbn.
  ?b <${PRED_ISBN}> ?isbn.
} => {
  ?o <${PRED_FOR_BOOK}> ?b.
}.

# Refund eligibility: placed within window AND ordered book is returnable.
{
  ?o <${PRED_PLACED_AT_EPOCH}> ?e.
  <${POLICY_IRI}> <${PRED_POLICY_CUTOFF}> ?c.
  ?e math:notLessThan ?c.
  ?o <${PRED_FOR_BOOK}> ?b.
  ?b <${PRED_RETURNABLE}> true.
} => {
  ?o <${PRED_REFUND_ELIGIBLE}> true.
}.
`;
}

function refundQueryN3(): string {
  return `
{ ?o <${PRED_REFUND_ELIGIBLE}> true } => { ?o <${PRED_REFUND_ELIGIBLE}> true }.
{ ?o <${PRED_FOR_BOOK}> ?b } => { ?o <${PRED_FOR_BOOK}> ?b }.
`;
}

async function buildRefundFacts(): Promise<string> {
  // Validate + project the books (rdf:type + isbn projected quads)
  const inPrintBookInstance = jt.instantiate(InPrintBookSchema, inPrintBook);
  const rareBookInstance = jt.instantiate(RareBookSchema, aboxFixtures.rareBook);

  // Validate + project the three REAL Order objects (customerId / orderLines /
  // bookIsbn / placedAt are all genuine projected quads).
  const recentInstance = jt.instantiate(OrderSchema, recentOrder);
  const oldInstance = jt.instantiate(OrderSchema, oldOrder);
  const rareInstance = jt.instantiate(OrderSchema, rareOrder);

  const projected = [
    ...jt.toQuads(InPrintBookSchema, inPrintBookInstance, { 'iriFor': inPrintBookIri }),
    ...jt.toQuads(RareBookSchema, rareBookInstance, { 'iriFor': rareBookIri }),
    ...jt.toQuads(OrderSchema, recentInstance, { 'iriFor': recentOrderIri }),
    ...jt.toQuads(OrderSchema, oldInstance, { 'iriFor': oldOrderIri }),
    ...jt.toQuads(OrderSchema, rareInstance, { 'iriFor': rareOrderIri })
  ];

  const aboxN3 = await quadsToN3(projected);

  // The ONLY codec-injected facts: the encoded epoch per order. encode()
  // bridges the projected xsd:dateTime placedAt to the integer the math
  // built-ins compare.
  const recentEpoch = jt.encode(OrderClockSchema, recentOrder.placedAt);
  const oldEpoch = jt.encode(OrderClockSchema, oldOrder.placedAt);
  const rareEpoch = jt.encode(OrderClockSchema, rareOrder.placedAt);

  return `${aboxN3}

<${POLICY_IRI}> <${PRED_POLICY_CUTOFF}> ${CUTOFF_EPOCH}.

<${recentOrderIri}> <${PRED_PLACED_AT_EPOCH}> ${recentEpoch}.
<${oldOrderIri}> <${PRED_PLACED_AT_EPOCH}> ${oldEpoch}.
<${rareOrderIri}> <${PRED_PLACED_AT_EPOCH}> ${rareEpoch}.
`;
}

// ---------------------------------------------------------------------------
// SCENARIO 2 — Review processing (derive verified purchaser from real data)
// ---------------------------------------------------------------------------

const PRED_PURCHASED = 'urn:example:purchased';
const PRED_REVIEWED = 'urn:example:reviewed';
const PRED_VERIFIED_REVIEWER = 'urn:example:isVerifiedReviewerOf';

// Bastian's customer IRI (the projected customerId links Order/Review to it).
const bastianIri = `urn:bookstore:customer:${aboxFixtures.customer.customerId}`;

// Verified-purchaser review: Bastian reviewed the rare book he ALSO ordered.
// Use the existing review fixture (rating 5, customerId = Bastian, isbn = rare).
const VERIFIED_REVIEW_IRI = `urn:bookstore:review:${aboxFixtures.review.reviewId}`;

// Bastian's order for the rare book makes him a purchaser of it (real Order).
// Reuse the canonical order fixture (it orders the rare book's ISBN).
const bastianOrderIri = `urn:bookstore:order:${aboxFixtures.order.orderId}`;

// Unverified reviewer: a DIFFERENT customer who reviewed the rare book but
// never ordered it. rating 2. Genuinely unverified — no Order links them.
const UNVERIFIED_CUSTOMER_ID = 'b7e6d5c4-3210-4567-89ab-cdef01234567';
const UNVERIFIED_REVIEW_ID = 'd1e2f3a4-5678-4901-bcde-f01234567890';
const UNVERIFIED_REVIEW_IRI = `urn:bookstore:review:${UNVERIFIED_REVIEW_ID}`;

const unverifiedReview = {
  'body': 'Overpriced and the binding felt loose; I would not buy this rare printing again.',
  'bookIsbn': aboxFixtures.rareBook.isbn,
  'customerId': UNVERIFIED_CUSTOMER_ID,
  'postedAt': '2026-05-10T12:00:00Z',
  'rating': 2,
  'reviewId': UNVERIFIED_REVIEW_ID
};

const unverifiedCustomer = {
  'addresses': aboxFixtures.customer.addresses,
  'customerId': UNVERIFIED_CUSTOMER_ID,
  'email': 'skeptic@bookstore.example',
  'name': 'Carl Conrad Coreander'
};

const unverifiedCustomerIri = `urn:bookstore:customer:${UNVERIFIED_CUSTOMER_ID}`;

function reviewRulesN3(): string {
  return `
@prefix math: <http://www.w3.org/2000/10/swap/math#>.

# Purchased: a customer who placed an order whose line item ISBN matches a book.
{
  ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?order <${PRED_CUSTOMER_ID}> ?cid.
  ?order <${PRED_ORDER_LINES}> ?line.
  ?line <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
} => {
  ?customer <${PRED_PURCHASED}> ?book.
}.

# Reviewed: a customer whose review references a book's ISBN.
{
  ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
} => {
  ?customer <${PRED_REVIEWED}> ?book.
}.

# Verified reviewer: purchased AND reviewed the same book.
{
  ?customer <${PRED_PURCHASED}> ?book.
  ?customer <${PRED_REVIEWED}> ?book.
} => {
  ?customer <${PRED_VERIFIED_REVIEWER}> ?book.
}.

# Featured: the review's author is a verified reviewer of the reviewed book
# AND the review rating is >= 4.
{
  ?review <${PRED_CUSTOMER_ID}> ?cid.
  ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
  ?customer <${PRED_VERIFIED_REVIEWER}> ?book.
  ?review <${PRED_RATING}> ?n.
  ?n math:notLessThan 4.
} => {
  ?review <${IRI_FEATURED}> true.
}.

# Flagged: the review's author is NOT a verified reviewer of the book
# (no purchase) AND the rating is <= 2. EYE's log:notIncludes tests the
# absence of the verified-reviewer fact for this author/book pair.
{
  ?review <${PRED_CUSTOMER_ID}> ?cid.
  ?customer <${PRED_CUSTOMER_ID}> ?cid.
  ?review <${PRED_BOOK_ISBN}> ?isbn.
  ?book <${PRED_ISBN}> ?isbn.
  ?review <${PRED_RATING}> ?n.
  ?n math:notGreaterThan 2.
  _:scope <http://www.w3.org/2000/10/swap/log#notIncludes> {
    ?customer <${PRED_VERIFIED_REVIEWER}> ?book.
  }.
} => {
  ?review <${IRI_FLAGGED}> true.
}.
`;
}

function reviewQueryN3(): string {
  return `
{ ?r <${IRI_FEATURED}> true } => { ?r <${IRI_FEATURED}> true }.
{ ?r <${IRI_FLAGGED}> true }  => { ?r <${IRI_FLAGGED}> true }.
{ ?c <${PRED_VERIFIED_REVIEWER}> ?b } => { ?c <${PRED_VERIFIED_REVIEWER}> ?b }.
`;
}

async function buildReviewFacts(): Promise<string> {
  // Project the rare book (isbn + rdf:type) so both reviews can chain to it.
  const rareBookInstance = jt.instantiate(RareBookSchema, aboxFixtures.rareBook);

  // Bastian: customer + order (purchaser) + review (reviewer) — all real.
  const bastianCustomer = jt.instantiate(CustomerSchema, aboxFixtures.customer);
  const bastianOrder = jt.instantiate(OrderSchema, aboxFixtures.order);
  const bastianReview = jt.instantiate(ReviewSchema, aboxFixtures.review);

  // Unverified reviewer: a real Customer + a real Review, but NO order.
  const skepticCustomer = jt.instantiate(CustomerSchema, unverifiedCustomer);
  const skepticReview = jt.instantiate(ReviewSchema, unverifiedReview);

  const projected = [
    ...jt.toQuads(RareBookSchema, rareBookInstance, { 'iriFor': rareBookIri }),
    ...jt.toQuads(CustomerSchema, bastianCustomer, { 'iriFor': bastianIri }),
    ...jt.toQuads(OrderSchema, bastianOrder, { 'iriFor': bastianOrderIri }),
    ...jt.toQuads(ReviewSchema, bastianReview, { 'iriFor': VERIFIED_REVIEW_IRI }),
    ...jt.toQuads(CustomerSchema, skepticCustomer, { 'iriFor': unverifiedCustomerIri }),
    ...jt.toQuads(ReviewSchema, skepticReview, { 'iriFor': UNVERIFIED_REVIEW_IRI })
  ];

  return quadsToN3(projected);
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

void describe('bookstore policy — SCENARIO 1: refund eligibility (encode→reason→decode)', async () => {
  const n3reasoner = await tryLoadN3Reasoner();

  if (n3reasoner === null) {
    void it('skipped: optional peer dependency `eyereasoner` not installed', { 'skip': true }, () => {
      // Nothing — suite is skipped when reasoner peer is absent.
    });

    return;
  }

  const facts = await buildRefundFacts();
  const dataN3 = `${facts}\n${refundRulesN3()}`;
  const resultN3 = await n3reasoner(dataN3, refundQueryN3());
  const parser = new Parser({ 'format': 'N3' });
  const inferred = Lists.narrowExternalQuads(parser.parse(resultN3));

  const eligibleSubjects = inferred
    .filter((quad) => {
      return quad.predicate.value === PRED_REFUND_ELIGIBLE && quad.object.value === 'true';
    })
    .map((quad) => {
      return quad.subject.value;
    });

  const recentEpoch = jt.encode(OrderClockSchema, recentOrder.placedAt);

  void it('OrderClockSchema.encode produces epoch integer (projected date → reasoner literal)', () => {
    assert.strictEqual(typeof recentEpoch, 'number');
    assert.ok(recentEpoch > 0, 'epoch must be a positive integer');
    assert.strictEqual(recentEpoch, Math.floor(new Date(RECENT_PLACED_AT).getTime() / 1000));
  });

  void it('OrderClockSchema round-trip: encode then decode returns the order placedAt', () => {
    const decoded = jt.instantiate(OrderClockSchema, recentEpoch);

    assert.strictEqual(typeof decoded, 'string');
    // Epoch seconds has 1-second resolution; compare epoch values.
    assert.strictEqual(Math.floor(new Date(decoded).getTime() / 1000), recentEpoch);
  });

  void it('recent order (within 30 days, returnable in-print book) infers refundEligible', () => {
    assert.ok(
      eligibleSubjects.includes(recentOrderIri),
      `${recentOrderIri} should be refund-eligible; got: ${JSON.stringify(eligibleSubjects)}`
    );
  });

  void it('old order (outside 30-day window) does NOT infer refundEligible', () => {
    assert.ok(
      !eligibleSubjects.includes(oldOrderIri),
      `${oldOrderIri} must NOT be refund-eligible (placed ${OLD_PLACED_AT})`
    );
  });

  void it('rare-book order (within window, final-sale book) does NOT infer refundEligible', () => {
    // RareBook gets no :returnable assertion — the refund rule requires it —
    // so the inference is excluded by the absence of the returnable fact.
    assert.ok(
      !eligibleSubjects.includes(rareOrderIri),
      `${rareOrderIri} must NOT be refund-eligible (RareBook is final-sale)`
    );
  });

  void it('exactly one order is refund-eligible in this fixture set', () => {
    assert.strictEqual(
      eligibleSubjects.length,
      1,
      `Expected exactly 1 eligible order; got ${eligibleSubjects.length}: ${JSON.stringify(eligibleSubjects)}`
    );
  });

  void it('the derived :forBook link (projected orderLines→isbn chain) reaches the in-print book', () => {
    const forBook = inferred.filter((quad) => {
      return quad.predicate.value === PRED_FOR_BOOK && quad.subject.value === recentOrderIri;
    });

    const hit = forBook.find((quad) => {
      return quad.object.value === inPrintBookIri;
    });

    assert.ok(hit !== undefined, `${recentOrderIri} :forBook should reach ${inPrintBookIri} via the projected isbn chain`);
  });

  void it('refundEligible triples have NamedNode subjects (no literal-subject leakage)', () => {
    const refundQuads = inferred.filter((quad) => {
      return quad.predicate.value === PRED_REFUND_ELIGIBLE;
    });

    for (const quad of refundQuads) {
      assert.strictEqual(quad.subject.termType, 'NamedNode', `subject should be NamedNode: ${quad.subject.value}`);
    }
  });
});

void describe('bookstore policy — SCENARIO 2: review processing (encode→reason→decode)', async () => {
  const n3reasoner = await tryLoadN3Reasoner();

  if (n3reasoner === null) {
    void it('skipped: optional peer dependency `eyereasoner` not installed', { 'skip': true }, () => {
      // Nothing — suite is skipped when reasoner peer is absent.
    });

    return;
  }

  const facts = await buildReviewFacts();
  const dataN3 = `${facts}\n${reviewRulesN3()}`;
  const resultN3 = await n3reasoner(dataN3, reviewQueryN3());
  const parser = new Parser({ 'format': 'N3' });
  const inferred = Lists.narrowExternalQuads(parser.parse(resultN3));

  const featuredQuads = inferred.filter((quad) => {
    return quad.predicate.value === IRI_FEATURED;
  });
  const flaggedQuads = inferred.filter((quad) => {
    return quad.predicate.value === IRI_FLAGGED;
  });

  const featuredSubjects = featuredQuads.map((quad) => {
    return quad.subject.value;
  });
  const flaggedSubjects = flaggedQuads.map((quad) => {
    return quad.subject.value;
  });

  void it('verified purchaser (purchased ∧ reviewed), rating=5 review infers featuredReview', () => {
    assert.ok(
      featuredSubjects.includes(VERIFIED_REVIEW_IRI),
      `${VERIFIED_REVIEW_IRI} should be inferred as featured; got: ${JSON.stringify(featuredSubjects)}`
    );
  });

  void it('decode operates on REASONER OUTPUT: featured review predicate IRI → "featured"', () => {
    // Extract the inferred predicate IRI from an ACTUAL reasoner-produced quad
    // and decode THAT (not a hardcoded constant) into the TS verdict.
    const producedQuad = featuredQuads.find((quad) => {
      return quad.subject.value === VERIFIED_REVIEW_IRI;
    });

    assert.ok(producedQuad !== undefined, 'a featured quad must be present for the verified review');

    const decodedVerdict = jt.instantiate(ReviewVerdictSchema, producedQuad.predicate.value);

    assert.strictEqual(decodedVerdict, 'featured');
  });

  void it('unverified reviewer (no purchase), rating=2 review infers flaggedForModeration', () => {
    assert.ok(
      flaggedSubjects.includes(UNVERIFIED_REVIEW_IRI),
      `${UNVERIFIED_REVIEW_IRI} should be inferred as flagged; got: ${JSON.stringify(flaggedSubjects)}`
    );
  });

  void it('decode operates on REASONER OUTPUT: flagged review predicate IRI → "flagged"', () => {
    const producedQuad = flaggedQuads.find((quad) => {
      return quad.subject.value === UNVERIFIED_REVIEW_IRI;
    });

    assert.ok(producedQuad !== undefined, 'a flagged quad must be present for the unverified review');

    const decodedVerdict = jt.instantiate(ReviewVerdictSchema, producedQuad.predicate.value);

    assert.strictEqual(decodedVerdict, 'flagged');
  });

  void it('ReviewVerdictSchema.encode is the inverse of decode (TS union → status IRI)', () => {
    assert.strictEqual(jt.encode(ReviewVerdictSchema, 'featured'), IRI_FEATURED);
    assert.strictEqual(jt.encode(ReviewVerdictSchema, 'flagged'), IRI_FLAGGED);
  });

  void it('featured review is NOT flagged for moderation', () => {
    assert.ok(
      !flaggedSubjects.includes(VERIFIED_REVIEW_IRI),
      `${VERIFIED_REVIEW_IRI} must NOT be flagged (it is a featured review)`
    );
  });

  void it('flagged review is NOT featured', () => {
    assert.ok(
      !featuredSubjects.includes(UNVERIFIED_REVIEW_IRI),
      `${UNVERIFIED_REVIEW_IRI} must NOT be featured (it is a flagged review)`
    );
  });

  void it('verified-reviewer status was DERIVED, not injected (purchased ∧ reviewed)', () => {
    const verifiedReviewer = inferred.filter((quad) => {
      return quad.predicate.value === PRED_VERIFIED_REVIEWER
        && quad.subject.value === bastianIri
        && quad.object.value === rareBookIri;
    });

    assert.ok(
      verifiedReviewer.length > 0,
      'Bastian should be a DERIVED verified reviewer of the rare book (purchased ∧ reviewed)'
    );
  });

  void it('verdict triples have NamedNode subjects (no literal-subject leakage)', () => {
    for (const quad of [
      ...featuredQuads,
      ...flaggedQuads
    ]) {
      assert.strictEqual(quad.subject.termType, 'NamedNode', `subject should be NamedNode: ${quad.subject.value}`);
    }
  });
});

// ---------------------------------------------------------------------------
// SCENARIO 3 — annotationEmitMode: both emission paths (flat + star) for
//              the annotated-edge `verifiedPurchase` flag.
//
// The same Review projected with `annotationEmitMode: 'both'` feeds EITHER:
//   A) a flat N3 rule (`?r <schema:verified> true`) — for RDF-star-unaware tools
//   B) a star N3 rule (`<< ?r <reviews> ?b >> <schema:verified> true`) — EYE
//      reading the RDF 1.2 triple-term directly.
//
// Scenario A demonstrates: flat-only | both → flat fact → flat rule fires.
// Scenario B demonstrates: star-only | both → star quad → star-antecedent rule fires.
// ---------------------------------------------------------------------------

const REVIEW_GRAPH_IRI = 'urn:bookstore:graph:reviews';
const PRED_SCHEMA_VERIFIED = 'https://schema.org/verified';
const PRED_REVIEWS = 'https://bookstore.example/reviews';
const PRED_FEATURED_REVIEW = 'urn:example:featuredReview';
const PRED_VERIFIED_REVIEWER_OF = 'urn:example:verifiedReviewerOf';

// The review with the annotated edge (reviewsBook populated).
// Use the existing aboxFixtures.reviewWithAnnotatedEdge fixture which has:
//   reviewsBook: { target: NEVERENDING_BOOK_IRI, annotations: { ratingGiven: 5, verifiedPurchase: true } }
// Required fields are present (reviewId, bookIsbn, customerId, rating, body, postedAt).
const ANNOTATED_REVIEW_ID = aboxFixtures.reviewWithAnnotatedEdge.reviewId;
const ANNOTATED_BOOK_IRI = aboxFixtures.reviewWithAnnotatedEdge.reviewsBook.target;
const ANNOTATED_REVIEW_IRI = `urn:bookstore:review:${ANNOTATED_REVIEW_ID}`;

// N3 rule for SCENARIO A (flat antecedent): the verifiedPurchase flag projected
// as a flat `<review> <schema:verified> true` triple drives a featured-review
// inference when rating >= 4. Rules go in the `data` argument of n3reasoner.
function annotationFlatRuleN3(): string {
  return `
@prefix math: <http://www.w3.org/2000/10/swap/math#>.

{ ?r <${PRED_SCHEMA_VERIFIED}> true.
  ?r <${PRED_RATING}> ?n.
  ?n math:notLessThan 4.
} => { ?r <${PRED_FEATURED_REVIEW}> true. }.
`;
}

function annotationFlatQueryN3(): string {
  return `{ ?r <${PRED_FEATURED_REVIEW}> true } => { ?r <${PRED_FEATURED_REVIEW}> true }.`;
}

// N3 rule for SCENARIO B (star antecedent): the verifiedPurchase annotation
// rides the RDF-star triple-term. n3.js v2+ serializes triple-term subjects
// using the PARENTHESIZED RDF 1.2 notation `<<( s p o )>>`. EYE reasons over
// this form directly; the rule antecedent MUST use the same `<<( )>>` syntax
// (bare `<< >>` will silently not match). Rules go in the `data` argument.
function annotationStarRuleN3(): string {
  return `
{ <<( ?r <${PRED_REVIEWS}> ?b )>> <${PRED_SCHEMA_VERIFIED}> true.
} => { ?r <${PRED_VERIFIED_REVIEWER_OF}> ?b. }.
`;
}

function annotationStarQueryN3(): string {
  return `{ ?r <${PRED_VERIFIED_REVIEWER_OF}> ?b } => { ?r <${PRED_VERIFIED_REVIEWER_OF}> ?b }.`;
}

void describe('bookstore policy — SCENARIO 3A: annotationEmitMode flat → flat rule fires', async () => {
  const n3reasoner = await tryLoadN3Reasoner();

  if (n3reasoner === null) {
    void it('skipped: optional peer dependency `eyereasoner` not installed', { 'skip': true }, () => {
      // Nothing — suite is skipped when reasoner peer is absent.
    });

    return;
  }

  // Validate the review with the populated annotated edge.
  const annotatedReview = jt.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge);

  // Project with flat-only: verifiedPurchase emits as
  //   <reviewIri> <https://schema.org/verified> "true"^^xsd:boolean
  // alongside the base triple <reviewIri> <reviews> <bookIri>.
  // graphIri is required by the projection layer for annotated edges; we
  // strip the named-graph wrapper before sending to EYE (EYE rules operate
  // on the default graph — facts inside `<g> { ... }` blocks do not match).
  const flatQuads = jt.toQuads(ReviewSchema, annotatedReview, {
    'annotationEmitMode': 'flat-only',
    'graphIri': REVIEW_GRAPH_IRI,
    'iriFor': ANNOTATED_REVIEW_IRI
  });

  // Find the flat schema:verified quad (subject = reviewIri, NOT a triple-term).
  const flatVerifiedQuad = flatQuads.find((quad) => {
    return quad.subject.termType === 'NamedNode'
      && quad.subject.value === ANNOTATED_REVIEW_IRI
      && quad.predicate.value === PRED_SCHEMA_VERIFIED;
  });

  // Serialize to the default graph for EYE.
  const aboxN3 = await quadsToN3DefaultGraph(flatQuads);
  const dataN3 = `${aboxN3}\n${annotationFlatRuleN3()}`;

  // Warm-up: run a trivial reasoner call first (EYE WASM can be cold on first
  // call). Scenarios 1 and 2 above already warm it; if this suite runs in
  // isolation we add an explicit no-op pass.
  await n3reasoner('{ <urn:warmup:s> <urn:warmup:p> <urn:warmup:o>. } => { <urn:warmup:s> <urn:warmup:p> <urn:warmup:o>. }.', '');

  const resultN3 = await n3reasoner(dataN3, annotationFlatQueryN3());
  const parser = new Parser({ 'format': 'N3' });
  const inferred = Lists.narrowExternalQuads(parser.parse(resultN3));

  const featuredSubjects = inferred
    .filter((quad) => {
      return quad.predicate.value === PRED_FEATURED_REVIEW;
    })
    .map((quad) => {
      return quad.subject.value;
    });

  void it('flat-only projection emits a NamedNode-subject schema:verified quad (not a triple-term)', () => {
    assert.ok(
      flatVerifiedQuad !== undefined,
      `Expected a flat <${ANNOTATED_REVIEW_IRI}> <${PRED_SCHEMA_VERIFIED}> quad; none found in: ${JSON.stringify(flatQuads.map((fq) => {
        return `${fq.subject.value} ${fq.predicate.value}`;
      }))}`
    );
    assert.strictEqual(flatVerifiedQuad.subject.termType, 'NamedNode', 'flat subject must be NamedNode');
    assert.strictEqual(flatVerifiedQuad.subject.value, ANNOTATED_REVIEW_IRI);
    assert.strictEqual(flatVerifiedQuad.predicate.value, PRED_SCHEMA_VERIFIED);
  });

  void it('flat schema:verified + rating >= 4 → featuredReview inferred (SCENARIO A)', () => {
    assert.ok(
      featuredSubjects.includes(ANNOTATED_REVIEW_IRI),
      `${ANNOTATED_REVIEW_IRI} should be inferred as featuredReview via flat rule; got: ${JSON.stringify(featuredSubjects)}`
    );
  });

  void it('inferred featuredReview has a NamedNode subject', () => {
    const featuredQuad = inferred.find((quad) => {
      return quad.predicate.value === PRED_FEATURED_REVIEW && quad.subject.value === ANNOTATED_REVIEW_IRI;
    });

    assert.ok(featuredQuad !== undefined, 'featuredReview quad must exist');
    assert.strictEqual(featuredQuad.subject.termType, 'NamedNode');
  });
});

void describe('bookstore policy — SCENARIO 3B: annotationEmitMode star → star-antecedent rule fires', async () => {
  const n3reasoner = await tryLoadN3Reasoner();

  if (n3reasoner === null) {
    void it('skipped: optional peer dependency `eyereasoner` not installed', { 'skip': true }, () => {
      // Nothing — suite is skipped when reasoner peer is absent.
    });

    return;
  }

  // Validate the review with the populated annotated edge.
  const annotatedReview = jt.instantiate(ReviewSchema, aboxFixtures.reviewWithAnnotatedEdge);

  // Project with star-only: verifiedPurchase emits as the triple-term quad
  //   << <reviewIri> <reviews> <bookIri> >> <schema:verified> "true"^^xsd:boolean
  // plus the base triple <reviewIri> <reviews> <bookIri>.
  // graphIri is required by the projection layer for annotated edges; we
  // strip the named-graph wrapper before sending to EYE (EYE rules operate
  // on the default graph — facts inside `<g> { ... }` blocks do not match).
  const starQuads = jt.toQuads(ReviewSchema, annotatedReview, {
    'annotationEmitMode': 'star-only',
    'graphIri': REVIEW_GRAPH_IRI,
    'iriFor': ANNOTATED_REVIEW_IRI
  });

  // Find the star (triple-term) schema:verified quad.
  // Its subject.termType is 'Quad' (a quoted triple per RDF-star / rdf/js spec).
  const starVerifiedQuad = starQuads.find((quad) => {
    return quad.subject.termType === 'Quad'
      && quad.predicate.value === PRED_SCHEMA_VERIFIED;
  });

  // Serialize to the default graph for EYE.
  // n3.js v2+ serializes triple-term subjects using the RDF 1.2 parenthesized
  // notation `<<( s p o )>>`. We assert this is present in the serialization so
  // a reader writing their own rules knows exactly which syntax EYE expects.
  const aboxN3 = await quadsToN3DefaultGraph(starQuads);

  assert.ok(
    aboxN3.includes('<<('),
    `Expected n3.js to serialize the triple-term quad with <<( notation; got:\n${aboxN3}`
  );

  const dataN3 = `${aboxN3}\n${annotationStarRuleN3()}`;

  // Warm-up: ensure EYE WASM is hot before the star-antecedent test.
  await n3reasoner('{ <urn:warmup:s> <urn:warmup:p> <urn:warmup:o>. } => { <urn:warmup:s> <urn:warmup:p> <urn:warmup:o>. }.', '');

  const resultN3 = await n3reasoner(dataN3, annotationStarQueryN3());
  const parser = new Parser({ 'format': 'N3' });
  const inferred = Lists.narrowExternalQuads(parser.parse(resultN3));

  const verifiedReviewerQuads = inferred.filter((quad) => {
    return quad.predicate.value === PRED_VERIFIED_REVIEWER_OF;
  });

  void it('star-only projection emits a triple-term (Quad) subject schema:verified quad', () => {
    assert.ok(
      starVerifiedQuad !== undefined,
      `Expected a triple-term <${PRED_SCHEMA_VERIFIED}> quad; none found. star quad subjects: ${JSON.stringify(starQuads.map((sq) => {
        return `${sq.subject.termType}:${sq.predicate.value}`;
      }))}`
    );
    assert.strictEqual(starVerifiedQuad.subject.termType, 'Quad', 'star subject must be a quoted triple (Quad termType)');
    assert.strictEqual(starVerifiedQuad.predicate.value, PRED_SCHEMA_VERIFIED);
  });

  void it('<< review reviews book >> schema:verified true → verifiedReviewerOf inferred (SCENARIO B)', () => {
    const hit = verifiedReviewerQuads.find((quad) => {
      return quad.subject.value === ANNOTATED_REVIEW_IRI && quad.object.value === ANNOTATED_BOOK_IRI;
    });

    assert.ok(
      hit !== undefined,
      `Expected <${ANNOTATED_REVIEW_IRI}> <${PRED_VERIFIED_REVIEWER_OF}> <${ANNOTATED_BOOK_IRI}>; got: ${JSON.stringify(verifiedReviewerQuads.map((vrq) => {
        return `${vrq.subject.value} → ${vrq.object.value}`;
      }))}`
    );
  });

  void it('inferred verifiedReviewerOf has NamedNode subject and object', () => {
    const hit = verifiedReviewerQuads.find((quad) => {
      return quad.subject.value === ANNOTATED_REVIEW_IRI;
    });

    assert.ok(hit !== undefined, 'verifiedReviewerOf quad must exist');
    assert.strictEqual(hit.subject.termType, 'NamedNode');
    assert.strictEqual(hit.object.termType, 'NamedNode');
  });
});
