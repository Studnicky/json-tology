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

**json-tology** is a TypeScript library combining JSON Schema validation with ontology/semantic web support. Schemas serve triple duty: TypeScript type derivation (via `json-schema-to-ts`), runtime validation (via AJV), and ontology generation.

### Module Structure

- **`src/schema/`** — Core validation layer
  - `Validator.ts` — Stateless validation (no registry); methods: `validate()`, `validateTyped<T>()`, `isValid()`, `assert()`
  - `SchemaRegistry.ts` — Central registry backed by AJV; lazy-compiles validators on first use; FNV-1a hashing for duplicate detection (ID conflicts vs structural duplicates)
  - `EntityBuilder.ts` — Constructs typed instances by extracting schema `default` values and merging with user input
  - `SchemaSystem.ts` — Unified API combining registry + builder
  - `SchemaLoader.ts` — Recursively loads `.json` schema files from directories; validates structure, detects duplicates, returns typed error reports

- **`src/ontology/`** — Semantic web support
  - `OntologyBuilder.ts` — Generates JSON-LD and N3 from parameterized configs (baseIRI, prefix map, graph builder callbacks)
  - `CurieExpander.ts` — Expands CURIE (`prefix:localName`) to full IRIs, with intelligent token boundary handling

- **`src/types/`** — Pre-built schema library (`Duration`, `Progress`, `Response`, `Result`, `Timed`, `Timestamped`) exportable as both JSON schemas and TypeScript types

### Key Patterns

**Dual-purpose schemas** — Declare schemas `as const`, derive types with `FromSchema<typeof MySchema>`:
```ts
const UserSchema = { type: 'object', properties: { name: { type: 'string' } } } as const;
type User = FromSchema<typeof UserSchema>;
```

**Registry deduplication** — `SchemaRegistry` hashes schema content (excluding `$id`) to detect when the same schema is registered under multiple IDs, or the same `$id` with different content.

**Nested validation** — `SchemaRegistry.validateAt(schemaId, '/$defs/SubType', data)` validates against a JSON Pointer into a registered schema's `$defs`.

**Logger injection** — Both `SchemaRegistry` and `SchemaLoader` accept a logger interface; default is silent. Use exported `consoleLogger` to enable logging.

### Package Exports

```json
{ ".": "all", "./schema": "schema module", "./ontology": "ontology module", "./types": "base types" }
```

Output goes to `dist/` (ESNext modules, ES2020 target, declaration maps + source maps).
