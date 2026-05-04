# json-tology

> One source of truth for TypeScript types, runtime validation, coercion, and OWL ontology output. Author in JSON Schema; share with any backend; reason over the graph.

A TypeScript type system that uses JSON Schema as the source of truth, not as an output.

`json-tology` is built around one canonical graph that drives:

- compile-time TypeScript type inference from `as const` schema literals
- runtime validation, coercion, and materialization
- a wire-format-compatible JSON Schema document for cross-language interop
- JSON-LD OWL TBox and SHACL shape export for ontology tools and reasoners
- TBox reasoning over type structure and ABox projection of instance data
- visual exploration of schema and data relationships

## Why this is different

Most TypeScript validation libraries (Zod, Valibot, ArkType) treat JSON Schema as a one-way export: you author in their DSL, you call `toJSONSchema(...)`, and the exported schema is a snapshot that can drift from your source the moment you refactor. Sharing contracts with non-TypeScript consumers (a Python backend, a Go service, OpenAPI tooling) means regenerating on every change and hoping nothing got out of sync.

json-tology's source format **is** JSON Schema. The same `as const` object you author in TypeScript is, byte for byte, a draft-2020-12 JSON Schema document. Type inference reads it. Validation reads it. The OWL TBox emitter reads it. Sharing it with a back-end is `JSON.stringify(schema)`; there is no generator step and the TS type can't drift from the wire contract because they are the same object.

| Library | TS inference | Runtime validation | Wire JSON Schema | Cross-schema $ref | OWL/SHACL output |
|---|---|---|---|---|---|
| Zod | source DSL | yes | export-only (lossy) | no native registry | no |
| Valibot | source DSL | yes | export-only | no | no |
| TypeBox | source DSL (via `Static<>`) | yes (`Value.Check`) | yes (TypeBox schemas are JSON Schema) | manual via `Type.Ref` | no |
| Pydantic | source DSL (Python) | yes | export-only via `model_json_schema()` | yes (Python-side) | no |
| **json-tology** | **derived from JSON Schema** | **yes** | **source format** | **registry-resolved** | **yes** |

## Objectives

- Declarative JSON Schema serves as the input language for types and constraints.
- Authored JSON Schema translates into one canonical graph that is lossless execution data.
- Validation consumes that graph directly instead of re-interpreting JSON Schema ad hoc.
- Ontology output reads from the same graph used by validation.
- JSON-LD graphs provide the semantic backbone for ontological tooling, reasoning, and exploration.
- A unified model for type authoring, validation, and semantics delivers a developer experience that exceeds TypeBox + AJV.

## Design Contract

The project is defined by these architectural constraints:

- The canonical internal representation is a graph, not raw JSON Schema objects.
- Validation reads the graph natively.
- Ontology generation consumes the same canonical graph as validation.
- The ontology is not a heuristic documentation layer. It is lossless execution data.
- JSON Schema keywords such as object properties, `$ref`, `$defs`, anchors, composition, and conditional structure lower into explicit graph entities and relationships.
- Domain and range are first-class graph relations, not a post-processing guess.
- TBox and ABox exports preserve the identifiers and semantic relationships used at runtime.

## Architecture

### Authoring

Users author schemas declaratively in JSON Schema.

```typescript
const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    manager: { $ref: 'https://example.com/User' },
  },
  required: ['id', 'name'],
} as const;
```

TypeScript types are derived from authored schemas by json-tology's own type inference.

Compile-time inference supports explicit reference maps for external `$ref`
resolution, and conditional schemas use a sound branch-union approximation
instead of silently collapsing to `unknown`.

### Canonical Graph Construction

Authored schemas are translated into one canonical graph containing:

- schema entities
- property entities
- domain and range relations
- `$ref`, `$defs`, anchor, and pointer-addressable relations
- composition and conditional structures
- execution metadata required for validation and normalization

This graph is the runtime source of truth.

### Execution

Validation, normalization, parsing, materialization, and pointer-based entry execution must all run against the same graph.

There is one semantic model and one execution backbone.

### Semantics

The graph must be serializable to JSON-LD without losing runtime meaning.

That serialization supports:

- TBox reasoning over schema structure
- ABox reasoning over validated or built instance data
- graph visualization and inspection
- semantic tooling that can navigate types, fields, references, constraints, and derived relationships

Consumers that need Turtle, N-Quads, or other RDF serializations should translate from the emitted JSON-LD with downstream tooling.

SHACL JSON-LD output uses standard SHACL predicates where possible
(`sh:minCount`/`sh:maxCount` for array cardinality, `dash:readOnly`/`dash:writeOnly`
for access modifiers). Only `jt:multipleOf` requires a custom predicate - SHACL
and XSD have no divisibility constraint.

All RDF projections emit full IRIs (e.g. `http://www.w3.org/ns/shacl#property`)
instead of CURIE shortcuts (`sh:property`). The `Curie` class handles compact URI
expansion and compaction for interoperability with external RDF tools.

