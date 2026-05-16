import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';

// Primitives — named, single source of truth per concept
import { AmountSchema } from './entities/Amount.js';
import { CityNameSchema } from './entities/CityName.js';
import { CountryCodeSchema } from './entities/CountryCode.js';
import { CurrencyCodeSchema } from './entities/CurrencyCode.js';
import { CustomerIdSchema } from './entities/CustomerId.js';
import { EmailSchema } from './entities/Email.js';
import { IsbnSchema } from './entities/Isbn.js';
import { Iso8601Schema } from './entities/Iso8601.js';
import { OrderIdSchema } from './entities/OrderId.js';
import { PersonNameSchema } from './entities/PersonName.js';
import { PostalCodeSchema } from './entities/PostalCode.js';
import { PublicationDateSchema } from './entities/PublicationDate.js';
import { QuantitySchema } from './entities/Quantity.js';
import { RatingScoreSchema } from './entities/RatingScore.js';
import { ReviewIdSchema } from './entities/ReviewId.js';
import { StockLevelSchema } from './entities/StockLevel.js';
import { StreetLineSchema } from './entities/StreetLine.js';
import { TitleSchema } from './entities/Title.js';

// CustomerName + AuthorName are sibling extensions of PersonName — must import after
import { AuthorNameSchema } from './entities/AuthorName.js';
import { CustomerNameSchema } from './entities/CustomerName.js';

// Money depends on Amount + CurrencyCode — must import after
import { MoneySchema } from './entities/Money.js';

// Entities — composed of named primitives via $ref
import { AddressSchema } from './entities/Address.js';
import { BookAnnotationsSchema } from './entities/BookAnnotations.js';
import { BookCatalogEntrySchema } from './entities/BookCatalogEntry.js';
import { BookRatingHistogramSchema } from './entities/BookRatingHistogram.js';
import { BookSchema } from './entities/Book.js';
import { CustomerSchema } from './entities/Customer.js';
import { OrderLineSchema } from './entities/OrderLine.js';
import { OrderSchema } from './entities/Order.js';
import { ReviewSchema } from './entities/Review.js';

// BookListPage depends on Book — must import after
import { BookListPageSchema } from './entities/BookListPage.js';

// Book taxonomy — Compose.subClassOf / disjointWith / complementOf / restrictions
//
// EBookSchema and PrintBookSchema are disjoint subclasses of Book (subClassOf
// + disjointWith). RareBookSchema layers two restrictions onto PrintBook
// (someValuesFrom + maxCardinality). The remaining four classes each cover
// one of the other restriction methods so every Compose.* surface lands in
// the live ontology graph:
//
//   SoloAuthoredBook  — Compose.cardinality(authors, 1)
//   AnthologyBook     — Compose.minCardinality(authors, 2) + allValuesFrom
//   InPrintBook       — Compose.hasValue(inStock, true)
//   OutOfPrintBook    — Compose.complementOf(InPrintBook), bounded to Book
import { AnthologyBookSchema } from './entities/AnthologyBook.js';
import { EBookSchema } from './entities/EBook.js';
import { InPrintBookSchema } from './entities/InPrintBook.js';
import { OutOfPrintBookSchema } from './entities/OutOfPrintBook.js';
import { PrintBookSchema } from './entities/PrintBook.js';
import { RareBookSchema } from './entities/RareBook.js';
import { SignedFirstEditionSchema } from './entities/SignedFirstEdition.js';
import { SoloAuthoredBookSchema } from './entities/SoloAuthoredBook.js';

// Property-characteristic relation entities — OWL 2 axiom demonstrations
// SimilarBook and Sequel both $ref Book, so they must import after BookSchema.
import { SequelSchema } from './entities/Sequel.js';
import { SimilarBookSchema } from './entities/SimilarBook.js';

