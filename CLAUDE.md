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

- **`src/schema/`**
  - owns canonical graph construction from authored schema, registry behavior, validation, parsing, normalization, materialization, pointer entry selection, and execution planning
  - `SchemaGraph.ts` should evolve toward the canonical semantic graph rather than remaining a validation-only helper
  - `GraphEngine.ts` should consume graph node kinds and relations directly
  - `Materializer.ts` should project normalized graph execution into JS values and ABox nodes without a second semantic walker

- **`src/ontology/`**
  - owns serialization and graph-facing ontology utilities
  - ontology output must be a serialization of the canonical graph, not a separate semantic derivation path

- **`src/types/`**
  - contains reusable schema/type building blocks

### Architectural Rules

- Do not introduce a second semantic model for ontology generation.
- Do not add features that require validation to bypass the canonical graph.
- Domain and range must be explicit graph relations produced during translation from authored schema into the canonical graph.
- `$ref`, `$defs`, anchors, pointers, composition, and conditionals must all be representable in the canonical graph.
- When code and docs disagree, prefer the graph-native architecture described here and in `docs/validation-engine-plan.md`.

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
