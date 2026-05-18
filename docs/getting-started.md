# Getting Started

json-tology is an ontology-native type system for TypeScript. Declare schemas once in JSON Schema, get TypeScript types, runtime validation, defaults, transforms, and serialization from one canonical graph.

## Install

```bash
npm install json-tology
```

Requires Node.js `>=24.0.0`.

Supported dialect: JSON Schema draft 2020-12 (`https://json-schema.org/draft/2020-12/schema`).

Upgrading from 0.3.x? See [Migration to 0.4.0](/migration-0.4.0) for the breaking changes.

## Define a schema

Schemas are plain JSON Schema objects with `$id` and `as const`. They are interoperable with the wider JSON Schema ecosystem - for example, [sourcemeta/jsonschema](https://github.com/sourcemeta/jsonschema) will lint, bundle, and format the same files. The bookstore domain used in all examples follows the one-file-per-concept pattern. See the [Bookstore Domain](/bookstore-domain) page for the full folder layout and all schemas.

Primitives are named, reusable schemas with a `urn:` IRI:

<<< ../examples/docs/getting-started/08-primitive-schema.ts

Entities compose primitives via `$ref: SourceSchema.$id` - never bare string literals:

<<< ../examples/docs/getting-started/09-entity-schema.ts

`as const` is required. Without it TypeScript widens every string literal and `InferType<T>` cannot produce the right type.

## Derive the TypeScript type

<<< ../examples/docs/getting-started/10-infer-type.ts

No code generation. No separate type declaration file. The type comes directly from the schema literal at compile time.

## Create an instance and register schemas

<<< ../examples/docs/getting-started/11-create-register.ts

`JsonTology.create()` registers all schemas, compiles the validation graph, and builds the type map. Every method that accepts a schema `$id` returns typed results from that map.

## Validate

`validate()` returns a `ValidationErrors` collection. An empty collection (`errs.ok === true`) means valid.

<<< ../examples/docs/getting-started/01-validate.ts

See [Validation](/validation/instantiate) for `is()`, `validate()`, `subschemaAt()`, and the structured error views.

## Instantiate

`instantiate()` validates, applies defaults, strips unknown properties, and returns a typed value. Throws `InstantiationError` on failure.

<<< ../examples/docs/getting-started/03-address-defaults.ts

## Compose schemas

`Compose` derives new schemas from existing ones. All composition runs at compile time and produces correct JSON Schema objects.

<<< ../examples/docs/getting-started/04-compose-partial-pick.ts

The full set of combinators (`extend`, `omit`, `required`, `intersection`, `discriminatedUnion`) is covered in [Composition](/composition/extend).

## Serialize back to wire form

`dump()` walks the validation graph and applies any registered `Transform` encoders. It is the Pydantic `model_dump()` equivalent.

<<< ../examples/docs/getting-started/05-dump-json.ts

Filtering options (`exclude`, `include`, `excludeDefaults`) are documented in [Serialization](/serialization/dump).

## Sub-path imports

Import only what you need. Every sub-path is tree-shakable.

<<< ../examples/docs/getting-started/07-subpath-imports.ts

## What's in the box

| Feature | Method(s) | Mode |
|---------|-----------|------|
| Type inference | `InferType<T>`, `InferSchemaType<T, Root>` | <Badge type="info" text="Compile-time" /> |
| Validation | `validate`, `is`, `subschemaAt` | <Badge type="tip" text="Runtime" /> |
| Coercion + defaults | `instantiate` | <Badge type="warning" text="Compile-time + Runtime" /> |
| Error views | `aggregate`, `report` | <Badge type="tip" text="Runtime" /> |
| Composition | `Compose.extend`, `pick`, `omit`, `partial`, `required`, `intersection`, `equivalent`, `discriminatedUnion` | <Badge type="warning" text="Compile-time + Runtime" /> |
| Value utilities | `Operations.clone`, `Hash.value`, `Value.diff`, `Operations.patch`, `value.cast`, `clean`, `convert`, `create` | <Badge type="tip" text="Runtime" /> |
| Transforms | `Transform.create`, `brand`, `pipe`, `jt.encode` | <Badge type="warning" text="Compile-time + Runtime" /> |
| Serialization | `dump`, `dumpJson` | <Badge type="tip" text="Runtime" /> |
| Computed fields | `addComputed`, `removeComputed` | <Badge type="tip" text="Runtime" /> |
| Cross-field invariants | `addInvariant`, `removeInvariant` | <Badge type="tip" text="Runtime" /> |
| Materialization | `materialize` | <Badge type="warning" text="Compile-time + Runtime" /> |
| RDF/Ontology _(advanced, opt-in)_ | `ontology`, `toQuads`, `fromQuads`, `toSchema` | <Badge type="tip" text="Runtime" /> |

## Configuring `JsonTology.create`

The full option reference lives at [Static helpers](/static-helpers#jsontology-create-options). Briefly, you supply `baseIRI` (string), `schemas` (array `as const`), and optional dialect / format-registry / strict / coercion controls.

## Next steps

| Topic | Guide |
|-------|-------|
| The running example domain | [Bookstore Domain](/bookstore-domain) |
| TypeScript type inference | [Type Inference](/types/infer) |
| Validation and instantiation | [Validation](/validation/instantiate) |
| Composing schemas | [Composition](/composition/extend) |
| Serialization | [Serialization](/serialization/dump) |
| Static helpers and create options | [Static helpers](/static-helpers) |
