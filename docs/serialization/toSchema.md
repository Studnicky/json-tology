# `jt.toSchema`

**Declaration.** Reconstructs a JSON Schema document from the canonical graph for a registered schema. Returns `Record<string, unknown> | undefined` - `undefined` when the schema is not registered. The reconstructed schema reflects the normalized canonical representation, which may differ slightly from the original authored schema.

**Use this when** you want to verify round-trip fidelity - that the canonical graph preserves all structural semantics from the authored schema. Also useful for producing normalized/canonical versions of schemas for display, debugging, or downstream tooling.

**Don't use this when** you need the original schema object as-authored (use [`jt.get`](/registry/#registry-get) instead). `get` returns the original object reference; `toSchema` returns a new object reconstructed from the internal graph.

## Examples

### Example 1: Round-trip an Order schema

```ts
import { bookstoreEntities } from './bookstore/index.js';

const reconstructed = bookstoreEntities.toSchema('https://bookstore.example/Order');
console.log(JSON.stringify(reconstructed, null, 2));
// Should match the original OrderSchema structure
```

### Example 2: Verify a composed schema round-trips correctly

```ts
import { Compose } from 'json-tology';
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price'] as const,
  'https://bookstore.example/BookSummary',
);
bookstoreEntities.register(BookSummarySchema);

const roundTripped = bookstoreEntities.toSchema('https://bookstore.example/BookSummary');
// Should contain only isbn, title, price properties
const keys = Object.keys((roundTripped?.properties as object) ?? {});
console.log(keys); // ['isbn', 'title', 'price']
```

### Example 3: Undefined for unregistered schemas

```ts
const missing = jt.toSchema('https://bookstore.example/NonExistent');
console.log(missing); // undefined
```

## Bad examples: what NOT to do

### Anti-pattern 1: Using toSchema when you need the original authored object

```ts
import { bookstoreEntities } from './bookstore/index.js';

// ✗ Don't do this — toSchema reconstructs from the graph; the result may
// differ in key order, inlined $defs, or normalized forms
const schema = bookstoreEntities.toSchema('https://bookstore.example/Book');
const originalTitle = schema?.title; // may be present or absent depending on normalization

// ✓ Do this — use bookstoreEntities.registry.get to retrieve the original object reference
const original = bookstoreEntities.registry.get('https://bookstore.example/Book');
// original is the exact object passed to JsonTology.create
```

### Anti-pattern 2: Using the reconstructed schema as a source of truth for structural comparison

```ts
// ✗ Don't do this — comparing reconstructed schema against original via deep-equal
// is fragile; normalization may reorder keys or inline $defs differently
const reconstructed = bookstoreEntities.toSchema('https://bookstore.example/Order');
const original = OrderSchema;
console.log(JSON.stringify(reconstructed) === JSON.stringify(original)); // may be false even when semantically equivalent

// ✓ Do this — use toSchema for debugging and display; use the original schema
// for structural comparisons
```

### Anti-pattern 3: Calling toSchema for an unregistered schema without handling undefined

```ts
// ✗ Don't do this — ignoring the undefined return for schemas not in the registry
const schema = bookstoreEntities.toSchema('https://bookstore.example/Nonexistent');
const props = Object.keys(schema.properties); // TypeError: Cannot read properties of undefined

// ✓ Do this — check for undefined before accessing the result
const schema2 = bookstoreEntities.toSchema('https://bookstore.example/Nonexistent');
if (schema2 === undefined) {
  console.warn('Schema not registered');
} else {
  const props = Object.keys((schema2.properties as object) ?? {});
}
```

## Comparison

::: code-group

```ts [json-tology]
jt.toSchema('https://bookstore.example/Book')
// Reconstructed from internal canonical graph
```

```ts [Zod]
// Not directly supported  - no JSON Schema reconstruction from Zod's runtime representation.
// Use zodToJsonSchema (third-party) to export JSON Schema.
```

```ts [Valibot]
// Use the `@valibot/to-json-schema` companion library:
import { toJsonSchema } from '@valibot/to-json-schema';
const jsonSchema = toJsonSchema(BookSchema);
// Limitation: produces JSON Schema from Valibot's runtime representation;
// no first-class graph reconstruction, and not all Valibot constructs map.
```

```ts [io-ts]
// Limitation: io-ts has no built-in JSON Schema export. Codecs are
// runtime values without a structural representation that maps cleanly
// onto JSON Schema; third-party tooling (io-ts-types, io-ts-codegen) can
// emit specific subsets but full round-trip is not supported.
```

```ts [TypeBox + Value]
// TypeBox schemas ARE plain JSON Schema  - no reconstruction needed.
// JSON.stringify(BookSchema) gives the schema directly.
```

```ts [AJV]
// Not directly supported  - AJV stores compiled validators, not schemas.
// Pass schema directly: JSON.stringify(bookSchema)
```

```py [Pydantic]
Book.model_json_schema()  # Exports JSON Schema from the model class
```

:::

## Related

- [`jt.get`](/registry/#registry-get) - retrieve the original schema object (not reconstructed)
- [Ontology and Graphs](/advanced/ontology) - `toQuads` and `fromQuads` for the advanced graph API

## See also

- [Bookstore domain](/bookstore-domain) - where all schemas are defined
- [Schemas guide](/schemas) - schema registration and management
