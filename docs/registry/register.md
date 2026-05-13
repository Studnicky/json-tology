# `register`, `registerAnonymous`, registry access

Schema management — registering, inspecting, and introspecting the schema registry.

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
console.log(bookstoreEntities.registry.has('https://bookstore.example/BookSummary')); // true
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

## Reading the registry: `jt.registry` {#registry-access}

`jt.registry` is the single read surface for registered schemas. It exposes the read methods of a native `Map` — `has`, `get`, `keys`, `values`, `entries`, `forEach`, `size`, and `for...of` iteration yielding `[iri, schema]` pairs. No facade aliases on `JsonTology` itself; everything goes through the registry.

### `jt.registry.has(iri)` {#registry-has}

`O(1)` lookup. Returns `true` if a schema with the given `$id` is registered.

```ts
jt.registry.has('https://bookstore.example/Customer');     // true
jt.registry.has('https://bookstore.example/NonExistent');  // false

// Guard pattern:
function validateIfPresent(schemaId: string, data: unknown): ValidationErrors {
  if (!jt.registry.has(schemaId)) {
    return new ValidationErrors([{
      path: '', keyword: 'unknown',
      message: `Schema '${schemaId}' not registered`,
      params: {}
    }]);
  }
  return jt.validate(schemaId, data);
}
```

### `jt.registry.get(iri)` {#registry-get}

Retrieves the original schema object by `$id`. Returns `Record<string, unknown> | undefined`.

```ts
const book = jt.registry.get('https://bookstore.example/Book');
console.log(book?.properties?.['price']); // { exclusiveMinimum: 0, type: 'number' }

if (book) {
  const BookSummary = Compose.pick(
    book as typeof BookSchema,
    ['isbn', 'title', 'price'] as const,
    '...'
  );
}
```

### `jt.registry.keys()` / `values()` / `entries()` {#registry-iteration}

Standard Map iterators. `keys()` yields `$id` strings, `values()` yields schema objects, `entries()` yields `[iri, schema]` pairs.

```ts
const ids = [...jt.registry.keys()];
const bookstoreSchemas = ids.filter(id => id.startsWith('https://bookstore.example/'));

for (const schema of jt.registry.values()) { /* ... */ }
for (const [iri, schema] of jt.registry) { /* ... */ }   // direct for-of works too

jt.registry.forEach((schema, iri) => { /* ... */ });
jt.registry.size;   // number of registered schemas
```

No removal methods are exposed: registration semantics differ from `Map.set`/`delete`. Use `jt.register(schema)` to add schemas.

## Related

- [`JsonTology.materialize`](/registry/materialize) - build instances from schemas
- [`Compose` methods](/composition/extend) - derive new schemas to register
- [`jt.toSchema`](/serialization/toSchema) - reconstruct schema from the canonical graph

## See also

- [Bookstore domain](/bookstore-domain) - where all six schemas are registered
