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
import { QuantitySchema } from './entities/Quantity.js';
import { RatingScoreSchema } from './entities/RatingScore.js';
import { ReviewIdSchema } from './entities/ReviewId.js';
import { StreetLineSchema } from './entities/StreetLine.js';
import { TitleSchema } from './entities/Title.js';

// CustomerName + AuthorName are sibling extensions of PersonName — must import after
import { AuthorNameSchema } from './entities/AuthorName.js';
import { CustomerNameSchema } from './entities/CustomerName.js';

// Money depends on Amount + CurrencyCode — must import after
import { MoneySchema } from './entities/Money.js';

// Entities — composed of named primitives via $ref
import { AddressSchema } from './entities/Address.js';
import { BookSchema } from './entities/Book.js';
import { CustomerSchema } from './entities/Customer.js';
import { OrderLineSchema } from './entities/OrderLine.js';
import { OrderSchema } from './entities/Order.js';
import { ReviewSchema } from './entities/Review.js';

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
import { SoloAuthoredBookSchema } from './entities/SoloAuthoredBook.js';

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
  QuantitySchema,
  RatingScoreSchema,
  ReviewIdSchema,
  StreetLineSchema,
  TitleSchema,
  // CustomerName + AuthorName are sibling extensions of PersonName
  AuthorNameSchema,
  CustomerNameSchema,
  // Money depends on Amount + CurrencyCode
  MoneySchema,
  // Entities
  AddressSchema,
  BookSchema,
  CustomerSchema,
  OrderLineSchema,
  OrderSchema,
  ReviewSchema,
  // Book taxonomy — must register Book first; class axioms below reference it
  EBookSchema,
  PrintBookSchema,
  RareBookSchema,
  SoloAuthoredBookSchema,
  AnthologyBookSchema,
  InPrintBookSchema,
  OutOfPrintBookSchema
] as const;

export const bookstoreEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': allSchemas
});

// ABox-level identity demo — owl:sameAs between two customer IRIs.
// In practice the bookstore migrated from a legacy CRM; some customers carry
// a stable `urn:bookstore:customer:c-{uuid}` IRI and a legacy
// `urn:bookstore:customer:legacy-{id}` IRI that resolves to the same person.
bookstoreEntities.sameAs(
  'urn:bookstore:customer:c-7af3-21e8',
  'urn:bookstore:customer:legacy-4421'
);

// Entity types derived from schemas
export type Address = InferType<typeof AddressSchema>;
export type Book = InferType<typeof BookSchema>;
export type Customer = InferType<typeof CustomerSchema>;
export type Order = InferType<typeof OrderSchema>;
export type OrderLine = InferType<typeof OrderLineSchema>;
export type Review = InferType<typeof ReviewSchema>;

// Re-export entities
export { AddressSchema } from './entities/Address.js';
// Re-export primitives
export { AmountSchema } from './entities/Amount.js';
export { AnthologyBookSchema } from './entities/AnthologyBook.js';
export { AuthorNameSchema } from './entities/AuthorName.js';
export { BookSchema } from './entities/Book.js';
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
export { QuantitySchema } from './entities/Quantity.js';
export { RareBookSchema } from './entities/RareBook.js';

export { RatingScoreSchema } from './entities/RatingScore.js';
export { ReviewSchema } from './entities/Review.js';
export { ReviewIdSchema } from './entities/ReviewId.js';
export { SoloAuthoredBookSchema } from './entities/SoloAuthoredBook.js';
export { StreetLineSchema } from './entities/StreetLine.js';
export { TitleSchema } from './entities/Title.js';
