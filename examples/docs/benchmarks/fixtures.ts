/**
 * Shared fixtures for benchmarks.
 *
 * All json-tology schemas in this file are the canonical bookstore schemas
 * exported from `examples/docs/bookstore/`. There are no aliases and no
 * benchmark-only synthetic schemas — every json-tology validator in the
 * bench suite runs against the same schemas as the rest of the docs,
 * smoke tests, and integration tests.
 *
 * Bench role → bookstore schema:
 *
 *   "flat object"   → ReviewSchema   (6 primitive-typed required properties)
 *   "address"       → AddressSchema  (4 string primitives via $ref)
 *   "medium"        → CustomerSchema (id, email, name, addresses[] with default [])
 *   "order line"    → OrderLineSchema (Isbn / Quantity / Money $refs)
 *   "deep nested"   → OrderSchema    (multi-level $refs: Address, Money, OrderLine)
 *   "defaults"      → CustomerSchema (addresses property declares `default: []`)
 *
 * Comparator schemas (zod, valibot, typebox, ajv, io-ts) are re-declared to
 * match each bookstore wire shape exactly — real uuid / email / ISBN-13 /
 * ISO 8601 / currency-enum constraints — so results stay comparable across
 * libraries.
 *
 * Instance values are derived from `aboxFixtures` (the Bastian Balthazar Bux
 * orders Die unendliche Geschichte scenario). Invalid / coercible variants
 * are produced by mutating those fixtures.
 */

import { Type } from '@sinclair/typebox';
import {
  Ajv, type ValidateFunction
} from 'ajv';
import addFormatsNs from 'ajv-formats';
import {
  array as iotArray,
  literal as iotLiteral,
  number as iotNumber,
  refinement as iotRefinement,
  string as iotString,
  type as iotType,
  union as iotUnion
} from 'io-ts';
import { z } from 'zod';
import {
  array as vArray,
  integer as vInteger,
  isoTimestamp as vIsoTimestamp,
  maxLength as vMaxLength,
  maxValue as vMaxValue,
  minLength as vMinLength,
  minValue as vMinValue,
  number as vNumber,
  object as vObject,
  picklist as vPicklist,
  pipe as vPipe,
  regex as vRegex,
  string as vString,
  uuid as vUuid
} from 'valibot';

import {
  AddressSchema,
  AmountSchema,
  AuthorNameSchema,
  BindingTypeSchema,
  BookAnnotationsSchema,
  BookCatalogEntrySchema,
  BookListPageSchema,
  BookRatingHistogramSchema,
  BookSchema,
  CityNameSchema,
  CountryCodeSchema,
  CurrencyCodeSchema,
  CustomerIdSchema,
  CustomerNameSchema,
  CustomerSchema,
  DownloadUrlSchema,
  EBookFormatSchema,
  EBookSchema,
  EmailSchema,
  EstimatedAgeYearsSchema,
  FileSizeBytesSchema,
  FirstEditionYearSchema,
  InPrintBookSchema,
  IsbnSchema,
  Iso8601Schema,
  MoneySchema,
  OrderIdSchema,
  OrderLineSchema,
  OrderSchema,
  OutOfPrintBookSchema,
  PageCountSchema,
  PageNumberSchema,
  PageSizeSchema,
  PersonNameSchema,
  PostalCodeSchema,
  PrintBookSchema,
  PrintPageCountSchema,
  PrintStatusSchema,
  ProvenanceSchema,
  PublicationDateSchema,
  QuantitySchema,
  RareBookSchema,
  RatingCountSchema,
  RatingScoreSchema,
  ReviewBodySchema,
  ReviewIdSchema,
  ReviewSchema,
  SequelSchema,
  SignedFirstEditionSchema,
  SimilarBookSchema,
  StockLevelSchema,
  StreetLineSchema,
  TitleSchema,
  WeightGramsSchema
} from '../bookstore/index.js';
import { aboxFixtures } from '../bookstore/aboxFixtures.js';

// ---------------------------------------------------------------------------
// AJV instance (shared)
// ---------------------------------------------------------------------------

export const ajvInstance = new Ajv({ 'allErrors': true });
addFormatsNs.default(ajvInstance);

// ---------------------------------------------------------------------------
// Bookstore schemas to register on every bench SchemaRegistry.
//
// $refs in OrderSchema / CustomerSchema / ReviewSchema span every primitive
// in the bookstore module. Bench registries are constructed fresh so they
// cannot reuse `bookstoreEntities`; instead they register this full closure
// of schemas so every $ref resolves.
// ---------------------------------------------------------------------------