const allSchemas = [
  // Primitives must register before entities that $ref them
  AmountSchema,
  CityNameSchema,
  CountryCodeSchema,
  CurrencyCodeSchema,
  CustomerIdSchema,
  EmailSchema,
  IsbnSchema,
  Iso8601Schema,
  OrderIdSchema,
  PersonNameSchema,
  PostalCodeSchema,
  PublicationDateSchema,
  QuantitySchema,
  RatingScoreSchema,
  ReviewIdSchema,
  StockLevelSchema,
  StreetLineSchema,
  TitleSchema,
  // CustomerName + AuthorName are sibling extensions of PersonName
  AuthorNameSchema,
  CustomerNameSchema,
  // Money depends on Amount + CurrencyCode
  MoneySchema,
  // Entities (no $ref inter-deps among new ones; BookCatalogEntry $refs Isbn which is above)
  AddressSchema,
  BookAnnotationsSchema,
  BookCatalogEntrySchema,
  BookRatingHistogramSchema,
  BookSchema,
  CustomerSchema,
  OrderLineSchema,
  OrderSchema,
  ReviewSchema,
  // BookListPage depends on Book — must register after Book
  BookListPageSchema,
  // Book taxonomy — must register Book first; class axioms below reference it
  EBookSchema,
  PrintBookSchema,
  RareBookSchema,
  SoloAuthoredBookSchema,
  AnthologyBookSchema,
  InPrintBookSchema,
  OutOfPrintBookSchema,
  // SignedFirstEdition extends both RareBook and SoloAuthoredBook — must
  // register after both of those (multi-parent subClassOf).
  SignedFirstEditionSchema,
  // Property-characteristic relation entities — $ref Book, must register after
  SimilarBookSchema,
  SequelSchema
] as const;

export const bookstoreEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': allSchemas
});

// ──────────────────────────────────────────────────────────────────────────
// ABox: a customer placing an order for a rare book.
//
// Concrete individuals demonstrated by this scenario:
//   • Customer Alice Smith — has both the current bookstore IRI and the
//     legacy CRM ID (`cust-00042`) the bookstore inherited from a 2024
//     systems migration. owl:sameAs lets a reasoner merge facts from both
//     authoritative sources.
//   • A rare first-edition Frank Herbert's "Dune" (Chilton Books, 1965).
//     Has both the bookstore catalog IRI and the WorldCat OCLC record IRI;
//     declaring sameAs unifies bibliographic facts across catalogs.
//   • Alice's order containing one line item for the rare book.
//
// Only the owl:sameAs identity assertions register into the registry
// (and thereby appear in the live graph as gold-dashed instance ellipses).
// The order/customer/rare-book instance values themselves are shown below
// as runtime data the user would pass to `instantiate()` / `toQuads()` —
// they are documentation, not registry state.
// ──────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────
// Cross-field rules registered against the production schemas. These are
// json-tology's first-class concepts for ABox-level constraints that
// can't be expressed structurally (a relation between two property
// values). They fire on every `instantiate(OrderSchema, ...)` call and
// surface as `INVARIANT_VIOLATION` errors in the same `ValidationErrors`
// collection the structural checks use.
// ──────────────────────────────────────────────────────────────────────────

// Invariant: an Order's `total.amount` must equal Σ items[i].unitPrice.amount × items[i].quantity.
// Demonstrates `addInvariant` on the real OrderSchema (not a docs-only variant).
bookstoreEntities.addInvariant<{
  'items'?: ReadonlyArray<{ 'quantity'?: number;
    'unitPrice'?: { 'amount'?: number } }>;
  'total'?: { 'amount'?: number };
}>(OrderSchema.$id, {
  'fn': (order) => {
    const items = order.items ?? [];
    const computed = items.reduce((sum, line) => {
      const quantity = line.quantity ?? 0;
      const unitAmount = line.unitPrice?.amount ?? 0;

      return sum + (unitAmount * quantity);
    }, 0);
    const reported = order.total?.amount ?? 0;

    if (Math.abs(reported - computed) < 0.005) {
      return null;
    }

    return `Order total ${reported} does not equal Σ items[i].unitPrice.amount × quantity = ${computed}`;
  },
  'name': 'orderTotalMatchesItems',
  'pointer': '/total/amount'
});

bookstoreEntities.sameAs(
  'urn:bookstore:customer:alice-smith',
  'urn:legacy-crm:cust-00042'
);
bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:dune-1965-chilton',
  'http://www.worldcat.org/oclc/463127'
);

