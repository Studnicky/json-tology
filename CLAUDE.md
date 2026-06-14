# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build            # Compile TypeScript to dist/
npm run type-check       # Type check without emit
npm run test             # Run smoke + unit tests (pre-commit default)
npm run test:smoke       # Existence and sanity checks
npm run test:unit        # Isolated module tests
npm run test:integration # Cross-module tests
npm run test:e2e         # Real-world scenario tests
npm run test:types       # Compile-time type assertion tests
npm run test:all         # All tiers
npm run clean            # Remove dist/

# Run a single test file
npx tsx --test 'test/unit/schemaRegistry.test.ts'
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

- **`src/modules/data/`** — shared data utilities (DataTypes, Value, Changeset, operations)
- **`src/errors/`** — all error classes (see Code Organization Patterns)
- **`src/constants/`** — shared constants (error codes, XSD maps, dialect config, keywords, format validators, prefixes, schema literals)
- **`src/types/`** — type aliases and branded types
- **`src/interfaces/`** — all interfaces (see Code Organization Patterns)

### Architectural Rules

- Do not introduce a second semantic model for ontology generation.
- Do not add features that require validation to bypass the canonical graph.
- Domain and range must be explicit graph relations produced during translation from authored schema into the canonical graph.
- `$ref`, `$defs`, anchors, pointers, composition, and conditionals must all be representable in the canonical graph.
- When code and docs disagree, prefer the graph-native architecture described here and in `docs/architecture.md`.

### Code Organization Patterns

**Canonical locations — single source of truth**
Every definition lives in exactly one file. Package entry points (`src/index.ts`, `src/schema.ts`, etc.) re-export the public API for consumer convenience, but definitions themselves are never duplicated. Internal imports should reference the defining file directly, not a barrel.

**Interfaces over classes**
Core runtime classes with complex contracts have corresponding interfaces in `src/interfaces/` (e.g. `GraphEngine` → `GraphEngineInterface`, `SchemaRegistry` → `SchemaRegistryInterface`, `Materializer` → `MaterializerInterface`, `Value` → `ValueInterface`, `Curie` → `CurieInterface`). For these, consumers depend on the interface, not the class. Use `FooInterface` for the class's annotations (parameters, fields, return types) and the class only for `new Foo()` or static methods. Classes carry `implements FooInterface` clauses. Static-method-only classes (Compose, Transform, Hash) and the top-level facade (JsonTology) do not require separate interfaces.

**Constants live in `src/constants/`**
Error codes, XSD maps, dialect configuration, known keywords, format validators, default prefixes, and schema literals all live here. Import constants from `src/constants/`, not from the module that originally defined them.

**`type` is the data substrate; `interface` is only for behavioral contracts**
`type` and `interface` are semantically distinct and are never interchanged. `type` is the default: every data shape — object literals, unions, intersections, function signatures, options/args/result/context field-bags, primitives — is a `type` alias (`FooType`) in `src/types/`, and the substrate composes from base types via `&` intersection (find the commonality, define a base `*Type`, extend it). `interface` (`FooInterface`, in `src/interfaces/`) is reserved for what a type cannot express: a behavioral/class contract (method-bearing, `class X implements YInterface`) or declaration-merged augmentation. A field that merely holds a function (`fn: (x) => R`) is data, not a method. Two ESLint rules enforce this on every commit: `interface-must-be-contract` (a method-less, non-allowlisted interface is an error) and a location rule (interfaces only in `src/interfaces/`, object-type aliases only in `src/types/`). Do not define types or interfaces inline in module files — extract them to the canonical location.

**Errors live in `src/errors/`**
All error classes and ValidationErrors are defined in `src/errors/`. Import each error directly from its file (e.g. `from '../errors/SchemaError.js'`), not from a barrel. Every error extends `BaseError`, which carries `code` (machine-readable string), `message`, `retryable` flag, optional `cause` chain, `toJson()`, and `flatten()`. Never throw bare `new Error()` — use the appropriate subclass:
- `SchemaError` — registration, missing $id, structure validation
- `GraphError` — pointer resolution, anchor lookup, ref resolution, dialect issues
- `LoadError` — file loading failures
- `MaterializationError` — materialization/ABox validation failures
- `CoercionError` — coercion validation failures (carries `ValidationErrors` collection)

**Shared utilities in `src/modules/data/DataTypes.ts`**
Type guards (`isRecord`, `isPlainObject`), `deepEqual`, and XSD type maps/resolvers live here. Do not duplicate these — import from DataTypes. Graph-identity helpers live on `SchemaIri` (`propertyIri`, `parseRef`, `splitSubject`); deep freezing on `Frozen.deepFreeze`; CURIE expansion/compaction on `Curie`.

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
type User = InferType<typeof UserSchema>;
```

**Execution semantics come from the canonical graph**

Validation, parsing, materialization, and ontology serialization should all read from the same graph-backed representation.

### Package Exports

```json
{ ".": "high-level entry", "./value": "Value, Changeset, Hash", "./schema": "schema/runtime internals", "./ontology": "ontology utilities", "./types": "type aliases and branded types", "./interfaces": "interface contracts", "./viz": "HTML renderer and visualization" }
```

Output goes to `dist/` (NodeNext modules, ES2022 target, declaration maps + source maps).
