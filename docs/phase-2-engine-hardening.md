# Phase 2: Engine Hardening & Extensibility

## Goal

Harden GraphEngine for edge-case JSON Schema coverage and add the extensibility hooks needed for custom keywords and format plugins.

## Current State

- Draft 2020-12 core is well-covered: `$dynamicRef`, `$dynamicAnchor`, `prefixItems`, `unevaluatedProperties`, `unevaluatedItems`, `contains`, `if/then/else`, `dependentRequired`, `dependentSchemas`, `propertyNames`, `not`, `$vocabulary`.
- Format validation is inline (~20 string formats, 4 number formats).
- No custom keyword extensibility mechanism.
- No discriminator-based validation optimization.
- `$recursiveRef`/`$recursiveAnchor` (draft 2019-09 compatibility) exists but should be verified.

## Tasks

### 2.1 — Format plugin system

Extract `FORMAT_VALIDATORS` and `NUMBER_FORMAT_VALIDATORS` from `GraphEngine.ts` into a pluggable registry:

```typescript
interface FormatRegistry {
  register(name: string, validator: (value: unknown) => boolean): void;
  get(name: string): ((value: unknown) => boolean) | undefined;
  has(name: string): boolean;
}
```

- Built-in formats registered by default.
- User-supplied formats added via `JsonTology` constructor option or `registry.registerFormat()`.
- GraphEngine reads from the registry rather than the hardcoded maps.

### 2.2 — Custom keyword extensibility

Add a keyword extension API that integrates with the graph:

```typescript
interface KeywordDefinition {
  keyword: string;
  type?: string | string[];  // limit to specific types
  validate: (schema: unknown, data: unknown, context: KeywordContext) => boolean | ValidationError[];
}

interface KeywordContext {
  path: string;
  rootData: unknown;
  parentData: unknown;
  parentKey: string | number;
}
```

- Keywords registered on `SchemaRegistry` or `JsonTology`.
- GraphEngine invokes custom keyword validators after built-in validation.
- Custom keywords should be representable in `SchemaGraphSemantics` as extension entries.

### 2.3 — Discriminator optimization

When a schema has `discriminator: { propertyName: '...' }` alongside `oneOf`:

- GraphEngine should check the discriminator property first and only validate against the matching variant.
- Fall back to full `oneOf` evaluation if no variant matches the discriminator value.
- This is an optimization that does not change semantics.

### 2.4 — Edge case hardening

Verify and fix edge cases:

- `$recursiveRef` / `$recursiveAnchor` (2019-09) interop with 2020-12 `$dynamicRef`
- Boolean schemas at composition boundaries (`allOf: [true, false]`)
- `contains` with `minContains: 0` (should always pass)
- `additionalProperties: false` with composition (`allOf` + properties from different schemas)
- `if/then/else` interaction with `unevaluatedProperties`
- Nested `$ref` chains through multiple registry lookups
- `propertyNames` with complex schemas (not just `pattern`)

## Validation

- Existing tests pass.
- Add tests for each edge case listed above.
- Add tests for custom keyword and format registration.
- Consider importing a subset of the JSON Schema Test Suite for regression.

## Files Changed

- `src/schema/GraphEngine.ts` — format registry, custom keywords, discriminator
- `src/schema/SchemaRegistry.ts` — format/keyword registration delegation
- `src/JsonTology.ts` — constructor options for formats/keywords
- `src/interfaces/config.ts` — new option types
- New: `src/schema/FormatRegistry.ts`
- `test/unit/schemaEngine.test.ts` — edge case tests
- New: `test/unit/formatRegistry.test.ts`
- New: `test/unit/customKeywords.test.ts`

## Dependency

Partially depends on Phase 1 (semantics enrichment) for custom keyword graph representation. Format plugin system can proceed independently.
