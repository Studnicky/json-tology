# `SchemaRegistry.findDuplicates`

## Declaration

<!-- inline-ts-ok: pseudocode signature describing the method's return shape; not a runnable expression. -->
```ts
registry.findDuplicates(): ReadonlyArray<{
  schemaId: string;
  pointer: string;
  equivalentTo: string;
  shape: Record<string, unknown>;
}>
```

Returns a report of inline shapes that structurally match a registered top-level schema. Pure - does not mutate the registry. Run on demand at any point after registration.

## Use this when

You want to audit an existing schema set for inline shapes that duplicate a named schema. The output drives an extract-and-`$ref`-replace refactor: each entry tells you exactly which schema, which JSON pointer, and which named schema the inline shape would be equivalent to.

<<< ../../examples/docs/registry/11-find-duplicates-oneshot.ts

## Don't use this when

You want continuous enforcement at registration time - prefer [`enableDuplicateDetection`](/advanced/strict-graph-mode) (warn) or [`enableStrictGraph`](/advanced/strict-graph-mode) (throw) instead. Don't use it as a validator for instance data; it inspects schema structure, not values.

## Examples

### Example 1: One-shot audit

<<< ../../examples/docs/registry/11-find-duplicates-oneshot.ts

### Example 2: CI gate

<<< ../../examples/docs/registry/12-find-duplicates-ci-gate.ts

## Comparison

::: code-group

```ts [json-tology]
const dups = jt.registry.findDuplicates();
// Returns [{ schemaId, pointer, equivalentTo, shape }] — structural, JSON Pointer-addressed.
// Pure — no mutation. Run at any point after registration.
```

```ts [Zod]
// Zod has no built-in duplicate-detection. All schemas are independent runtime
// objects; structural equivalence is not tracked. You would need to implement
// a manual deep-equal check across all schema definitions.
// Limitation: no registry; no JSON Pointer addresses; no concept of inline vs. named.
```

```ts [Valibot]
// Valibot has no duplicate-detection. Schemas are plain objects; no registry
// maintains structural identity. Manual comparison requires traversing the
// schema tree yourself.
// Limitation: no first-class registry; no inline-vs-named concept.
```

```ts [AJV]
// AJV does not track structural equivalence across registered schemas.
// You can inspect ajv.schemas (internal map), but there is no API to detect
// inline shapes that duplicate a named schema.
// Limitation: no findDuplicates equivalent; structural comparison must be
// hand-rolled against the raw schema objects.
```

```ts [TypeBox + Value]
// TypeBox schemas are plain JSON Schema objects. TypeBox has no registry
// and no duplicate-detection API. A CI lint script must compare schema
// definitions manually via deep-equal.
// Limitation: no registry; no pointer-addressed duplicate report.
```

```ts [json-schema-to-typescript]
// json-schema-to-typescript generates TypeScript types but does not detect
// duplicate inline shapes. Structural drift between inline definitions and
// named schemas is invisible until generated types diverge.
// Limitation: no runtime registry; no findDuplicates API.
```


```py [Pydantic]
# Limitation: feature not directly supported in Pydantic. See /comparisons for the matrix.
```

```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [io-ts]
// Limitation: feature not directly supported in io-ts. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

## Related

- [`enableInlineWarnings`](/advanced/strict-graph-mode) - warn-on-register for inline shapes
- [`enableDuplicateDetection`](/advanced/strict-graph-mode) - run findDuplicates after each registration
- [`enableStrictGraph`](/advanced/strict-graph-mode) - throw on inline constrained shapes
- [Graph-native authoring](/advanced/graph-native-authoring) - the underlying drift problem

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
- [Schemas guide](/schemas) - schema registration and management
