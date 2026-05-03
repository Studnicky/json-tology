# `jt.toSchema`

**Declaration.** Reconstructs a JSON Schema document from the canonical graph for a registered schema. Returns `Record<string, unknown> | undefined` — `undefined` when the schema is not registered. The reconstructed schema reflects the normalized canonical representation, which may differ slightly from the original authored schema.

**Use this when** you want to verify round-trip fidelity — that the canonical graph preserves all structural semantics from the authored schema. Also useful for producing normalized/canonical versions of schemas for display, debugging, or downstream tooling.

**Don't use this when** you need the original schema object as-authored (use [`jt.get`](/registry/#registry-get) instead). `get` returns the original object reference; `toSchema` returns a new object reconstructed from the internal graph.

## Examples

### Example 1: Round-trip an Order schema

```ts
import { jt } from './bookstore/schemas.js';

const reconstructed = jt.toSchema('https://bookstore.example/Order');
console.log(JSON.stringify(reconstructed, null, 2));
// Should match the original OrderSchema structure
```

### Example 2: Verify a composed schema round-trips correctly

```ts
import { Compose } from 'json-tology';
import { jt, BookSchema } from './bookstore/schemas.js';

const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price'] as const,
  'https://bookstore.example/BookSummary',
);
jt.register(BookSummarySchema);

const roundTripped = jt.toSchema('https://bookstore.example/BookSummary');
// Should contain only isbn, title, price properties
const keys = Object.keys((roundTripped?.properties as object) ?? {});
console.log(keys); // ['isbn', 'title', 'price']
```

### Example 3: Undefined for unregistered schemas

```ts
const missing = jt.toSchema('https://bookstore.example/NonExistent');
console.log(missing); // undefined
```

## Comparison

::: code-group

```ts [json-tology]
jt.toSchema('https://bookstore.example/Book')
// Reconstructed from internal canonical graph
```

```ts [Zod]
// Not directly supported — no JSON Schema reconstruction from Zod's runtime representation.
// Use zodToJsonSchema (third-party) to export JSON Schema.
```

```ts [TypeBox + Value]
// TypeBox schemas ARE plain JSON Schema — no reconstruction needed.
// JSON.stringify(BookSchema) gives the schema directly.
```

```ts [AJV]
// Not directly supported — AJV stores compiled validators, not schemas.
// Pass schema directly: JSON.stringify(bookSchema)
```

```py [Pydantic]
Book.model_json_schema()  # Exports JSON Schema from the model class
```

:::

## Related

- [`jt.get`](/registry/#registry-get) — retrieve the original schema object (not reconstructed)
- [Ontology and Graphs](/advanced/ontology) — `toQuads` and `fromQuads` for the advanced graph API

## See also

- [Bookstore domain](/bookstore-domain) — where all schemas are defined
- [Schemas guide](/schemas) — schema registration and management
