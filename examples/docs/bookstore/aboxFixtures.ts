/**
 * ABox fixtures — concrete instance data for the canonical bookstore
 * scenario: customer Alice Smith orders a rare 1965 first-edition Dune.
 *
 * Field names match the registered schemas verbatim. The smoke test
 * `test/smoke/bookstoreFixtures.test.ts` calls
 * `bookstoreEntities.instantiate(<SchemaId>, fixture)` on every entry to
 * guarantee that any drift between schema and fixture trips a failing
 * test, not a silently-wrong example.
 *
 * Two sameAs identity pairs (declared in `index.ts`) link these
 * fixtures to legacy / external IRIs:
 *
 *   urn:bookstore:customer:alice-smith   ↔ urn:legacy-crm:cust-00042
 *   urn:bookstore:rarebook:dune-1965-chilton ↔ http://www.worldcat.org/oclc/463127
 */

// Shared so Customer.addresses[0] and Order.shippingAddress stay in sync —
// Alice's order ships to the address she registered with.
export const ALICE_HOME_ADDRESS = {
  'city': 'Springfield',
  'country': 'US',
  'postalCode': '49007',
  'street': '742 Evergreen Terrace'
} as const;

export const ALICE_ID = 'c1a2b3d4-e5f6-7890-abcd-ef1234567890';
export const DUNE_ISBN = '9780441172719';
export const DUNE_PRICE = {
  'amount': 12_500,
  'currency': 'USD'
} as const;

export const aboxFixtures = {
  'customer': {
    'addresses': [ALICE_HOME_ADDRESS],
    'email': 'alice@bookstore.example',
    'id': ALICE_ID,
    'name': 'Alice Smith'
  } as const,
  'order': {
    'customerId': ALICE_ID,
    'id': '09f8e7d6-c5b4-3210-9876-543210fedcba',
    'items': [{
      'bookIsbn': DUNE_ISBN,
      'quantity': 1,
      'unitPrice': DUNE_PRICE
    }],
    'placedAt': '2026-04-12T14:23:11Z',
    'shippingAddress': ALICE_HOME_ADDRESS,
    'total': DUNE_PRICE
  } as const,
  'rareBook': {
    'authors': ['Frank Herbert'],
    'binding': 'hardcover',
    'estimatedAgeYears': 61,
    'firstEditionYear': 1965,
    'inStock': true,
    'isbn': DUNE_ISBN,
    'pageCount': 412,
    'price': DUNE_PRICE,
    // Chilton's 1965 print run is long discontinued; copies on the secondary
    // market only. inStock + outOfPrint coexisting is the canonical case.
    'printStatus': 'outOfPrint',
    'publishedOn': '1965-08-01',
    // StockLevel is multipleOf 5; the shop tracks rare-book inventory in
    // batches of 5 even when only a single signed copy is actively on hand.
    'stockLevel': 5,
    'title': 'Dune',
    'weightGrams': 820
  } as const,
  'review': {
    'body': "A foundational work of science fiction. Herbert's worldbuilding is unparalleled and this first edition is in remarkable condition.",
    'bookIsbn': DUNE_ISBN,
    'customerId': ALICE_ID,
    'id': 'a4d3c2b1-a098-7654-a210-fedcba987654',
    'postedAt': '2026-04-20T09:15:00Z',
    'rating': 5
  } as const
} as const;
