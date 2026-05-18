/**
 * Custom formats — compose with the bookstore registry
 *
 * The canonical `BookSchema` declares ISBN with a 13-digit pattern.
 * A separate `StrictBookSchema` swaps the pattern for the ISBN-10
 * format check declared in `36-custom-formats-define.ts`. Both
 * schemas register against a fresh JsonTology instance that loads
 * the same custom format map.
 */

import { JsonTology } from '../../../src/index.js';
import {
  AddressSchema, CustomerSchema, OrderLineSchema, OrderSchema, ReviewSchema
} from '../bookstore/index.js';

function isIsbn10(value: unknown): boolean {
  if (typeof value !== 'string' || value.length !== 10) {
    return false;
  }
  let sum = 0;

  for (let index = 0; index < 9; index += 1) {
    const codePoint = value.codePointAt(index);

    if (codePoint === undefined) {
      return false;
    }
    const digit = codePoint - 0x30;

    if (digit < 0 || digit > 9) {
      return false;
    }
    sum += digit * (10 - index);
  }
  const last = value[9];
  const lastCode = value.codePointAt(9);

  if (lastCode === undefined) {
    return false;
  }
  const check = last === 'X' ? 10 : lastCode - 0x30;

  if (check < 0 || check > 10) {
    return false;
  }
  sum += check;

  return sum % 11 === 0;
}

function isSlug(value: unknown): boolean {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}

const StrictBookSchema = {
  '$id': 'https://bookstore.example/StrictBook',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    },
    // ← was a 13-digit regex on the canonical BookSchema
    'isbn': {
      'format': 'isbn-10',
      'type': 'string'
    },
    'price': {
      'exclusiveMinimum': 0,
      'type': 'number'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  'formats': {
    'isbn-10': isIsbn10,
    'slug': isSlug
  },
  'schemas': [
    AddressSchema,
    CustomerSchema,
    OrderLineSchema,
    OrderSchema,
    ReviewSchema,
    StrictBookSchema
  ] as const
});

// "0140449132" passes the ISBN-10 checksum.
const errs = jt.validate(StrictBookSchema.$id, {
  'authors': ['Hermann Hesse'],
  'isbn': '0140449132',
  'price': 18.99,
  'title': 'Steppenwolf'
});

console.assert(errs.length === 0);
