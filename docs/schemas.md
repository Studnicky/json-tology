# Schemas

Schemas are plain JSON Schema objects with `$id` and `as const`. The registry stores them, compiles a canonical validation graph for each, and exposes lookup methods. json-tology targets **JSON Schema draft 2020-12** (`https://json-schema.org/draft/2020-12/schema`), the dialect on track for Proposed Standard via the [IETF JSON Schema Working Group](https://datatracker.ietf.org/wg/jsonschema/about/).

All examples use the [bookstore domain](/bookstore-domain). See [Getting Started](/getting-started) for installation and the basic `JsonTology.create()` call.

---

## Schema authoring

Schemas are declared as TypeScript `const` objects so the compiler can read the literal types. The minimal shape is:

```ts
const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    id:   { type: 'string' },
    name: { type: 'string' },
  },
  required: ['id', 'name'],
} as const;
```

**`$id` is required.** Every schema registered with `register()` must carry a fully-qualified IRI as its `$id`. The IRI is the stable identity used by `has`, `get`, `validate`, `instantiate`, `materialize`, and cross-schema `$ref`. Use the project's `baseIRI` as the namespace:

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [AddressSchema, CustomerSchema, BookSchema] as const,
});
```

**`as const` is required for type inference.** Without it, TypeScript widens string literals to `string` and `InferType` cannot derive precise property types.

---

## `$ref`: cross-schema references

Use `$ref` to point one schema at another by IRI. The runtime resolves the reference against the registry.

```ts
const OrderLineSchema = {
  $id: 'https://bookstore.example/OrderLine',
  type: 'object',
  properties: {
    book: { $ref: 'https://bookstore.example/Book' },
    qty:  { type: 'integer', minimum: 1 },
  },
  required: ['book', 'qty'],
} as const;
```

**Local fragment refs** (`#`, `#/properties/foo`, `#anchor`) resolve within the same schema document and do not require registry lookup.

**Cross-schema non-fragment refs** must point to a `$id` that is registered (or nested within a registered schema). See the [strict resolution section](#cross-schema-ref-strict-resolution) below for how enforcement works.

---

## `$defs` and anchors

Use `$defs` to define reusable sub-schemas inline within a parent schema. They are accessible via `$ref` with a JSON Pointer fragment (`#/$defs/Name`) or via a named `$anchor`.

```ts
const OrderSchema = {
  $id: 'https://bookstore.example/Order',
  type: 'object',
  $defs: {
    Status: {
      type: 'string',
      enum: ['pending', 'shipped', 'delivered', 'cancelled'],
    },
  },
  properties: {
    id:     { type: 'string' },
    status: { $ref: '#/$defs/Status' },
    lines:  { type: 'array', items: { $ref: 'https://bookstore.example/OrderLine' } },
  },
  required: ['id', 'status', 'lines'],
} as const;
```

`$anchor` assigns a named pointer to any sub-schema node, independent of its structural path:

```ts
const AddressSchema = {
  $id: 'https://bookstore.example/Address',
  type: 'object',
  $defs: {
    PostalCode: {
      $anchor: 'postal-code',
      type: 'string',
      pattern: '^[0-9]{5}(-[0-9]{4})?$',
    },
  },
  properties: {
    postalCode: { $ref: '#postal-code' },
  },
} as const;
```

---

## `$id` conventions

Use fully-qualified IRIs as schema identifiers:

- **Base IRI** - use the same origin for all schemas in a project (`https://bookstore.example`). Pass it as `baseIRI` to `JsonTology.create` so relative `$ref` values resolve correctly.
- **Path segment** - use the domain entity name as the path (`/Book`, `/Customer`, `/OrderLine`). One schema per IRI.
- **Stability** - once a schema `$id` is published and referenced by other schemas, treat it as stable. Changing a `$id` breaks all cross-schema `$ref` that target it.

IRI-based identity is what allows the runtime to perform `$ref` resolution, compile-time type checking, and ontology export without additional configuration.

---

## Cross-schema `$ref` strict resolution <Badge type="warning" text="Compile-time + Runtime" />

Cross-schema `$ref` resolution is enforced at both layers:

- **Compile-time**: `InferType` flags any `$ref` that points to an IRI not present in the type map at the call site. This was introduced in 0.3.x (PR #54).
- **Runtime**: The registry performs a lazy walk on first use of an entry (the first `validate` / `instantiate` / `materialize` / `createDefault` / `convert` / `cast` / `is` / `clean` against it) and throws `GraphError` with code `REF_UNRESOLVED` if any non-fragment `$ref` points to an IRI that is neither in the registry nor embedded as a nested `$id` within the same schema.

Local fragment refs (`#`, `#/foo`, `#anchor`) are unaffected by the strict check.

The walk runs at most once per schema entry - subsequent calls against the same schema use the cached result.

```ts
import { JsonTology, GraphError } from 'json-tology';

const OrderLineSchema = {
  $id: 'https://bookstore.example/OrderLine',
  type: 'object',
  properties: {
    book: { $ref: 'https://bookstore.example/Book' },  // non-fragment $ref
    qty:  { type: 'integer', minimum: 1 },
  },
} as const;

// BookSchema is NOT registered
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [OrderLineSchema] as const,
});

try {
  jt.validate(OrderLineSchema.$id, { book: {}, qty: 1 });
} catch (err) {
  if (err instanceof GraphError && err.code === 'REF_UNRESOLVED') {
    // REF_UNRESOLVED: https://bookstore.example/Book is not registered
  }
}
```

See [Error class hierarchy](/errors/classes) for the full `GraphError` surface.

---

## Registry methods

| Method | Description |
|--------|-------------|
| [`register` / `registerAnonymous`](/registry/register#registry-register) | Add schemas to the runtime |
| [`has`](/registry/register#registry-has) | Check if a schema is registered |
| [`get`](/registry/register#registry-get) | Retrieve the original schema object |
| [`list`](/registry/register#registry-list) | Enumerate all registered `$id` values |
| [`toSchema`](/serialization/toSchema) | Reconstruct a schema from the canonical graph |

---

## See also

- [Bookstore domain](/bookstore-domain) - where all six schemas are registered
- [Composition](/composition/extend) - derive new schemas to register
- [Validation modes](/validation-modes) - enforcement layer reference
- [Argument conventions](/argument-conventions) - how registered schemas work as `SchemaRef`
- [jt: keywords](/schemas/jt-keywords) - json-tology-specific schema extensions
