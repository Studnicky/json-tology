# `SchemaRegistry.findDuplicates`

## Declaration

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

```ts
const registry = new SchemaRegistry();
registry.register(IsbnSchema);
registry.register(BookSchema); // has inline isbn: { type: 'string', pattern: ... }

const dups = registry.findDuplicates();
// [{ schemaId: 'urn:bookstore:Book', pointer: '/properties/isbn', equivalentTo: 'urn:bookstore:Isbn', shape: {...} }]
```

## Don't use this when

You want continuous enforcement at registration time - prefer [`enableDuplicateDetection`](/advanced/strict-graph-mode) (warn) or [`enableStrictGraph`](/advanced/strict-graph-mode) (throw) instead. Don't use it as a validator for instance data; it inspects schema structure, not values.

## Examples

### Example 1: One-shot audit

```ts
const dups = jt.registry.findDuplicates();
for (const dup of dups) {
  console.log(`${dup.schemaId}#${dup.pointer} duplicates ${dup.equivalentTo}`);
}
```

### Example 2: CI gate

```ts
// scripts/check-graph.ts
import { JsonTology } from 'json-tology';
import { schemas } from '../src/schemas.js';

const jt = JsonTology.create({ baseIRI: 'https://example.com', schemas });
const dups = jt.registry.findDuplicates();

if (dups.length > 0) {
  console.error('Duplicate inline shapes found:');
  for (const dup of dups) {
    console.error(`  ${dup.schemaId}#${dup.pointer} duplicates ${dup.equivalentTo}`);
  }
  process.exit(1);
}
```

## Related

- [`enableInlineWarnings`](/advanced/strict-graph-mode) - warn-on-register for inline shapes
- [`enableDuplicateDetection`](/advanced/strict-graph-mode) - run findDuplicates after each registration
- [`enableStrictGraph`](/advanced/strict-graph-mode) - throw on inline constrained shapes
- [Graph-native authoring](/advanced/graph-native-authoring) - the underlying drift problem