export const bookstoreBenchSchemas = [
  // Primitives first — every $ref target must be present before its referrer.
  AmountSchema,
  BindingTypeSchema,
  CityNameSchema,
  CountryCodeSchema,
  CurrencyCodeSchema,
  CustomerIdSchema,
  DownloadUrlSchema,
  EBookFormatSchema,
  EmailSchema,
  EstimatedAgeYearsSchema,
  FileSizeBytesSchema,
  FirstEditionYearSchema,
  IsbnSchema,
  Iso8601Schema,
  OrderIdSchema,
  PageCountSchema,
  PageNumberSchema,
  PageSizeSchema,
  PersonNameSchema,
  PostalCodeSchema,
  PrintPageCountSchema,
  PrintStatusSchema,
  ProvenanceSchema,
  PublicationDateSchema,
  QuantitySchema,
  RatingCountSchema,
  RatingScoreSchema,
  ReviewBodySchema,
  ReviewIdSchema,
  StockLevelSchema,
  StreetLineSchema,
  TitleSchema,
  WeightGramsSchema,
  AuthorNameSchema,
  CustomerNameSchema,
  MoneySchema,
  // Entities composed from the primitives above.
  AddressSchema,
  BookAnnotationsSchema,
  BookCatalogEntrySchema,
  BookRatingHistogramSchema,
  BookSchema,
  CustomerSchema,
  OrderLineSchema,
  OrderSchema,
  ReviewSchema,
  BookListPageSchema,
  EBookSchema,
  PrintBookSchema,
  RareBookSchema,
  InPrintBookSchema,
  OutOfPrintBookSchema,
  SignedFirstEditionSchema,
  SimilarBookSchema,
  SequelSchema
] as const;

// ---------------------------------------------------------------------------
// ABox-derived instance values
// ---------------------------------------------------------------------------

// `reviewValid` plays the flat-object happy path — every required Review
// field present and valid.
export const reviewValid = aboxFixtures.review;

// `reviewInvalid` corrupts every field of the review fixture so error
// collection benchmarks exercise their full error-accumulation path.
export const reviewInvalid = {
  'body': 42,
  'bookIsbn': 'not-an-isbn',
  'customerId': 'not-a-uuid',
  'postedAt': 'not-a-date',
  'rating': 'not-a-number',
  'reviewId': 99
};

// `reviewCoercible` ships scalars as strings with one extra field —
// exercises type coercion (rating → integer) and strip-unknown on the
// coerce pipeline.
export const reviewCoercible = {
  'body': aboxFixtures.review.body,
  'bookIsbn': aboxFixtures.review.bookIsbn,
  'customerId': aboxFixtures.review.customerId,
  'extra': 'should be removed',
  'postedAt': aboxFixtures.review.postedAt,
  'rating': '5',
  'reviewId': aboxFixtures.review.reviewId
};

// `orderValid` is the canonical Bastian order — the deepest $ref graph
// the bookstore exposes.
export const orderValid = aboxFixtures.order;

// `customerValid` is Bastian's customer record — the medium-depth scenario.
export const customerValid = aboxFixtures.customer;

// Customer record with `addresses` omitted so the coerce bench can trigger
// the `default: []` projection registered on CustomerSchema.
export const customerDefaultsInput = {
  'customerId': aboxFixtures.customer.customerId,
  'email': aboxFixtures.customer.email,
  'name': aboxFixtures.customer.name
};

// ---------------------------------------------------------------------------
// Comparator schemas — Review wire shape
//
//   { reviewId: uuid, bookIsbn: ^\\d{13}$, customerId: uuid,
//     rating: integer 1..5, body: string minLength 10,
//     postedAt: ISO 8601 date-time }
// ---------------------------------------------------------------------------

const ISBN_PATTERN = /^\d{13}$/u;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const COUNTRY_PATTERN = /^[A-Z]{2}$/u;

export const ReviewSchemaTypebox = Type.Object({
  'body': Type.String({ 'minLength': 10 }),
  'bookIsbn': Type.String({ 'pattern': '^\\d{13}$' }),
  'customerId': Type.String({ 'format': 'uuid' }),
  'postedAt': Type.String({ 'format': 'date-time' }),
  'rating': Type.Integer({
    'maximum': 5,
    'minimum': 1
  }),
  'reviewId': Type.String({ 'format': 'uuid' })
});

