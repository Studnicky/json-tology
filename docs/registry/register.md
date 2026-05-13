# `register`, `registerAnonymous`, `has`, `get`, `list`

Schema management - registering, inspecting, and introspecting the schema registry.

---

## `JsonTology.register` {#registry-register}

**Declaration.** Registers one or more schemas and returns `this` with the schema types accumulated into the type map. Accepts a single schema object or an array. The `$id` of each schema must be unique. Schemas with `$ref` that reference other schemas must have those other schemas registered first (or registered in the same call). Returns `JsonTology<merged TMap>`.

**Use this when** you need to add schemas after construction, or when schemas are loaded from files at startup. Prefer `JsonTology.create({ schemas })` for known-at-compile-time schemas since it builds the full type map in one pass.

### Examples

#### Example 1: Construction-time registration (preferred)

```ts
import { JsonTology } from 'json-tology';

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    AddressSchema, CustomerSchema, BookSchema,
    OrderLineSchema, OrderSchema, ReviewSchema,
  ] as const,
});
```

#### Example 2: Post-construction registration

```ts
const jt = JsonTology.create({ baseIRI: 'https://bookstore.example' });
jt.register(AddressSchema).register(CustomerSchema);

// Or register an array:
jt.register([AddressSchema, CustomerSchema] as const);
```

#### Example 3: Register a composed schema immediately

```ts
import { Compose } from 'json-tology';
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price'] as const,
  'https://bookstore.example/BookSummary',
);
bookstoreEntities.register(BookSummarySchema);
console.log(bookstoreEntities.has('https://bookstore.example/BookSummary')); // true
```

### Comparison

::: code-group

```ts [json-tology]
jt.register(BookSchema);
// Or: JsonTology.create({ schemas: [...] as const })
```

```ts [Zod]
// Zod schemas are module-scope  - no registry. Import the schema object directly.
```

```ts [Valibot]
// Limitation: Valibot has no registry concept. Each schema is an isolated
// value; cross-schema reference is structural - import the schema and embed it.
import { BookSchema } from './bookstore.js';
```

```ts [io-ts]
// Limitation: io-ts has no registry concept. Codecs are values exported from
// modules; cross-codec reference is structural via t.intersection / t.union /
// t.recursion (for self-referential cases). No central $id-keyed lookup.
import { BookCodec } from './bookstore.js';
```

```ts [TypeBox + Value]
// TypeBox schemas are plain objects  - no registry concept.
```

```ts [AJV]
ajv.addSchema(bookSchema);
// Or: ajv.addSchema([schema1, schema2])
```

```py [Pydantic]
# Pydantic registers via the Python class system automatically.
# No explicit registry call needed.
```

:::

---

## `JsonTology.registerAnonymous` {#registry-registeranonymous}

**Declaration.** Registers a schema that may not have a `$id`. If `$id` is absent, assigns a content-hash-based synthetic ID (`urn:json-tology:hash:<hex>`). If `$id` is present, delegates to `register`. Returns the `$id` string used for registration.

**Use this when** you receive schemas from external sources (OpenAPI `$defs`, dynamic form builders) that may not carry a stable `$id`.

### Examples

```ts
const syntheticId = jt.registerAnonymous({
  type: 'object',
  properties: {
    couponCode: { type: 'string' },
    discount:   { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['couponCode', 'discount'],
});

console.log(syntheticId); // 'urn:json-tology:hash:<hex>'
jt.validate(syntheticId, { couponCode: 'SAVE10', discount: 0.1 });
```

---

## `JsonTology.has` {#registry-has}

**Declaration.** Returns `true` if a schema with the given `$id` is registered. `O(1)` lookup.

**Use this when** you need to guard before calling `instantiate` or `validate` on a schema that might not be registered - for example, when plugin schemas are conditionally loaded.

### Examples

```ts
console.log(jt.has('https://bookstore.example/Customer')); // true
console.log(jt.has('https://bookstore.example/NonExistent')); // false

// Guard pattern:
function validateIfPresent(schemaId: string, data: unknown): ValidationErrors {
  if (!jt.has(schemaId)) return new ValidationErrors([{ path: '', keyword: 'unknown', message: `Schema '${schemaId}' not registered`, params: {} }]);
  return jt.validate(schemaId, data);
}
```

---

## `JsonTology.get` {#registry-get}

**Declaration.** Retrieves the original schema object by `$id`. Returns `Record<string, unknown> | undefined` - `undefined` when not registered.

**Use this when** you need the raw schema object - to feed into `Compose` methods, display in a schema browser, or log for debugging.

### Examples

```ts
const book = jt.get('https://bookstore.example/Book');
console.log(book?.properties?.['price']); // { exclusiveMinimum: 0, type: 'number' }

// Use to derive a new schema dynamically:
if (book) {
  const BookSummary = Compose.pick(book as typeof BookSchema, ['isbn', 'title', 'price'] as const, '...');
}
```

---

## `JsonTology.list` {#registry-list}

**Declaration.** Returns an array of `$id` strings for all registered schemas. Array order is not guaranteed.

**Use this when** building developer tooling - schema browsers, startup logs, API documentation generators.

### Examples

```ts
const ids = jt.list();
// ['https://bookstore.example/Address', 'https://bookstore.example/Customer', ...]

// Find schemas from a specific base IRI:
const bookstoreSchemas = jt.list().filter(id => id.startsWith('https://bookstore.example/'));
```

## Related

- [`JsonTology.materialize`](/registry/materialize) - build instances from schemas
- [`Compose` methods](/composition/extend) - derive new schemas to register
- [`jt.toSchema`](/serialization/toSchema) - reconstruct schema from the canonical graph

## See also

- [Bookstore domain](/bookstore-domain) - where all six schemas are registered
