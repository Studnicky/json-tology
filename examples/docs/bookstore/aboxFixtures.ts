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
// ISBN-13 of Michael Ende's Momo — the predecessor in the Neverending
// Story universe that most readers encounter first.
export const MOMO_ISBN = '9783522129503';
export const NEVERENDING_PRICE = {
  'amount': 850,
  'currency': 'EUR'
} as const;
// The bookstore IRI for the Neverending Story book individual (used by the
// annotated-edge fixture to supply a dereferenceable target IRI).
export const NEVERENDING_BOOK_IRI
  = 'https://bookstore.example/books/9783522128001';

export const aboxFixtures = {
  'bookCatalogEntry': {
    'isbn': NEVERENDING_ISBN,
    'variants': [
      {
        'kind': 'hardcover',
        'variantPrice': 850
      },
      {
        'kind': 'paperback',
        'variantPrice': 420
      }
    ]
  } as const,
  'bookCatalogEntryWithVariant': {
    'isbn': MOMO_ISBN,
    'variants': [{
      'kind': 'ebook',
      'variantPrice': 699
    }]
  } as const,
  'bookListPage': {
    'books': [{
      'authors': ['Michael Ende'],
      'isbn': NEVERENDING_ISBN,
      'price': NEVERENDING_PRICE,
      'printStatus': 'outOfPrint',
      'title': 'Die unendliche Geschichte'
    }],
    'hasNext': false,
    'hasPrev': false,
    'page': 1,
    'pageSize': 10,
    'resultCount': 1,
    'totalPages': 1
  } as const,
  'customer': {
    'addresses': [BASTIAN_HOME_ADDRESS],
    'customerId': BASTIAN_ID,
    'email': 'bastian.bux@bookstore.example',
    'name': 'Bastian Balthazar Bux'
  } as const,
  'ebook': {
    'authors': ['Michael Ende'],
    // downloadUrl emits as a NamedNode (x-jt-iriRef: true on DownloadUrl)
    'downloadUrl': 'https://bookstore.example/downloads/9783522128001.epub',
    'epubVersion': '3.2',
    'fileFormat': 'epub',
    'fileSizeBytes': 3_145_728,
    'isbn': NEVERENDING_ISBN,
    'price': {
      'amount': 699,
      'currency': 'EUR'
    },
    'printStatus': 'outOfPrint',
    'title': 'Die unendliche Geschichte (eBook)'
  } as const,
  'order': {
    'customerId': BASTIAN_ID,
    'orderId': '09f8e7d6-c5b4-3210-9876-543210fedcba',
    'orderLines': [{
      'bookIsbn': NEVERENDING_ISBN,
      'quantity': 1,
      'unitPrice': NEVERENDING_PRICE
    }],
    'orderTotal': NEVERENDING_PRICE,
    'placedAt': '2026-04-12T14:23:11Z',
    'shippingAddress': BASTIAN_HOME_ADDRESS
  } as const,
  'printBook': {
    'authors': ['Michael Ende'],
    'binding': 'hardcover',
    'isbn': NEVERENDING_ISBN,
    'pageCount': 428,
    'price': NEVERENDING_PRICE,
    'printStatus': 'outOfPrint',
    'title': 'Die unendliche Geschichte',
    'weightGrams': 980
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
    'postedAt': '2026-04-20T09:15:00Z',
    'rating': 5,
    'reviewId': 'a4d3c2b1-a098-7654-a210-fedcba987654'
  } as const,
  /**
   * reviewWithAnnotatedEdge — demonstrates jt:annotatedEdge (RDF-star).
   *
   * The `reviewsBook` field uses the `ReviewsBookEdge` annotated-edge schema:
   * `toQuads` emits the base triple
   *   <review-iri> <https://bookstore.example/reviews> <book-iri>
   * PLUS one triple-term annotation quad:
   *   << <review-iri> <https://bookstore.example/reviews> <book-iri> >>
   *     <…#ratingGiven>  "5"^^xsd:integer .
   *
   * This fixture requires a `graphIRI` option when calling `toQuads`
   * (see the smoke test and bookstoreGraphData ABox projection).
   */
  'reviewWithAnnotatedEdge': {
    'body': "Ende's framing of a reader who reads themself into a story is craftsmanship of the highest order; this Thienemann first edition with the red and green ink intact is the only way to read it.",
    'bookIsbn': NEVERENDING_ISBN,
    'customerId': BASTIAN_ID,
    'postedAt': '2026-04-20T09:15:00Z',
    'rating': 5,
    'reviewId': 'a4d3c2b1-a098-7654-a210-fedcba987654',
    'reviewsBook': {
      'annotations': { 'ratingGiven': 5 },
      'target': NEVERENDING_BOOK_IRI
    }
  } as const,
  'sequel': {
    'book': {
      'authors': ['Michael Ende'],
      'isbn': NEVERENDING_ISBN,
      'price': NEVERENDING_PRICE,
      'printStatus': 'outOfPrint',
      'title': 'Die unendliche Geschichte'
    },
    // asymmetric: true on `predecessor` — the Neverending Story cannot
    // simultaneously be a sequel of Momo (publication order is irreversible).
    'predecessor': {
      'authors': ['Michael Ende'],
      'isbn': MOMO_ISBN,
      'price': {
        'amount': 380,
        'currency': 'EUR'
      },
      'printStatus': 'inPrint',
      'title': 'Momo'
    }
  } as const,
  'signedFirstEdition': {
    'authors': ['Michael Ende'],
    'binding': 'hardcover',
    'estimatedAgeYears': 47,
    'firstEditionYear': 1979,
    'isbn': NEVERENDING_ISBN,
    'pageCount': 428,
    'price': NEVERENDING_PRICE,
    'printStatus': 'outOfPrint',
    // provenance text is emitted with @de language tag (x-jt-language: 'de'
    // on ProvenanceSchema). Describes the chain of custody in German prose,
    // consistent with the München-set narrative.
    'provenance': 'Erworben aus dem Nachlass von Carl Conrad Coreander, München, 1994. Signiert M.E. in blauer Tinte auf der Schmutztitelseite.',
    'signedBy': 'Michael Ende',
    'title': 'Die unendliche Geschichte',
    'weightGrams': 980
  } as const,
  'similarBook': {
    'a': {
      'authors': ['Michael Ende'],
      'isbn': NEVERENDING_ISBN,
      'price': NEVERENDING_PRICE,
      'printStatus': 'outOfPrint',
      'title': 'Die unendliche Geschichte'
    },
    // b carries symmetric: true + reflexive: true in SimilarBookSchema.
    // symmetric: if Die unendliche Geschichte is similar to Momo, then Momo
    //            is similar to Die unendliche Geschichte (undirected).
    // reflexive: a book is considered similar to itself (identity base case).
    'b': {
      'authors': ['Michael Ende'],
      'isbn': MOMO_ISBN,
      'price': {
        'amount': 380,
        'currency': 'EUR'
      },
      'printStatus': 'inPrint',
      'title': 'Momo'
    }
  } as const
} as const;