export const ReviewSchemaZod = z.object({
  'body': z.string().min(10),
  'bookIsbn': z.string().regex(ISBN_PATTERN),
  'customerId': z.string().uuid(),
  'postedAt': z.string().datetime(),
  'rating': z.number().int()
    .min(1)
    .max(5),
  'reviewId': z.string().uuid()
});

export const ReviewSchemaValibot = vObject({
  'body': vPipe(vString(), vMinLength(10)),
  'bookIsbn': vPipe(vString(), vRegex(ISBN_PATTERN)),
  'customerId': vPipe(vString(), vUuid()),
  'postedAt': vPipe(vString(), vIsoTimestamp()),
  'rating': vPipe(vNumber(), vInteger(), vMinValue(1), vMaxValue(5)),
  'reviewId': vPipe(vString(), vUuid())
});

const ioTsIntegerCodec = iotRefinement(iotNumber, (value) => {
  return Number.isInteger(value);
}, 'Integer');

const ioTsUuidCodec = iotRefinement(iotString, (value) => {
  return UUID_PATTERN.test(value);
}, 'Uuid');

const ioTsIsbnCodec = iotRefinement(iotString, (value) => {
  return ISBN_PATTERN.test(value);
}, 'Isbn');

const ioTsIsoDateTimeCodec = iotRefinement(iotString, (value) => {
  return !Number.isNaN(Date.parse(value));
}, 'IsoDateTime');

const ioTsRatingCodec = iotRefinement(ioTsIntegerCodec, (value) => {
  return value >= 1 && value <= 5;
}, 'Rating');

const ioTsReviewBodyCodec = iotRefinement(iotString, (value) => {
  return value.length >= 10;
}, 'ReviewBody');

export const ReviewSchemaIoTs = iotType({
  'body': ioTsReviewBodyCodec,
  'bookIsbn': ioTsIsbnCodec,
  'customerId': ioTsUuidCodec,
  'postedAt': ioTsIsoDateTimeCodec,
  'rating': ioTsRatingCodec,
  'reviewId': ioTsUuidCodec
});

// AJV inline-form schema — no shared registry with json-tology.
const ReviewSchemaAjv = {
  '$id': 'urn:bench:ReviewAjv',
  'properties': {
    'body': {
      'minLength': 10,
      'type': 'string'
    },
    'bookIsbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'customerId': {
      'format': 'uuid',
      'type': 'string'
    },
    'postedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'rating': {
      'maximum': 5,
      'minimum': 1,
      'type': 'integer'
    },
    'reviewId': {
      'format': 'uuid',
      'type': 'string'
    }
  },
  'required': [
    'reviewId',
    'bookIsbn',
    'customerId',
    'rating',
    'body',
    'postedAt'
  ],
  'type': 'object'
} as const;

export const ajvValidateReview: ValidateFunction = ajvInstance.compile(ReviewSchemaAjv);

// ---------------------------------------------------------------------------
// Comparator schemas — Order wire shape
//
//   { orderId: uuid, customerId: uuid, placedAt: ISO,
//     orderLines: OrderLine[] minItems 1, orderTotal: Money, shippingAddress: Address }
//
// OrderLine: { bookIsbn: ^\\d{13}$, quantity: int32 ≥ 1, unitPrice: Money }
// Money:     { amount: number ≥ 0, currency: enum(USD|EUR|GBP|JPY|CAD|AUD) }
// Address:   { street, city, country: ^[A-Z]{2}$, postalCode: 3..12 chars }
// ---------------------------------------------------------------------------

const CURRENCY_LITERALS = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD'
] as const;

const MoneyTb = Type.Object({
  'amount': Type.Number({ 'minimum': 0 }),
  'currency': Type.Union(CURRENCY_LITERALS.map((code) => {
    return Type.Literal(code);
  }))
});

const AddressTb = Type.Object({
  'city': Type.String({
    'maxLength': 100,
    'minLength': 1
  }),
  'country': Type.String({ 'pattern': '^[A-Z]{2}$' }),
  'postalCode': Type.String({
    'maxLength': 12,
    'minLength': 3
  }),
  'street': Type.String({
    'maxLength': 200,
    'minLength': 1
  })
});

const OrderLineTb = Type.Object({
  'bookIsbn': Type.String({ 'pattern': '^\\d{13}$' }),
  'quantity': Type.Integer({ 'minimum': 1 }),
  'unitPrice': MoneyTb
});

