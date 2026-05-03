# Schemas

> This guide covers `register`, `registerAnonymous`, `has`, `get`, `list`, `toSchema`. All examples use the [bookstore domain](/bookstore-domain). See [Getting Started](/getting-started) for installation and the basic `JsonTology.create()` call.

Schemas are plain JSON Schema objects with `$id` and `as const`. The registry stores them, compiles a canonical validation graph for each, and exposes lookup methods.

---

## register

Registers one or more schemas and returns `this` with the schema types accumulated into the type map.

### Signature

```ts
public register<const T extends { readonly '$id': string }>(schema: T): JsonTology<...>
public register<const T extends ReadonlyArray<{ readonly '$id': string }>>(schemas: T): JsonTology<...>
```

### When to use

Use `register` when you need to add schemas after construction — for example when schemas are loaded from files or built dynamically at startup. Prefer `JsonTology.create({ schemas })` when you know all schemas up front, because it builds the type map in one pass and TypeScript infers the full type map at compile time.

### Examples

#### Example 1: Registration at construction time

The most common pattern. Pass all schemas at once so the type map is fully inferred from the start.

```ts
import { JsonTology } from 'json-tology';

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    AddressSchema,
    CustomerSchema,
    BookSchema,
    OrderLineSchema,
    OrderSchema,
    ReviewSchema,
  ] as const,
});
```

All six schemas are registered. Every `jt.coerce(CustomerSchema.$id, data)` call returns `Customer` (typed).

#### Example 2: Chained post-construction registration

`register()` returns `this` with an updated type parameter, so you can chain or assign the result.

```ts
const jt = JsonTology.create({ baseIRI: 'https://bookstore.example' });

// Chain a single schema
const jt2 = jt.register(AddressSchema).register(CustomerSchema);

// Or register an array at once
const jt3 = jt.register([AddressSchema, CustomerSchema, BookSchema] as const);
```

#### Example 3: Registering a dynamically built schema

Composed schemas (see [Composition](/composition/extend)) are valid schemas that can be registered immediately after creation.

```ts
import { Compose } from 'json-tology';

const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price'] as const,
  'https://bookstore.example/BookSummary',
);

jt.register(BookSummarySchema);
console.log(jt.has('https://bookstore.example/BookSummary')); // true
```

### Comparison

::: code-group

```ts [json-tology]
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CustomerSchema, BookSchema] as const,
});
// Or post-construction:
jt.register(ReviewSchema);
```

```ts [Zod]
// Zod schemas are registered in module scope — no central registry.
// You import the schema object directly wherever needed.
const CustomerSchema = z.object({
  id:    z.string().uuid(),
  email: z.string().email(),
  name:  z.string(),
});
// No equivalent to a multi-schema registry with a type map.
```

```ts [TypeBox]
// TypeBox schemas are plain objects; no registry concept.
// Validation requires passing the schema directly each time.
import Ajv from 'ajv';
const ajv = new Ajv();
ajv.addSchema(CustomerSchema, 'Customer');
// The `ajv` instance is the "registry" — typed only at call sites via generics.
```

```ts [AJV]
import Ajv from 'ajv';
const ajv = new Ajv();
ajv.addSchema(customerJsonSchema);
ajv.addSchema(bookJsonSchema);
// No TypeScript type map — types must be maintained separately.
```

```py [Pydantic]
# Pydantic models are registered by the Python class system.
# No explicit registry — you import the model class directly.
from pydantic import BaseModel

class Customer(BaseModel):
    id: str
    email: str
    name: str
```

:::

### Related

- `registerAnonymous` — for schemas without a `$id`
- `has` / `get` / `list` — registry inspection
- [Composition](/composition/extend) — build schemas from existing ones before registering

---

## registerAnonymous

Registers a schema that may not have a `$id`. If a `$id` is absent, a content-hash-based synthetic ID is assigned.

### Signature

```ts
public registerAnonymous(schema: Record<string, unknown>): string
```

Returns the `$id` used for registration (original or synthetic).

### When to use

Use when you receive schemas from external sources (OpenAPI `$defs`, dynamic form builders, etc.) that may not carry a stable `$id`. The returned synthetic ID can be used in subsequent `coerce` and `validate` calls.

### Examples

