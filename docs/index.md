---
layout: doc
title: json-tology
---

<HomeFeaturesHero />

## JSON Schema is the source, not an output

Most TypeScript validation libraries treat JSON Schema as a side-effect. You write Zod or TypeBox or Valibot, and `toJSONSchema(...)` is a one-way export. The exported schema is a snapshot, not a contract: regenerate it on every refactor, hope your back-end picks up the change, hope no one edits the JSON copy by hand.

json-tology inverts this. The JSON Schema literal **is** the schema. Type inference is derived from it. Validation reads it. Coercion reads it. The OWL TBox reads it. The same `as const` object you authored in TypeScript is also a wire-format-compatible JSON Schema document, ready to ship to any consumer in any language.

<RunnableExample src="examples/docs/landing/01-schema-as-source" />

That literal is:

- A TypeScript type via `InferType<typeof CustomerSchema>`
- A runtime validator via `entities.validate(CustomerSchema, data)`
- An OpenAPI 3.1 component (paste it into `components.schemas.Customer`)
- A JSON Schema draft 2020-12 document (Ajv, FastValidator, fastify-json-schema, any conforming validator reads it directly)
- An OWL class (via `entities.toTbox()`)
- A SHACL shape (via `entities.toShacl()`)
- A documentation source for tools like `@apidevtools/json-schema-ref-parser`, `redoc`, `swagger-ui`

All examples in this documentation target the JSON Schema draft 2020-12 dialect.

### Cross-language interop, no codegen

Sharing a contract with a Python back-end, a Go service, a Rust validator, or a Java reasoner is `JSON.stringify(CustomerSchema)`. There is no generator step. There is no regeneration on every refactor. The TS type and the wire schema can't drift because they are the same object.

The same property holds for LLM consumers: every major model provider has converged on JSON Schema for structured outputs and tool calling, so a json-tology schema literal drops directly into an OpenAI or Anthropic function definition - see Sourcemeta's [AI only speaks JSON Schema](https://www.sourcemeta.com/blog/ai-only-speaks-json-schema/) for the full argument. The same `as const` object that types your TypeScript also defines the model's output contract.

| Library | TS type | Runtime validator | Wire-format JSON Schema | OWL/SHACL output |
|---|---|---|---|---|
| Zod | source | yes | export-only via `zod-to-json-schema` (lossy) | no |
| TypeBox | source (via `Static<>`) | yes (Value.Check) | yes (TypeBox schemas ARE JSON Schema) | no |
| Valibot | source | yes | export-only via `@valibot/to-json-schema` | no |
| Pydantic | source | yes | export-only via `model_json_schema()` | no |
| Ajv | no TS inference | yes | source (raw JSON Schema author) | no |
| **json-tology** | **derived from source** | **yes** | **source** | **yes (TBox + SHACL)** |

TypeBox is the closest comparator: TypeBox schemas are also JSON-Schema-compatible objects. The differences: TypeBox doesn't ship runtime registration, cross-schema `$ref` resolution, ABox projection, OWL/SHACL output, or graph-native authoring tools.

## Advanced usages

### Your types are already a graph

Every TypeScript type system has a graph hiding in it. Below is the bookstore domain - six entities, eighteen primitives, every property a typed edge. Nodes are classes; edges are properties; arrowheads point from the domain entity to the range type.

<BookstoreGraph />

[Read the full guide](/your-types-are-a-graph)

---

## Why json-tology

If you're coming from Pydantic, Zod, or TypeBox, json-tology gives you the same authoring ergonomics with **JSON Schema as the source of truth** - your schema works in TypeScript, in JSON Schema validators, in OpenAPI, in IDE auto-complete, and as a wire-format contract, all from one declaration.

<RunnableExample src="examples/docs/landing/02-core-workflow" />

That's the entire core. Validation, type inference, coercion, defaults - all from one schema literal.

## What's in the box

| You get | Without paying for |
|---------|--------------------|
| Type inference (`InferType`) | A separate type-definition language |
| Runtime validation (`validate`, `is`) | A second schema for runtime checks |
| Coercion + defaults (`instantiate`) | Manual mapping of input shapes |
| Field aliasing (`jt:alias`) | Custom transform layers for renames |
| Computed fields (`jt:computed`) | Post-processing pipelines |
| Cross-field invariants (`addInvariant`) | Custom validation glue |
| Serialization (`dump`, `dumpJson`) | A separate serializer |
| Composition (`extend`, `pick`, `omit`, `partial`, `required`) | Hand-written derived schemas |

> **W3C / RDF / OWL / SHACL conformance is aspirational and a work in progress.** Output loads into reasoners like Apache Jena and editors like Protege, but full normative conformance is still being built out. See the [References](/references#standards-conformance) page.

If you also need RDF/OWL/SHACL output, that's available as **opt-in advanced features** under the [Ontology and Graphs](/advanced/ontology) section. The core type-system path doesn't pay for any of it - `json-tology/value`, `json-tology/schema`, and `json-tology/types` exclude the graph and ontology modules entirely.

## Quick links

- **[Getting Started](/getting-started)** - install, define a schema, validate, instantiate
- **[Bookstore Domain](/bookstore-domain)** - the running example domain used throughout the docs
- **[Validation](/validation/instantiate)** - `instantiate`, `validate`, `is`, `subschemaAt`
- **[Error Views](/errors/views)** - `aggregate`, `report` (RFC 7807)
- **[Type Inference](/types/infer)** - how `InferType` works, reference maps, branded types
- **[Composition](/composition/extend)** - derive schemas from other schemas
- **[Serialization](/serialization/dump)** - `dump`, `dumpJson`, Transform encoders
- **[Ontology and Graphs](/advanced/ontology)** - *advanced:* OWL TBox, SHACL shapes, JSON-LD, ABox projection

## Related

- [Getting Started](/getting-started) - install, validate, instantiate in 5 minutes
- [Bookstore domain](/bookstore-domain) - the running example domain used throughout
- [Picking a method](/picking-a-method) - instantiate vs validate vs is vs materialize

## See also

- [Argument conventions](/argument-conventions) - universal SchemaRef, static counterparts
- [Composition](/composition/extend) - derive schemas with extend, pick, omit
- [Ontology and Graphs](/advanced/ontology) - advanced: OWL TBox, SHACL shapes, JSON-LD
