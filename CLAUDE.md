# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Compile TypeScript to dist/
npm run type-check   # Type check without emit
npm run test         # Run all unit tests
npm run clean        # Remove dist/

# Run a single test file
tsx --test 'test/unit/schemaRegistry.test.ts'
```

## Architecture

**json-tology** is an ontology-native type system with declarative JSON Schema authoring.

The project contract is:

- JSON Schema is the authoring language.
- The canonical runtime representation is a graph.
- Validation and normalization must execute against that graph.
- Ontology export must consume the same graph.
- The graph is lossless execution data intended to support TBox/ABox reasoning and graph exploration.

### Module Direction

- **`src/modules/graph/`** — canonical graph construction, engine execution
  - `SchemaGraph.ts` should evolve toward the canonical semantic graph rather than remaining a validation-only helper
  - `GraphEngine.ts` should consume graph node kinds and relations directly

- **`src/modules/registry/`** — schema registration, loading
- **`src/modules/validation/`** — compiled validation (SchemaCompiler)
- **`src/modules/materialization/`** — materialization and ABox projection
  - `Materializer.ts` should project normalized graph execution into JS values and ABox nodes without a second semantic walker

- **`src/modules/ontology/`** — serialization and graph-facing ontology utilities
  - ontology output must be a serialization of the canonical graph, not a separate semantic derivation path

- **`src/modules/data/`** — shared data utilities (DataTypes, Value, Changeset)
- **`src/errors/`** — all error classes (see Code Organization Patterns)
- **`src/types/`** — reusable schema/type building blocks

### Architectural Rules

- Do not introduce a second semantic model for ontology generation.
- Do not add features that require validation to bypass the canonical graph.
- Domain and range must be explicit graph relations produced during translation from authored schema into the canonical graph.
- `$ref`, `$defs`, anchors, pointers, composition, and conditionals must all be representable in the canonical graph.
- When code and docs disagree, prefer the graph-native architecture described here and in `docs/validation-engine-plan.md`.

### Code Organization Patterns

**Canonical locations — no re-exports**
Every definition lives in exactly one file and is imported from that file directly. Never create re-export shims or barrel files that proxy to the real location. If something moves, update every import.

**Errors live in `src/errors/`**
All error classes and ValidationErrors are defined in `src/errors/`. Every error extends `BaseError`, which carries `code` (machine-readable string), `message`, `retryable` flag, optional `cause` chain, `toJson()`, and `flatten()`. Never throw bare `new Error()` — use the appropriate subclass:
- `SchemaError` — registration, missing $id, structure validation
- `GraphError` — pointer resolution, anchor lookup, ref resolution, dialect issues
- `LoadError` — file loading failures
- `MaterializationError` — materialization/ABox validation failures
- `ParseError` — parse validation failures (carries `ValidationErrors` collection)

**Shared utilities in `src/modules/data/DataTypes.ts`**
Type guards (`isRecord`, `isPlainObject`), `deepEqual`, XSD type maps/resolvers, and `propertyIri` live here. Do not duplicate these — import from DataTypes.

**Serializers are thin wrappers over projection + formatting**
`GraphOntologySerializer` and `GraphShaclSerializer` delegate to `src/modules/rdf/OwlProjection.ts` and `src/modules/rdf/ShaclProjection.ts` respectively. Projections read `graph.allRelations()` and emit vocabulary-specific quads. `src/modules/rdf/JsonLdFormatter.ts` converts quads to JSON-LD nodes. Serializers only add post-processing normalization (e.g. `ensureArray`, `normalizeArrays`).

### Working Assumptions

**Schema authoring remains declarative**
```ts
const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    id: { type: 'string' },
    manager: { $ref: 'https://example.com/User' }
  },
  required: ['id']
} as const;
```

**Type derivation still comes from authored schema**
```ts
type User = FromSchema<typeof UserSchema>;
```

**Execution semantics come from the canonical graph**

Validation, parsing, materialization, and ontology serialization should all read from the same graph-backed representation.

### Package Exports

```json
{ ".": "high-level entry", "./schema": "schema/runtime internals", "./ontology": "ontology utilities", "./types": "reusable type/schema building blocks" }
```

Output goes to `dist/` (ESNext modules, ES2020 target, declaration maps + source maps).
