# Schemas

Schemas are plain JSON Schema objects with `$id` and `as const`. The registry stores them, compiles a canonical validation graph for each, and exposes lookup methods. json-tology targets **JSON Schema draft 2020-12** (`https://json-schema.org/draft/2020-12/schema`), the dialect on track for Proposed Standard via the [IETF JSON Schema Working Group](https://datatracker.ietf.org/wg/jsonschema/about/).

All examples use the [bookstore domain](/bookstore-domain). See [Getting Started](/getting-started) for installation and the basic `JsonTology.create()` call.

---

## Schema authoring

Schemas are declared as TypeScript `const` objects so the compiler can read the literal types. The minimal shape is:

<RunnableExample src="examples/docs/schemas/07-schema-authoring" />

**`$id` is required.** Every schema registered with `set()` must carry a fully-qualified IRI as its `$id`. The IRI is the stable identity used by `registry.has`, `registry.get`, `validate`, `instantiate`, `materialize`, and cross-schema `$ref`. Use the project's `baseIri` as the namespace:

<RunnableExample src="examples/docs/schemas/08-jsontology-create" />

**`as const` is required for type inference.** Without it, TypeScript widens string literals to `string` and `InferType` cannot derive precise property types.

---

## `$ref`: cross-schema references

Use `$ref` to point one schema at another by IRI. The runtime resolves the reference against the registry.

<RunnableExample src="examples/docs/schemas/09-ref-cross-schema" />

**Local fragment refs** (`#`, `#/properties/foo`, `#anchor`) resolve within the same schema document and do not require registry lookup.

**Cross-schema non-fragment refs** must point to a `$id` that is registered (or nested within a registered schema). See the [strict resolution section](#cross-schema-ref-strict-resolution) below for how enforcement works.

---

## `$defs` and anchors

Use `$defs` to define reusable sub-schemas inline within a parent schema. They are accessible via `$ref` with a JSON Pointer fragment (`#/$defs/Name`) or via a named `$anchor`.

<RunnableExample src="examples/docs/schemas/10-defs-anchor" />

---

## `$id` conventions

Use fully-qualified IRIs as schema identifiers:

- **Base IRI** - use the same origin for all schemas in a project (`https://bookstore.example`). Pass it as `baseIri` to `JsonTology.create` so relative `$ref` values resolve correctly.
- **Path segment** - use the domain entity name as the path (`/Book`, `/Customer`, `/OrderLine`). One schema per IRI.
- **Stability** - once a schema `$id` is published and referenced by other schemas, treat it as stable. Changing a `$id` breaks all cross-schema `$ref` that target it.

IRI-based identity is what allows the runtime to perform `$ref` resolution, compile-time type checking, and ontology export without additional configuration.

---

## Cross-schema `$ref` strict resolution <Badge type="warning" text="Compile-time + Runtime" />

Cross-schema `$ref` resolution is enforced at both layers:

- **Compile-time**: `InferType` flags any `$ref` that points to an IRI not present in the type map at the call site. This was introduced in 0.3.x (PR #54).
- **Runtime**: The registry performs a lazy walk on first use of an entry (the first `validate` / `instantiate` / `materialize` / `create` / `convert` / `cast` / `is` / `clean` against it) and throws `GraphError` with code `REF_UNRESOLVED` if any non-fragment `$ref` points to an IRI that is neither in the registry nor embedded as a nested `$id` within the same schema.

Local fragment refs (`#`, `#/foo`, `#anchor`) are unaffected by the strict check.

The walk runs at most once per schema entry - subsequent calls against the same schema use the cached result.

<RunnableExample src="examples/docs/schemas/11-ref-unresolved-error" />

See [Error class hierarchy](/errors/classes) for the full `GraphError` surface.

---

## Registry methods

| Method | Description |
|--------|-------------|
| [`set` / `registerAnonymous`](/registry/register#registry-set) | Add schemas to the runtime |
| [`registry.has`](/registry/register#registry-has) | Check if a schema is registered |
| [`registry.get`](/registry/register#registry-get) | Retrieve the original schema object |
| [`registry.keys`](/registry/register#registry-iteration) | Enumerate all registered `$id` values |
| [`toSchema`](/serialization/toSchema) | Reconstruct a schema from the canonical graph |

---

## See also

- [Bookstore domain](/bookstore-domain) - where all six schemas are registered
- [Composition](/composition/extend) - derive new schemas to register
- [Validation modes](/validation-modes) - enforcement layer reference
- [Argument conventions](/argument-conventions) - how registered schemas work as `SchemaRef`
- [jt: keywords](/schemas/jt-keywords) - json-tology-specific schema extensions