#### Example 1: Schema without $id

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

const coupon = jt.coerce(syntheticId, { couponCode: 'SAVE10', discount: 0.1 });
```

#### Example 2: Schema with existing $id delegates to register

If the schema already has a `$id`, `registerAnonymous` behaves identically to `register`.

```ts
const id = jt.registerAnonymous(BookSchema);
console.log(id); // 'https://bookstore.example/Book' — unchanged
```

### Comparison

::: code-group

```ts [json-tology]
const id = jt.registerAnonymous({ type: 'object', properties: { discount: { type: 'number' } } });
jt.validate(id, { discount: 0.15 });
```

```ts [Zod]
// Not directly supported — Zod schemas are typed at declaration site.
// An inline z.object() can be used without a name but has no registry ID.
const CouponSchema = z.object({ discount: z.number() });
CouponSchema.parse({ discount: 0.15 });
```

```ts [TypeBox]
// TypeBox schemas are plain objects; pass directly to Ajv.
import Ajv from 'ajv';
const ajv = new Ajv();
const schema = Type.Object({ discount: Type.Number() });
ajv.validate(schema, { discount: 0.15 });
```

```ts [AJV]
import Ajv from 'ajv';
const ajv = new Ajv();
const schema = { type: 'object', properties: { discount: { type: 'number' } } };
ajv.validate(schema, { discount: 0.15 });
// Inline schemas require no registration.
```

```py [Pydantic]
# Not directly supported — all models must be declared as named classes.
# Dynamic models can be created with `create_model`.
from pydantic import create_model
Coupon = create_model('Coupon', discount=(float, ...))
Coupon(discount=0.15)
```

:::

### Related

- `register` — for schemas with a stable `$id`
- `has` / `get` — verify a schema is present after registration

---

## has

Checks whether a schema with the given `$id` is registered.

### Signature

```ts
public has(schemaId: string): boolean
```

### When to use

Use before calling `coerce` or `validate` when you cannot guarantee a schema is registered (e.g., loading schemas from optional plugin modules). Most application code that calls `JsonTology.create({ schemas })` doesn't need this — all schemas are known registered.

### Examples

#### Example 1: Checking after construction

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CustomerSchema] as const,
});

console.log(jt.has('https://bookstore.example/Customer')); // true
console.log(jt.has('https://bookstore.example/Review'));   // false
```

#### Example 2: Guard before validate

```ts
function validateIfRegistered(schemaId: string, data: unknown): string[] {
  if (!jt.has(schemaId)) {
    return [`Schema '${schemaId}' is not registered`];
  }
  return jt.validate(schemaId, data);
}
```

### Comparison

::: code-group

```ts [json-tology]
jt.has('https://bookstore.example/Customer') // true | false
```

```ts [Zod]
// Not applicable — Zod has no central registry.
// Schema objects are present if the module importing them has loaded.
```

```ts [TypeBox]
// Not applicable — TypeBox schemas are plain JS objects; no registry.
```

```ts [AJV]
const ajv = new Ajv();
ajv.addSchema(customerSchema, 'Customer');
const compiled = ajv.getSchema('Customer');
console.log(compiled !== undefined); // true if schema was added
```

```py [Pydantic]
# Python class introspection:
'Customer' in [cls.__name__ for cls in BaseModel.__subclasses__()]
# Not idiomatic — normally you just import the class.
```

:::

### Related

- `get` — retrieve the schema object itself
- `list` — enumerate all registered IDs

---

## get

Retrieves a registered schema by its `$id`.

### Signature

```ts
public get(schemaId: string): Record<string, unknown> | undefined
```

Returns `undefined` when the schema is not registered.

### When to use

Use when you need to inspect the raw schema document — for example to feed into `Compose` methods, display in developer tooling, or log for debugging. This returns the plain JSON Schema object, not the compiled graph.

### Examples

#### Example 1: Retrieve and inspect

```ts
const book = jt.get('https://bookstore.example/Book');
console.log(book?.properties?.['price']); // { type: 'number', exclusiveMinimum: 0 }
```

#### Example 2: Retrieve to derive a new schema

Build a narrowed schema from one already in the registry. This pattern ties into [Composition](/composition/extend).