export const OrderSchemaTypebox = Type.Object({
  'customerId': Type.String({ 'format': 'uuid' }),
  'orderId': Type.String({ 'format': 'uuid' }),
  'orderLines': Type.Array(OrderLineTb, { 'minItems': 1 }),
  'orderTotal': MoneyTb,
  'placedAt': Type.String({ 'format': 'date-time' }),
  'shippingAddress': AddressTb
});

const MoneyZod = z.object({
  'amount': z.number().min(0),
  'currency': z.enum(CURRENCY_LITERALS)
});

const AddressZod = z.object({
  'city': z.string().min(1)
    .max(100),
  'country': z.string().regex(COUNTRY_PATTERN),
  'postalCode': z.string().min(3)
    .max(12),
  'street': z.string().min(1)
    .max(200)
});

const OrderLineZod = z.object({
  'bookIsbn': z.string().regex(ISBN_PATTERN),
  'quantity': z.number().int()
    .min(1),
  'unitPrice': MoneyZod
});

export const OrderSchemaZod = z.object({
  'customerId': z.string().uuid(),
  'orderId': z.string().uuid(),
  'orderLines': z.array(OrderLineZod).min(1),
  'orderTotal': MoneyZod,
  'placedAt': z.string().datetime(),
  'shippingAddress': AddressZod
});

const MoneyVb = vObject({
  'amount': vPipe(vNumber(), vMinValue(0)),
  'currency': vPicklist(CURRENCY_LITERALS)
});

const AddressVb = vObject({
  'city': vPipe(vString(), vMinLength(1), vMaxLength(100)),
  'country': vPipe(vString(), vRegex(COUNTRY_PATTERN)),
  'postalCode': vPipe(vString(), vMinLength(3), vMaxLength(12)),
  'street': vPipe(vString(), vMinLength(1), vMaxLength(200))
});

const OrderLineVb = vObject({
  'bookIsbn': vPipe(vString(), vRegex(ISBN_PATTERN)),
  'quantity': vPipe(vNumber(), vInteger(), vMinValue(1)),
  'unitPrice': MoneyVb
});

export const OrderSchemaValibot = vObject({
  'customerId': vPipe(vString(), vUuid()),
  'orderId': vPipe(vString(), vUuid()),
  'orderLines': vPipe(vArray(OrderLineVb), vMinLength(1)),
  'orderTotal': MoneyVb,
  'placedAt': vPipe(vString(), vIsoTimestamp()),
  'shippingAddress': AddressVb
});

const ioTsCountryCodec = iotRefinement(iotString, (value) => {
  return COUNTRY_PATTERN.test(value);
}, 'CountryCode');

const ioTsPostalCodeCodec = iotRefinement(iotString, (value) => {
  return value.length >= 3 && value.length <= 12;
}, 'PostalCode');

const ioTsStreetLineCodec = iotRefinement(iotString, (value) => {
  return value.length > 0 && value.length <= 200;
}, 'StreetLine');

const ioTsCityNameCodec = iotRefinement(iotString, (value) => {
  return value.length > 0 && value.length <= 100;
}, 'CityName');

const ioTsAmountCodec = iotRefinement(iotNumber, (value) => {
  return value >= 0;
}, 'Amount');

const ioTsCurrencyCodec = iotUnion([
  iotLiteral('USD'),
  iotLiteral('EUR'),
  iotLiteral('GBP'),
  iotLiteral('JPY'),
  iotLiteral('CAD'),
  iotLiteral('AUD')
]);

const ioTsQuantityCodec = iotRefinement(ioTsIntegerCodec, (value) => {
  return value >= 1;
}, 'Quantity');

const ioTsMoneyCodec = iotType({
  'amount': ioTsAmountCodec,
  'currency': ioTsCurrencyCodec
});

const ioTsAddressCodec = iotType({
  'city': ioTsCityNameCodec,
  'country': ioTsCountryCodec,
  'postalCode': ioTsPostalCodeCodec,
  'street': ioTsStreetLineCodec
});

const ioTsOrderLineCodec = iotType({
  'bookIsbn': ioTsIsbnCodec,
  'quantity': ioTsQuantityCodec,
  'unitPrice': ioTsMoneyCodec
});

const ioTsItemsCodec = iotRefinement(iotArray(ioTsOrderLineCodec), (value) => {
  return value.length > 0;
}, 'NonEmptyItems');

export const OrderSchemaIoTs = iotType({
  'customerId': ioTsUuidCodec,
  'orderId': ioTsUuidCodec,
  'orderLines': ioTsItemsCodec,
  'orderTotal': ioTsMoneyCodec,
  'placedAt': ioTsIsoDateTimeCodec,
  'shippingAddress': ioTsAddressCodec
});

