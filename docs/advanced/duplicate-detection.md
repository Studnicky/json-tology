# Duplicate shape detection

Strict graph mode flags inline anonymous shapes that duplicate a registered named schema. The intent is drift prevention: if `{ type: 'string', format: 'email' }` exists inline in five schemas and you later tighten the format constraint, you must find and update all five occurrences by hand. Extract it to a named `EmailSchema` and there is one place to change.

In default strict-graph mode, the structure guard runs first and throws `SCHEMA_STRUCTURE_INVALID` when an inline constrained shape is encountered — regardless of whether it structurally duplicates a named schema. `SCHEMA_DUPLICATE_SHAPE` is the code raised by `findDuplicates()` when running in permissive mode (`enableStrictGraph: false`) and an inline shape matches a registered named schema exactly.

This page explains what triggers detection, the nominal-subclass behaviour, and the escape hatches available when legitimate structural coincidence is not drift.

## Runnable example

<RunnableExample src="examples/docs/advanced/120-duplicate-detection" />

## What triggers `SCHEMA_DUPLICATE_SHAPE`

Detection fires when an **anonymous inline sub-shape** inside a registered schema has the same structural hash as a registered top-level schema. "Structural hash" strips `$id`, `title`, `description`, `$comment`, and `examples` before hashing — everything else (including `type`, `format`, `pattern`, `minimum`, `properties`, `required`) is included.

Example that triggers the error:

<!-- inline-ts-ok: hypothetical inline-shape scenario described in comments; published-package import, not a standalone runnable program. -->
```ts
import { JsonTology } from 'json-tology';
import { EmailSchema } from './bookstore/entities/Email.js';
import { CustomerSchema } from './bookstore/entities/Customer.js';

// Suppose CustomerSchema has an inline anonymous email shape instead of $ref:
// properties: { email: { type: 'string', format: 'email' } }  ← not a $ref
// and EmailSchema is { $id: 'urn:bookstore:Email', type: 'string', format: 'email' }
// Detection fires because the inline shape hashes identically to EmailSchema.

const entities = JsonTology.create({
  baseIri: 'urn:bookstore:',
  schemas: [EmailSchema, CustomerSchema] as const,
});
// throws SchemaError('SCHEMA_DUPLICATE_SHAPE') if CustomerSchema has inline email shape
```

The correct form uses `$ref`:

<!-- inline-ts-ok: schema fragment (a bare `properties` object), not a standalone runnable program. -->
```ts
// In Customer.ts — reference the named schema, don't inline its shape
properties: {
  email: { $ref: EmailSchema.$id }
}
```

## Nominal-subclass pairs: no longer flagged

A common false-positive concern is a domain with multiple named nominal primitives that erase to the same base type. For example, the bookstore domain has `CustomerId` and `OrderId` — both are `{ type: 'string', format: 'uuid' }`. They are intentionally distinct nominal classes; they are not structural drift.

Since the nominal-aware deduplication change, **two top-level registered schemas with the same structural hash no longer flag each other's inline occurrences**. The algorithm is:

1. For each registered top-level schema, compute a nominal-aware hash (`StructuralHash.of(schema) + ':t'` for transform-bearing schemas, `+ ':p'` for plain schemas).
2. Build a match cache from hashes that appear for exactly **one** top-level schema. Hashes that appear for two or more top-level schemas are omitted — they represent intentional nominal variety, not a unique authoritative source.
3. Walk inline sub-shapes of every registered schema. Report an inline shape only if its hash matches an entry in the match cache (a hash with exactly one authoritative top-level owner).

This means `CustomerId` and `OrderId` (both `{ type: 'string', format: 'uuid' }`) are registered, their hash is contested (two top-level owners), and inline occurrences of `{ type: 'string', format: 'uuid' }` are **not** reported — neither named schema is the uniquely authoritative owner of that shape.

Additionally, transform-bearing schemas are separated from plain schemas by the `:t` / `:p` suffix. A plain `{ type: 'string' }` schema does not collide with a `{ type: 'string' }` schema that carries a registered `Transform` decoder.

## Escape hatches

### 1. `enableStrictGraph: false`, `enableDuplicateDetection: false`, `enableInlineWarnings: false`

These three flags control enforcement strictness across the registry; see [Strict graph mode](/advanced/strict-graph-mode) for the full explanation of each — [`enableStrictGraph`](/advanced/strict-graph-mode#enablestrictgraph) downgrades all violations to warnings, `enableDuplicateDetection: false` disables the automatic duplicate scan, and `enableInlineWarnings: false` suppresses inline-shape warnings.

### 2. `format` as semantic typing — a legitimate structural differentiator

`format` is a standard JSON Schema keyword for semantic type annotation. Using it to distinguish schemas that share the same base type is not a hack — it is the standard JSON Schema approach.

<!-- inline-ts-ok: schema-definition sketch demonstrating format-based hashing; definitions only, not a standalone runnable program. -->
```ts
// Two string schemas with different format values hash differently.
// Neither flags the other's inline occurrences.
const CustomerIdSchema = {
  $id: 'urn:bookstore:CustomerId',
  type: 'string',
  format: 'uuid',
} as const;

const SlugSchema = {
  $id: 'urn:bookstore:Slug',
  type: 'string',
  format: 'slug',   // different format → different structural hash
} as const;
```

Because `format` is included in the structural hash, two `{ type: 'string' }` schemas that differ only in `format` have different hashes and do not contest each other. Register both; neither flags inline occurrences of the other.

This is the right approach when your nominal primitive types have genuinely different semantic types. If two schemas really are structurally and semantically identical, they should be the same schema.

## On-demand audit with `findDuplicates()`

`registry.findDuplicates()` is available at any time regardless of the current mode. Use it in a CI script to audit an existing schema set before enabling strict mode:

<!-- inline-ts-ok: CI-audit script using the published package and `process.exit`; not a standalone runnable example. -->
```ts
import { JsonTology } from 'json-tology';
import * as schemas from './bookstore/index.js';

const entities = JsonTology.create({
  baseIri: 'urn:bookstore:',
  schemas: Object.values(schemas) as const,
  enableStrictGraph: false,
});

const duplicates = entities.registry.findDuplicates();

if (duplicates.length > 0) {
  for (const dup of duplicates) {
    console.error(`${dup.schemaId}#${dup.pointer} duplicates ${dup.equivalentTo}`);
  }
  process.exit(1);
}
```

Run this in CI as a ratchet: fix duplicates one at a time, then enable `enableStrictGraph: true` once the list is clear.

## Migrating to strict mode

See [Strict graph mode - migrating existing schemas](/advanced/strict-graph-mode#migrating-existing-schemas) for the full step-by-step walkthrough.

## Related

- [Strict graph mode](/advanced/strict-graph-mode) — the three mode variants and what "strict" enforces
- [`findDuplicates`](/registry/find-duplicates) — on-demand audit API
- [Graph-native authoring](/advanced/graph-native-authoring) — why named schemas matter for OWL/SHACL output
