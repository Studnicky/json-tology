import {
  Compose, JsonTology
} from '../../../src/index.js';
import {
  AddressSchema, AmountSchema, AuthorNameSchema, CityNameSchema, CountryCodeSchema,
  CurrencyCodeSchema, CustomerIdSchema, CustomerNameSchema, CustomerSchema,
  EmailSchema, IsbnSchema, Iso8601Schema, MoneySchema, OrderIdSchema,
  PostalCodeSchema, QuantitySchema, RatingScoreSchema, ReviewIdSchema,
  StreetLineSchema, TitleSchema
} from '../bookstore/index.js';

const CustomerWithDiscountSchema = Compose.extend(
  CustomerSchema,
  {
    'discountRate': {
      'default': 0,
      'maximum': 1,
      'minimum': 0,
      'type': 'number'
    },
    'tier': {
      'enum': [
        'bronze',
        'silver',
        'gold'
      ],
      'type': 'string'
    }
  } as const,
  'https://bookstore.example/CustomerWithDiscount'
);

const entities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AmountSchema,
    AuthorNameSchema,
    CityNameSchema,
    CountryCodeSchema,
    CurrencyCodeSchema,
    CustomerIdSchema,
    CustomerNameSchema,
    EmailSchema,
    IsbnSchema,
    Iso8601Schema,
    MoneySchema,
    OrderIdSchema,
    PostalCodeSchema,
    QuantitySchema,
    RatingScoreSchema,
    ReviewIdSchema,
    StreetLineSchema,
    TitleSchema,
    AddressSchema,
    CustomerSchema,
    CustomerWithDiscountSchema
  ] as const
});

const coercedCustomer = entities.coerce(CustomerWithDiscountSchema.$id, {
  'discountRate': 0.15,
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen',
  'tier': 'silver'
}) as Record<string, unknown>;

console.assert(coercedCustomer.discountRate === 0.15);
console.assert(coercedCustomer.tier === 'silver');
console.assert(coercedCustomer.name === 'Alice Chen');
