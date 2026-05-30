/**
 * Custom formats — define and register validators on a JsonTology instance
 *
 * Pass a `formats` map to `JsonTology.create`. Keys are format names;
 * values are predicates. The example demonstrates an ISBN-10 checksum
 * validator and a slug validator, both wired against a fresh
 * `JsonTology` instance that registers the canonical bookstore
 * `BookSchema` alongside two new format-using primitives.
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';
import { BookSchema } from '../bookstore/index.js';

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

const Isbn10Schema = {
  '$id': 'https://bookstore.example/Isbn10',
  'format': 'isbn-10',
  'type': 'string'
} as const;

const ReviewSlugSchema = {
  '$id': 'https://bookstore.example/ReviewSlug',
  'format': 'slug',
  'maxLength': 80,
  'minLength': 3,
  'type': 'string'
} as const;

const formats: Record<string, (value: unknown) => boolean> = {
  'isbn-10': isIsbn10,
  'slug': isSlug
};

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  formats,
  'schemas': [
    BookSchema,
    Isbn10Schema,
    ReviewSlugSchema
  ] as const
});

type Isbn10 = InferType<typeof Isbn10Schema>;
type ReviewSlug = InferType<typeof ReviewSlugSchema>;

// "0140449132" passes the ISBN-10 checksum (Penguin printing of
// "War and Peace" — the same edition the original docs example
// referenced).
const validIsbn = '0140449132';

console.assert(jt.validate(Isbn10Schema.$id, validIsbn).length === 0);
// '0140449131' fails the checksum (last digit should be 2).
console.assert(jt.validate(Isbn10Schema.$id, '0140449131').length > 0);
console.assert(jt.validate(ReviewSlugSchema.$id, 'die-unendliche-geschichte').length === 0);
console.assert(jt.validate(ReviewSlugSchema.$id, 'NotASlug').length > 0);

// Compile-time witness that the inferred types are reachable.
void (validIsbn as unknown as Isbn10);
void ('die-unendliche-geschichte' as unknown as ReviewSlug);
