# json-tology

An ontology-native type system for TypeScript projects with declarative JSON Schema authoring.

`json-tology` is being built around one canonical graph that drives:

- runtime validation and normalization
- JSON-LD / RDF / N3 ontology export
- TBox reasoning over type structure
- ABox reasoning over instance data
- visual exploration of schema and data relationships

JSON Schema is the authoring surface. The canonical runtime artifact is the graph.

## Objectives

- Use declarative JSON Schema as the input language for types and constraints.
- Translate authored JSON Schema into one canonical graph that is lossless execution data.
- Make validation consume that graph directly instead of re-interpreting JSON Schema ad hoc.
- Emit ontology output from the same graph used by validation.
- Support JSON-LD graphs as the semantic backbone for ontological tooling, reasoning, and exploration.
- Deliver a developer experience that exceeds TypeBox + AJV by unifying type authoring, validation, and semantics in one model.

## Design Contract

The project is now defined by these architectural constraints:

- The canonical internal representation is a graph, not raw JSON Schema objects.
- Validation uses the graph natively.
- Ontology generation consumes the same canonical graph as validation.
- The ontology is not a heuristic documentation layer. It is lossless execution data.
- JSON Schema keywords such as object properties, `$ref`, `$defs`, anchors, composition, and conditional structure must lower into explicit graph entities and relationships.
- Domain and range are first-class graph relations, not a post-processing guess.
- TBox and ABox exports must preserve the identifiers and semantic relationships used at runtime.

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

TypeScript types are still derived from authored schemas with `json-schema-to-ts`.

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

The graph must be serializable to JSON-LD / RDF without losing runtime meaning.

That serialization supports:

- TBox reasoning over schema structure
- ABox reasoning over validated or built instance data
- graph visualization and inspection
- semantic tooling that can navigate types, fields, references, constraints, and derived relationships

## Public Surface

The repository currently exposes:

- `json-tology` for the high-level entry point
- `json-tology/schema` for lower-level schema and validation primitives
- `json-tology/ontology` for ontology serialization utilities

The docs in this repository describe the target architecture and product contract first. When code and docs diverge, the graph-native contract is the intended direction.

## High-Level Objectives

- one graph-native semantic backbone
- declarative JSON Schema authoring
- TypeScript-compatible typing from the same semantics used at runtime
- compile-time, build-time, and runtime use of one canonical graph
- faithful serialization to JSON-LD / RDF, JSON Schema, and TypeScript types
- TBox and ABox support from the same identifiers and relations

## Coverage Goal

The long-term coverage target is the shared semantic surface spanned by TypeBox, `json-schema-to-ts`, TypeScript typing, JSON-LD, SHACL, and AJV.

`json-tology` should model those common cases once in its canonical graph and expose the corresponding authoring, inference, execution, and serialization behavior from that one backbone.

## Non-Goals

- maintaining a separate ontology derivation path
- treating ontology output as best-effort documentation only
- preserving convenience APIs that obscure the canonical graph boundary
- competing with validator libraries on validation alone while ignoring semantics

## Repository Notes

- Build: `npm run build`
- Type check: `npm run type-check`
- Test: `npm run test`
- Benchmarks: `npm run bench`

## License

MIT