// AJV inline-form schema for the Order wire shape.
const OrderSchemaAjv = {
  '$id': 'urn:bench:OrderAjv',
  'definitions': {
    'address': {
      'properties': {
        'city': {
          'maxLength': 100,
          'minLength': 1,
          'type': 'string'
        },
        'country': {
          'pattern': '^[A-Z]{2}$',
          'type': 'string'
        },
        'postalCode': {
          'maxLength': 12,
          'minLength': 3,
          'type': 'string'
        },
        'street': {
          'maxLength': 200,
          'minLength': 1,
          'type': 'string'
        }
      },
      'required': [
        'street',
        'city',
        'postalCode'
      ],
      'type': 'object'
    },
    'money': {
      'properties': {
        'amount': {
          'minimum': 0,
          'type': 'number'
        },
        'currency': {
          'enum': [
            'USD',
            'EUR',
            'GBP',
            'JPY',
            'CAD',
            'AUD'
          ],
          'type': 'string'
        }
      },
      'required': [
        'amount',
        'currency'
      ],
      'type': 'object'
    }
  },
  'properties': {
    'customerId': {
      'format': 'uuid',
      'type': 'string'
    },
    'orderId': {
      'format': 'uuid',
      'type': 'string'
    },
    'orderLines': {
      'items': {
        'properties': {
          'bookIsbn': {
            'pattern': '^\\d{13}$',
            'type': 'string'
          },
          'quantity': {
            'minimum': 1,
            'type': 'integer'
          },
          'unitPrice': { '$ref': '#/definitions/money' }
        },
        'required': [
          'bookIsbn',
          'quantity',
          'unitPrice'
        ],
        'type': 'object'
      },
      'minItems': 1,
      'type': 'array'
    },
    'orderTotal': { '$ref': '#/definitions/money' },
    'placedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'shippingAddress': { '$ref': '#/definitions/address' }
  },
  'required': [
    'orderId',
    'customerId',
    'orderLines',
    'orderTotal',
    'placedAt',
    'shippingAddress'
  ],
  'type': 'object'
} as const;

export const ajvValidateOrder: ValidateFunction = ajvInstance.compile(OrderSchemaAjv);

// ---------------------------------------------------------------------------
// Backward-compat aliases.
//
// The bench suite originally used three synthetic schemas (SimpleSchema,
// NestedSchema, OrderItemSchema) plus their comparator variants. The
// rewritten suite uses the canonical bookstore schemas:
//
//   SimpleSchema     → ReviewSchema    (flat-object, 6 primitive properties)
//   NestedSchema     → OrderSchema     (deeply nested via $ref)
//   OrderItemSchema  → OrderLineSchema (Isbn / Quantity / Money $refs)
//
// These aliases keep every existing .bench.ts file compiling without
// touching its imports. Future bench refactors should reference the
// canonical names directly.
// ---------------------------------------------------------------------------


export const SimpleSchemaTypebox = ReviewSchemaTypebox;
export const SimpleSchemaZod = ReviewSchemaZod;
export const SimpleSchemaValibot = ReviewSchemaValibot;
export const SimpleSchemaIoTs = ReviewSchemaIoTs;
export const ajvValidateSimple = ajvValidateReview;
export const simpleValid = reviewValid;
export const simpleInvalid = reviewInvalid;
export const simpleCoercible = reviewCoercible;


export const NestedSchemaTypebox = OrderSchemaTypebox;
export const NestedSchemaZod = OrderSchemaZod;
export const NestedSchemaValibot = OrderSchemaValibot;
export const NestedSchemaIoTs = OrderSchemaIoTs;
export const ajvValidateNested = ajvValidateOrder;
export const nestedValid = orderValid;


// Re-export canonical bookstore schemas under the names the existing
// bench files import. AddressSchema and CustomerSchema keep their
// canonical names; only OrderLineSchema is aliased above as OrderItemSchema.


// The defaults-bench scenario projects Customer.addresses default `[]`.
// `DefaultsSchema` is the canonical CustomerSchema (it owns the default);
// `defaultsInput` is a partial that exercises default application.

export const defaultsInput = customerDefaultsInput;

export {
  AddressSchema,
  CustomerSchema,
  CustomerSchema as DefaultsSchema,
  OrderSchema as NestedSchema,
  OrderLineSchema as OrderItemSchema,
  ReviewSchema as SimpleSchema
} from '../bookstore/index.js';
