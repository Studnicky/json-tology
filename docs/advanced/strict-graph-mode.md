# Strict graph mode

json-tology enforces strict inline-shape detection at the registry boundary by default. `enableStrictGraph`, `enableInlineWarnings`, and `enableDuplicateDetection` are all **on by default**. Registering an inline constrained shape or a structural duplicate raises `SchemaError` at registration time. Pass `enableStrictGraph: false` to `JsonTology.create` or `new SchemaRegistry` to opt out.

Three modes operate on the canonical graph and all rely on the same structural-equality test that drives [`findDuplicates`](/registry/find-duplicates):

- **Strict throw**: any inline constrained shape or structural duplicate is a `SchemaError` at registration time (default).
- **Warn-on-register**: emits `logger.warn` instead of throwing; active alongside strict mode and also as the standalone mode when strict is off.
- **On-demand audit**: `registry.findDuplicates()` is available at any time regardless of mode.

---

## `enableInlineWarnings` - registration warnings

Emits `logger.warn` at registration when inline-object or inline-primitive shapes are found. When `enableStrictGraph` is `true` (the default), both warnings and throws are active. When strict mode is off, warnings are the only signal. Requires a logger to be set.

<<< ../../examples/docs/advanced/78-strict-inline-warnings.ts

Pass `enableInlineWarnings: false` explicitly to suppress warnings when strict mode is also off.

---

## `enableDuplicateDetection` - auto-run at registration

Runs `findDuplicates()` after each schema is registered and emits `logger.warn` if duplicates are found. Active by default alongside strict mode.

<<< ../../examples/docs/advanced/79-strict-duplicate-detection.ts

Pass `enableDuplicateDetection: false` to disable automatic duplicate scanning at registration time.

---

## `enableStrictGraph` - CI enforcement (default) {#enablestrictgraph}

Promotes duplicate and inline-constraint detection to `SchemaError` throws. Every sub-schema must be either:

1. A `{ $ref: registeredSchemaId }` reference
2. A bare base type with no constraint keywords: `{ type: 'string' }`, `{ type: 'integer' }`, `{ type: 'boolean' }`, `{ type: 'array', items: <allowed> }`
3. Declared in the schema's own `$defs` namespace (the schema's internal ontology)

Inline constrained shapes - objects with `properties`, primitives with `pattern`/`format`/`minimum`/etc., array items with constraints - are all registration errors.

<<< ../../examples/docs/advanced/06-strict-graph-mode.ts

**What's allowed inline in strict mode:**

- `{ type: 'string' }` - no constraints
- `{ type: 'integer' }` - no constraints
- `{ type: 'boolean' }` - no constraints
- `{ type: 'array', items: { $ref: '...' } }` - array of named schemas
- `{ type: 'array', items: { type: 'string' } }` - array of base types
- `$defs` entries - the schema's own internal named types

Pass `enableStrictGraph: false` to restore permissive behaviour and downgrade errors to warnings.

---

## Opting out

To disable strict enforcement entirely:

<<< ../../examples/docs/advanced/81-strict-opt-out.ts

With `enableStrictGraph: false`, inline shapes and duplicates emit `logger.warn` rather than throwing, unless the individual warning flags are also set to `false`.

## Migrating existing schemas

If you have an existing codebase with inline shapes that cannot be refactored at once, start with strict mode off:

1. Run [`registry.findDuplicates()`](/registry/find-duplicates) on your existing schema set.
2. For each duplicate, extract the shape to a named schema file.
3. Replace inline occurrences with `{ $ref: newSchema.$id }`.
4. Confirm all warnings are clear.
5. Remove the `enableStrictGraph: false` override to restore the default enforcement.

## CI script example

<<< ../../examples/docs/advanced/80-strict-ci-findduplicates.ts

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
