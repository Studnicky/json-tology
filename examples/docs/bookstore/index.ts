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
import { PrintStatusSchema } from './entities/PrintStatus.js';
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
// + disjointWith). RareBookSchema layers restrictions onto PrintBook
// (someValuesFrom + maxCardinality on authors). InPrintBook /
// OutOfPrintBook discriminate on Book.printStatus, which is the editorial
// publisher state (orthogonal to inventory `inStock`).
//
// `SoloAuthoredBook` and `AnthologyBook` used to live here as registered
// schemas that only constrained `authors` cardinality. They added no
// structural fields and so do not earn distinct OWL class identity.
// Single-authorship now lives as the registered invariant
// `signedFirstEditionIsSoloAuthored` on `SignedFirstEditionSchema` — a
// cross-field rule that fires alongside structural validation. The
// `Compose.cardinality / minCardinality / allValuesFrom` builder surfaces
// are exercised in `examples/docs/composition/restrictions.ts` against
// standalone demo schemas (not registered).
import { EBookSchema } from './entities/EBook.js';
import { InPrintBookSchema } from './entities/InPrintBook.js';
import { OutOfPrintBookSchema } from './entities/OutOfPrintBook.js';
import { PrintBookSchema } from './entities/PrintBook.js';
import { RareBookSchema } from './entities/RareBook.js';
import { SignedFirstEditionSchema } from './entities/SignedFirstEdition.js';

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
  PrintStatusSchema,
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
  InPrintBookSchema,
  OutOfPrintBookSchema,
  // SignedFirstEdition extends RareBook — register after RareBook.
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
// Concrete individuals demonstrated by this scenario (drawn from the
// framing story of Michael Ende's *The Neverending Story*):
//   • Customer Bastian Balthazar Bux — has both the current bookstore
//     IRI and the legacy antiquariat ID (`cust-00042`) the bookstore
//     inherited from Carl Conrad Coreander's antique shop records.
//     owl:sameAs lets a reasoner merge facts from both authoritative
//     sources.
//   • A rare first edition of Michael Ende's "Die unendliche Geschichte"
//     (Thienemann Verlag, Stuttgart, 1979). Has both the bookstore
//     catalog IRI and the WorldCat OCLC record IRI; declaring sameAs
//     unifies bibliographic facts across catalogs.
//   • Bastian's order containing one line item for the rare book.
//
// Only the owl:sameAs identity assertions register into the registry
// (and thereby appear in the live graph as gold-dashed instance ellipses).
// The order/customer/rare-book instance values themselves are exported
// from `./aboxFixtures.ts` as runtime data a user would pass to
// `instantiate()` / `toQuads()` — they are documentation, not registry
// state.
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

// Invariant: a SignedFirstEdition has exactly one author. The OWL parent
// `RareBook` already declares `maxCardinality(authors, 1)`; this invariant
// is the runtime-enforceable companion (json-tology will surface it in
// ValidationErrors before any OWL reasoner runs).
bookstoreEntities.addInvariant<{
  'authors'?: readonly string[];
}>(SignedFirstEditionSchema.$id, {
  'fn': (book) => {
    const count = book.authors?.length ?? 0;

    if (count === 1) {
      return null;
    }

    return `SignedFirstEdition must have exactly one author, got ${count}`;
  },
  'name': 'signedFirstEditionIsSoloAuthored',
  'pointer': '/authors'
});

bookstoreEntities.sameAs(
  'urn:bookstore:customer:bastian-bux',
  'urn:coreander-antiquariat:cust-00042'
);
bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:neverending-1979-thienemann',
  'http://www.worldcat.org/oclc/5705614'
);

// Concrete ABox instance values for the Bastian-orders-Neverending-Story scenario.
// Lives in its own file so any doc page can `<<<` include the fixtures
// without dragging in the registry construction.
export { aboxFixtures } from './aboxFixtures.js';

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
export { PrintStatusSchema } from './entities/PrintStatus.js';
export { PublicationDateSchema } from './entities/PublicationDate.js';
export { QuantitySchema } from './entities/Quantity.js';
export { RareBookSchema } from './entities/RareBook.js';
export { RatingScoreSchema } from './entities/RatingScore.js';
export { ReviewSchema } from './entities/Review.js';
export { ReviewIdSchema } from './entities/ReviewId.js';
export { SequelSchema } from './entities/Sequel.js';
export { SignedFirstEditionSchema } from './entities/SignedFirstEdition.js';
export { SimilarBookSchema } from './entities/SimilarBook.js';
export { StockLevelSchema } from './entities/StockLevel.js';
export { StreetLineSchema } from './entities/StreetLine.js';
export { TitleSchema } from './entities/Title.js';