## Package Exports

| Import | Contents |
|--------|----------|
| `json-tology` | Everything - JsonTology facade, all classes, types, errors |
| `json-tology/value` | Value, Changeset, Hash |
| `json-tology/schema` | SchemaRegistry, SchemaLoader, FormatRegistry, Compose, Transform |
| `json-tology/ontology` | OntologyBuilder, GraphOntologySerializer, GraphShaclSerializer, GraphSchemaSerializer |
| `json-tology/types` | Type aliases (InferType, DiffOpType, etc.) |
| `json-tology/interfaces` | Interface contracts (LoggerInterface, RegistryOptionsInterface, etc.) |
| `json-tology/viz` | HtmlRenderer, TypeStringEmitter, VizDataCollector, visualization types |

Sub-path imports enable tree-shaking. Use `json-tology/value` to pull only value operations without validation or ontology code.

## Quick Start

```typescript
import { JsonTology, InferType } from 'json-tology';

const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
    role:  { type: 'string', default: 'viewer' },
  },
  required: ['name', 'email'],
} as const;

type User = InferType<typeof UserSchema>;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [UserSchema] as const,
  // Optional: vocabulary plugins for custom RDF vocabularies
  // vocabularies: [myVocabularyPlugin],
});

// Validate
const errors = jt.validate(UserSchema.$id, { name: 'Alice', email: 'alice@co.io' });
// → []

// Coerce (validate + apply defaults, throws on invalid)
const user = jt.coerce(UserSchema.$id, { name: 'Alice', email: 'alice@co.io' });
// → { name: 'Alice', email: 'alice@co.io', role: 'viewer' }

// Materialize (build from partial with defaults)
const blank = jt.materialize(UserSchema, {});
// → { role: 'viewer' }

// OWL ontology (JSON-LD)
console.log(jt.ontology().jsonLd());

// SHACL shapes (JSON-LD)
console.log(jt.ontology().shaclObject());

// ABox  - project validated instance data to RDF
console.log(jt.toQuads(UserSchema, user).jsonLd());

// Dump  - serialize back to wire form (Pydantic model_dump equivalent)
const wire = jt.dump(UserSchema.$id, user, { excludeDefaults: true });
// → { name: 'Alice', email: 'alice@co.io' }

// DumpJson  - wire form as a JSON string
const json = jt.dumpJson(UserSchema.$id, user);
// → '{"name":"Alice","email":"alice@co.io","role":"viewer"}'
```

## Examples

Runnable examples live in `examples/`. Each file is self-contained and prints output to stdout.

```bash
npm run build
node examples/01-validation.mjs
node examples/02-parse-and-materialize.mjs
node examples/03-ontology.mjs
node examples/04-shacl.mjs
node examples/05-abox.mjs
node examples/06-composition.mjs
```

See [`examples/README.md`](./examples/README.md) for descriptions.

## Documentation

| Guide | Covers |
|-------|--------|
| [Getting Started](./docs/getting-started.md) | Install, create instance, first validation |
| [Validation](./docs/validation.md) | validate, errors, is, coerce, validateAt |
| [Value Operations](./docs/value.md) | clone, hash, diff, cast, clean, convert, create |
| [Schema Management](./docs/schemas.md) | register, load, format validators, introspection |
| [Schema Composition](./docs/composition.md) | extend, pick, omit, partial, required, intersection, discriminatedUnion |
| [Transforms](./docs/transforms.md) | decode/encode, brand, pipe |
| [Dump](./docs/dump.md) | dump, dumpJson, exclude/include, excludeUnset, excludeDefaults, mode |
| [Materialization](./docs/materialization.md) | materialize, createDefault, ABox projection |
| [Ontology](./docs/ontology.md) | OWL, SHACL, JSON-LD, custom prefixes, vocabulary plugins, CURIE expansion |
| [Type Inference](./docs/types.md) | InferType, type-safe coerce, reference maps |
| [CLI](./docs/cli.md) | build command, output formats |
| [Invariants](./docs/invariants.md) | cross-field validation, addInvariant, removeInvariant |
| [Computed Fields](./docs/computed.md) | jt:computed, addComputed, removeComputed |

## CLI

```bash
# Build JSON-LD ontology from schema files
json-tology build --schema 'schemas/*.json' --output out/ --format ontology

# Build SHACL shapes
json-tology build --schema 'schemas/*.json' --output out/ --format shacl

# Build graph artifacts (one per schema)
json-tology build --schema 'schemas/*.json' --output out/ --format artifact

# Reconstruct JSON Schema from graph
json-tology build --schema 'schemas/*.json' --output out/ --format schema
```

## Repository Notes

- Build: `npm run build`
- Type check: `npm run type-check`
- Test: `npm run test`
- Pack surface check: `npm run pack:check`
- Benchmarks: `npm run bench`

Performance comparisons are intentionally not hardcoded into the docs. Use the
committed benchmark runner to evaluate the current build on your machine.

## License

MIT