```ts
const raw = jt.get('https://bookstore.example/Book');
if (raw) {
  const BookSummary = Compose.pick(
    raw as typeof BookSchema,
    ['isbn', 'title', 'price'] as const,
    'https://bookstore.example/BookSummary',
  );
  jt.register(BookSummary);
}
```

### Comparison

::: code-group

```ts [json-tology]
const schema = jt.get('https://bookstore.example/Book');
```

```ts [Zod]
// Not directly supported — Zod schemas are module-scope variables.
// Access them via direct import.
import { BookSchema } from './schemas';
```

```ts [TypeBox]
// TypeBox schemas are plain objects — access via import or variable reference.
```

```ts [AJV]
const schema = ajv.getSchema('Book');
// Returns the compiled ValidateFunction, not the raw JSON Schema.
```

```py [Pydantic]
Customer.model_json_schema()  # Returns the JSON Schema for a model class
```

:::

### Related

- `has` — existence check
- `toSchema` — round-trip via canonical graph (advanced)

---

## list

Lists the `$id` of every registered schema.

### Signature

```ts
public list(): string[]
```

### When to use

Use for developer tooling — building a schema browser, logging the registry state, or producing an index of available schemas at startup. Not typically needed in application hot paths.

### Examples

#### Example 1: Enumerate registered schemas

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [AddressSchema, CustomerSchema, BookSchema] as const,
});

console.log(jt.list());
// [
//   'https://bookstore.example/Address',
//   'https://bookstore.example/Customer',
//   'https://bookstore.example/Book',
// ]
```

#### Example 2: Validate all schemas share the same base

```ts
const base = 'https://bookstore.example';
const foreign = jt.list().filter(id => !id.startsWith(base));
if (foreign.length > 0) {
  console.warn('Unexpected schemas:', foreign);
}
```

### Comparison

::: code-group

```ts [json-tology]
jt.list() // string[]
```

```ts [Zod]
// Not applicable — no registry.
```

```ts [TypeBox]
// Not applicable — no registry.
```

```ts [AJV]
// Not directly supported — AJV does not expose a list of added schema IDs.
```

```py [Pydantic]
# Not directly supported.
# You can enumerate model subclasses via:
[cls.__name__ for cls in BaseModel.__subclasses__()]
```

:::

### Related

- `has` / `get` — single-schema lookup

---

## toSchema

Reconstructs a JSON Schema document from the canonical graph for a registered schema.

### Signature

```ts
public toSchema(schemaId: string): Record<string, unknown> | undefined
```

Returns `undefined` when the schema is not registered.

### When to use

Use to verify round-trip fidelity — that the canonical graph preserves all structural semantics from the authored schema. Also useful when you want a clean, normalized version of the schema (redundant keywords removed, structure canonicalized). Not needed for typical validation or coercion workflows.

### Examples

#### Example 1: Round-trip a registered schema

```ts
const reconstructed = jt.toSchema('https://bookstore.example/Order');
console.log(JSON.stringify(reconstructed, null, 2));
// Matches the original OrderSchema structure
```

#### Example 2: Verify graph fidelity after composition

```ts
const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price'] as const,
  'https://bookstore.example/BookSummary',
);
jt.register(BookSummarySchema);

const roundTripped = jt.toSchema('https://bookstore.example/BookSummary');
// Should contain only isbn, title, price properties
console.log(Object.keys(roundTripped?.properties ?? {}));
// ['isbn', 'title', 'price']
```

### Comparison

::: code-group

```ts [json-tology]
jt.toSchema('https://bookstore.example/Book')
// Returns the JSON Schema reconstructed from the internal graph
```

```ts [Zod]
// Not directly supported.
// z.schema.description or zodToJsonSchema (third-party) can export JSON Schema.
```

```ts [TypeBox]
// TypeBox schemas ARE plain JSON Schema — no round-trip needed.
// JSON.stringify(schema) gives the wire form directly.
```

```ts [AJV]
// Not directly supported — AJV stores compiled validators, not schemas.
```

```py [Pydantic]
Customer.model_json_schema()  # Exports JSON Schema from the model class
```

:::

### Related

- [Ontology and Graphs](/advanced/ontology) — advanced: `toQuads`, `fromQuads`, graph serialization
- `get` — retrieve the original registered schema (before graph normalization)
