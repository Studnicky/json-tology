# Strict graph mode

json-tology offers three escalating levels of inline-shape detection at the registry boundary: silent reporting, warn-on-register, and throw-on-register. All three operate on the canonical graph and rely on the same structural-equality test that drives [`findDuplicates`](/registry/find-duplicates).

The lowest level is the on-demand audit. The middle level emits warnings as schemas are registered. The strict level promotes those warnings to `SchemaError` throws and forbids inline constrained shapes outright.

---

## `enableInlineWarnings: true` - gentle nudges

Emits `logger.warn` at registration when inline-object or inline-primitive shapes are found. No throws. Requires a logger to be set.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  enableInlineWarnings: true,
  logger: myLogger
});
```

Use when you want passive feedback during development without breaking the build.

---

## `enableDuplicateDetection: true` - auto-run at registration

Runs `findDuplicates()` after each schema is registered and emits `logger.warn` if duplicates are found.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  enableDuplicateDetection: true,
  logger: myLogger
});
```

Use when you have already extracted some named schemas and want continuous detection of regressions without a manual audit step.

---

## `enableStrictGraph: true` - CI enforcement {#enablestrictgraph}

Promotes warnings to `SchemaError` throws. Every sub-schema must be either:

1. A `{ $ref: registeredSchemaId }` reference
2. A bare base type with no constraint keywords: `{ type: 'string' }`, `{ type: 'integer' }`, `{ type: 'boolean' }`, `{ type: 'array', items: <allowed> }`
3. Declared in the schema's own `$defs` namespace (the schema's internal ontology)

Inline constrained shapes - objects with `properties`, primitives with `pattern`/`format`/`minimum`/etc., array items with constraints - are all forbidden.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  enableStrictGraph: true,
  schemas: [...] as const  // all inline shapes throw SchemaError here
});
```

**What's allowed inline in strict mode:**

- `{ type: 'string' }` - no constraints
- `{ type: 'integer' }` - no constraints
- `{ type: 'boolean' }` - no constraints
- `{ type: 'array', items: { $ref: '...' } }` - array of named schemas
- `{ type: 'array', items: { type: 'string' } }` - array of base types
- `$defs` entries - the schema's own internal named types

---

## Migration path

1. Run [`registry.findDuplicates()`](/registry/find-duplicates) on your existing schema set.
2. For each duplicate, extract the shape to a named schema file.
3. Replace inline occurrences with `{ $ref: newSchema.$id }`.
4. Enable `enableInlineWarnings: true` first (warn-only) to find stragglers.
5. Once warnings are clean, upgrade to `enableStrictGraph: true`.

## CI script example

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

## When inline is OK {#when-inline-is-ok}

Not every project needs strict graph mode. Inline shapes are fine when:

- The schema has a single consumer and will never be reused.
- It's a throwaway script or one-off data validation utility.
- You're prototyping and the ontology contract isn't relevant yet.

The cost of inline shapes is borne only by graph users: OWL/SHACL output is less precise, `findDuplicates()` reports noise, and global type changes require manual find-and-replace. If you're not using the ontology output, inline shapes have no runtime cost.

## Related

- [`findDuplicates`](/registry/find-duplicates) - on-demand audit
- [Graph-native authoring](/advanced/graph-native-authoring) - the drift problem these modes address
- [Ontology and Graphs](/advanced/ontology) - what graph users get from clean named schemas
