/**
 * ABox fixtures — concrete instance data for the canonical bookstore
 * scenario: customer Bastian Balthazar Bux orders a rare 1979 first
 * edition of Michael Ende's "Die unendliche Geschichte".
 *
 * The cast is drawn from the framing story of Michael Ende's
 * *The Neverending Story* (Thienemann Verlag, 1979): Bastian is the
 * boy who, in the opening of the novel, takes the same book from
 * Carl Conrad Coreander's antique bookshop. Reusing those names here
 * keeps every doc page anchored to one durable narrative.
 *
 * Field names match the registered schemas verbatim. The smoke test
 * `test/smoke/bookstoreFixtures.test.ts` calls
 * `bookstoreEntities.instantiate(<SchemaId>, fixture)` on every entry
 * so any drift between schema and fixture trips a failing test, not a
 * silently-wrong example.
 *
 * Two sameAs identity pairs (declared in `index.ts`) link these
 * fixtures to legacy / external IRIs:
 *
 *   urn:bookstore:customer:bastian-bux ↔ urn:coreander-antiquariat:cust-00042
 *   urn:bookstore:rarebook:neverending-1979-thienemann ↔ http://www.worldcat.org/oclc/5705614
 */

// Shared so Customer.addresses[0] and Order.shippingAddress stay in sync —
// Bastian's order ships to the address they registered with.
export const BASTIAN_HOME_ADDRESS = {
  'city': 'München',
  'country': 'DE',
  'postalCode': '80331',
  'street': 'Reichenbachstraße 14'
} as const;

export const BASTIAN_ID = 'c1a2b3d4-e5f6-7890-abcd-ef1234567890';
// ISBN-13 of the 1979 Thienemann Verlag first edition of
// Michael Ende's Die unendliche Geschichte.
export const NEVERENDING_ISBN = '9783522128001';
export const NEVERENDING_PRICE = {
  'amount': 850,
  'currency': 'EUR'
} as const;

export const aboxFixtures = {
  'customer': {
    'addresses': [BASTIAN_HOME_ADDRESS],
    'email': 'bastian.bux@bookstore.example',
    'id': BASTIAN_ID,
    'name': 'Bastian Balthazar Bux'
  } as const,
  'order': {
    'customerId': BASTIAN_ID,
    'id': '09f8e7d6-c5b4-3210-9876-543210fedcba',
    'items': [{
      'bookIsbn': NEVERENDING_ISBN,
      'quantity': 1,
      'unitPrice': NEVERENDING_PRICE
    }],
    'placedAt': '2026-04-12T14:23:11Z',
    'shippingAddress': BASTIAN_HOME_ADDRESS,
    'total': NEVERENDING_PRICE
  } as const,
  'rareBook': {
    'authors': ['Michael Ende'],
    'binding': 'hardcover',
    'estimatedAgeYears': 47,
    'firstEditionYear': 1979,
    'inStock': true,
    'isbn': NEVERENDING_ISBN,
    'pageCount': 428,
    'price': NEVERENDING_PRICE,
    // The 1979 Thienemann Verlag printing is long discontinued; copies
    // surface only through the antiquarian market. inStock + outOfPrint
    // coexisting is the canonical case.
    'printStatus': 'outOfPrint',
    'publishedOn': '1979-09-01',
    // StockLevel is multipleOf 5; the shop tracks rare-book inventory in
    // batches of 5 even when only a single signed copy is actively on hand.
    'stockLevel': 5,
    'title': 'Die unendliche Geschichte',
    'weightGrams': 980
  } as const,
  'review': {
    'body': "Ende's framing of a reader who reads themself into a story is craftsmanship of the highest order; this Thienemann first edition with the red and green ink intact is the only way to read it.",
    'bookIsbn': NEVERENDING_ISBN,
    'customerId': BASTIAN_ID,
    'id': 'a4d3c2b1-a098-7654-a210-fedcba987654',
    'postedAt': '2026-04-20T09:15:00Z',
    'rating': 5
  } as const
} as const;