// Shared address record used by both Customer.addresses[0] and
// Order.shippingAddress so the scenario stays internally consistent —
// Alice's order ships to the same address she registered with.
const ALICE_HOME_ADDRESS = {
  'city': 'Springfield',
  'country': 'US',
  'postalCode': '49007',
  'street': '742 Evergreen Terrace'
} as const;

const ALICE_ID = 'c1a2b3d4-e5f6-7890-abcd-ef1234567890';
const DUNE_ISBN = '9780441172719';
const DUNE_PRICE = {
  'amount': 12_500,
  'currency': 'USD'
} as const;

/**
 * Runtime ABox instance values for the customer-orders-rare-book scenario.
 * Field names match the registered schemas verbatim — passing each fixture
 * to `bookstoreEntities.instantiate(<SchemaId>, fixture)` is the
 * authoritative compliance check; `verifyAboxFixtures()` below runs that
 * validation at module-load time so any drift between schema and fixture
 * surfaces immediately.
 */
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

// Entity types derived from schemas
export type Address = InferType<typeof AddressSchema>;
export type Book = InferType<typeof BookSchema>;
export type Customer = InferType<typeof CustomerSchema>;
export type Order = InferType<typeof OrderSchema>;
export type OrderLine = InferType<typeof OrderLineSchema>;
export type Review = InferType<typeof ReviewSchema>;

// Re-export all schemas — sorted by module specifier (perfectionist/sort-exports)
export { AddressSchema } from './entities/Address.js';
export { AmountSchema } from './entities/Amount.js';
export { AnthologyBookSchema } from './entities/AnthologyBook.js';
export { AuthorNameSchema } from './entities/AuthorName.js';
export { BookSchema } from './entities/Book.js';
export { BookAnnotationsSchema } from './entities/BookAnnotations.js';
export { BookCatalogEntrySchema } from './entities/BookCatalogEntry.js';
export { BookListPageSchema } from './entities/BookListPage.js';
export { BookRatingHistogramSchema } from './entities/BookRatingHistogram.js';
export { CityNameSchema } from './entities/CityName.js';
export { CountryCodeSchema } from './entities/CountryCode.js';
export { CurrencyCodeSchema } from './entities/CurrencyCode.js';
export { CustomerSchema } from './entities/Customer.js';
export { CustomerIdSchema } from './entities/CustomerId.js';
export { CustomerNameSchema } from './entities/CustomerName.js';
export { EBookSchema } from './entities/EBook.js';
export { EmailSchema } from './entities/Email.js';
export { InPrintBookSchema } from './entities/InPrintBook.js';
export { IsbnSchema } from './entities/Isbn.js';
export { Iso8601Schema } from './entities/Iso8601.js';
export { MoneySchema } from './entities/Money.js';
export { OrderSchema } from './entities/Order.js';
export { OrderIdSchema } from './entities/OrderId.js';
export { OrderLineSchema } from './entities/OrderLine.js';
export { OutOfPrintBookSchema } from './entities/OutOfPrintBook.js';
export { PersonNameSchema } from './entities/PersonName.js';
export { PostalCodeSchema } from './entities/PostalCode.js';
export { PrintBookSchema } from './entities/PrintBook.js';
export { PublicationDateSchema } from './entities/PublicationDate.js';
export { QuantitySchema } from './entities/Quantity.js';
export { RareBookSchema } from './entities/RareBook.js';
export { RatingScoreSchema } from './entities/RatingScore.js';
export { ReviewSchema } from './entities/Review.js';
export { ReviewIdSchema } from './entities/ReviewId.js';
export { SequelSchema } from './entities/Sequel.js';
export { SignedFirstEditionSchema } from './entities/SignedFirstEdition.js';
export { SimilarBookSchema } from './entities/SimilarBook.js';
export { SoloAuthoredBookSchema } from './entities/SoloAuthoredBook.js';
export { StockLevelSchema } from './entities/StockLevel.js';
export { StreetLineSchema } from './entities/StreetLine.js';
export { TitleSchema } from './entities/Title.js';
