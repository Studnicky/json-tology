# Custom format validators

JSON Schema `format` keywords are pluggable. json-tology ships built-in validators for the standard formats (`date`, `email`, `uri`, `uuid`, `int32`, and so on) and lets you register your own through the `formats` constructor option.

A format validator is a function `(value: unknown) => boolean`. It receives the raw value (string, number, anything) and returns `true` when the value matches the format. The registry composes custom validators with the built-ins, so you can extend without redefining the standard set.

The bookstore domain in the [Bookstore Domain](/bookstore-domain) is the running example. The book schema declares an ISBN with a regex; below we replace that with a real ISBN-10 format validator and add a `slug` format for review URLs.

---

## Defining custom formats

Pass a `formats` map to `JsonTology.create`. Keys are format names; values are predicates.

```ts
import { JsonTology } from 'json-tology';
import type { InferType } from 'json-tology';

function isIsbn10(value: unknown): boolean {
  if (typeof value !== 'string' || value.length !== 10) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = value.charCodeAt(i) - 0x30;
    if (digit < 0 || digit > 9) {
      return false;
    }
    sum += digit * (10 - i);
  }

  const last = value[9];
  const check = last === 'X' ? 10 : last!.charCodeAt(0) - 0x30;
  if (check < 0 || check > 10) {
    return false;
  }
  sum += check;

  return sum % 11 === 0;
}

function isSlug(value: unknown): boolean {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value);
}

const IsbnSchema = {
  $id: 'https://bookstore.example/Isbn',
  type: 'string',
  format: 'isbn-10',
} as const;

const ReviewSlugSchema = {
  $id: 'https://bookstore.example/ReviewSlug',
  type: 'string',
  format: 'slug',
  minLength: 3,
  maxLength: 80,
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  formats: {
    'isbn-10': isIsbn10,
    'slug':    isSlug,
  },
  schemas: [IsbnSchema, ReviewSlugSchema] as const,
});

type Isbn = InferType<typeof IsbnSchema>;
type ReviewSlug = InferType<typeof ReviewSlugSchema>;
```

`isIsbn10` and `isSlug` accept `unknown` because `FormatRegistry` calls them with the raw value. Always check the type before doing format-specific work - the same validator can be reached for non-string fields if a schema misuses the format.

## Composing with bookstore schemas

The standard `BookSchema` declares ISBN with a 13-digit pattern. Swap the pattern for the new format on a refined schema and reuse the rest of the bookstore registration:

```ts
import { JsonTology } from 'json-tology';
import {
  AddressSchema, CustomerSchema, OrderLineSchema, OrderSchema, ReviewSchema,
} from './bookstore/index.js';

const StrictBookSchema = {
  $id: 'https://bookstore.example/StrictBook',
  type: 'object',
  properties: {
    isbn:    { type: 'string', format: 'isbn-10' }, // ← was a 13-digit regex
    title:   { type: 'string' },
    authors: { type: 'array', items: { type: 'string' }, minItems: 1 },
    price:   { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['isbn', 'title', 'authors', 'price'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  formats: {
    'isbn-10': isIsbn10,
    'slug':    isSlug,
  },
  schemas: [
    AddressSchema,
    CustomerSchema,
    OrderLineSchema,
    OrderSchema,
    ReviewSchema,
    StrictBookSchema,
  ] as const,
});

// Valid - "0140449132" passes the ISBN-10 checksum
jt.validate(StrictBookSchema.$id, {
  isbn:    '0140449132',
  title:   'War and Peace',
  authors: ['Leo Tolstoy'],
  price:   18.99,
});
```

## Replacing a built-in format

Built-ins live under the same names (`date`, `email`, `uuid`, ...). Registering a custom validator under one of those names replaces the built-in for this `JsonTology` instance only. Other instances retain the built-ins.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  formats: {
    // Replace the built-in 'email' with a stricter rule.
    'email': (value) => {
      return typeof value === 'string'
        && /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/iu.test(value);
    },
  },
});
```

## Number formats

The `formats` map handles number formats too. The validator simply receives the number.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  formats: {
    'positive-int': (value) => {
      return typeof value === 'number' && Number.isInteger(value) && value > 0;
    },
  },
});
```

## Related

- [Schemas overview](/schemas) - where the `format` keyword fits in the broader keyword catalogue
- [JT keyword reference](/schemas/jt-keywords) - json-tology specific keywords
- [`validate`](/validation/validate) - the entry point that runs format checks

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
