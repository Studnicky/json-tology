# Validation modes

json-tology enforces schema constraints at two layers: the TypeScript compiler and the runtime validator. Each documented feature carries a badge that identifies which layer (or layers) catches a violation.

## Badge reference

| Badge | Meaning |
|-------|---------|
| <Badge type="info" text="Compile-time" /> | The TypeScript compiler rejects the violation. Data that fails this check never compiles — the bug is caught before the program runs. |
| <Badge type="tip" text="Runtime" /> | The validator catches the violation when untrusted data enters the system — at `instantiate`, `validate`, `is`, `materialize`, or `cast`. |
| <Badge type="warning" text="Compile-time + Runtime" /> | Both layers enforce the constraint. The compiler blocks authoring mistakes; the runtime validator guards the trust boundary for data from external sources. |

## Why both layers?

The two layers cover different failure modes:

- **Compile-time** catches programmer mistakes — passing the wrong type to a function, violating a schema constraint in code you control.
- **Runtime** catches data quality failures — untrusted input from APIs, files, user-submitted forms, or messages that may not respect the schema.

Ideal keyword coverage is **Compile-time + Runtime**: the compiler prevents in-process mistakes, and the runtime validator guards external boundaries.

Some constraints are **Compile-time** only — they express TypeScript-level invariants that have no equivalent runtime check (e.g. `$id` nominal brands: two schemas with the same structure but different `$id` values produce incompatible TypeScript types; at runtime they validate identically).

Some constraints are **Runtime** only — they require value inspection that happens after data arrives (e.g. cross-schema `$ref` resolution, uniqueness of array element values beyond tuple literal narrowing).

## Where badges appear

Badges appear inline next to each documented keyword, brand, or feature in the reference pages. When a feature section covers a constraint, the badge appears at the heading or in the table entry, as shown here:

```
## `format` <Badge type="warning" text="Compile-time + Runtime" />
```

## Cross-referencing

The enforcement layer for every keyword in the standard JSON Schema 2020-12 vocabulary:

| Keyword | Layer |
|---------|-------|
| `type` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `required` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `properties` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `enum` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `const` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `format` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `pattern` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `minLength` / `maxLength` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `minimum` / `maximum` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `exclusiveMinimum` / `exclusiveMaximum` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `multipleOf` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `minItems` / `maxItems` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `uniqueItems` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `allOf` / `anyOf` / `oneOf` / `not` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `if` / `then` / `else` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `dependentRequired` / `dependentSchemas` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `patternProperties` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `additionalProperties: false` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `$ref` (local fragment) | <Badge type="warning" text="Compile-time + Runtime" /> |
| `$ref` (cross-schema) | <Badge type="warning" text="Compile-time + Runtime" /> |
| `$id` nominal brand | <Badge type="info" text="Compile-time" /> |
| `$schema` dialect brand | <Badge type="info" text="Compile-time" /> |
| `disjointWith` | <Badge type="warning" text="Compile-time + Runtime" /> |
| `complementOf` | <Badge type="info" text="Compile-time" /> |
| OWL property restrictions (`jt:restrictions`) | <Badge type="info" text="Compile-time" /> |
| OWL property characteristics | <Badge type="tip" text="Runtime" /> |
| `Compose.pick` / `Compose.omit` key validity | <Badge type="info" text="Compile-time" /> |
| `Compose.discriminatedUnion` discriminator presence | <Badge type="info" text="Compile-time" /> |
| `Compose.subClassOf` self-subclass prevention | <Badge type="info" text="Compile-time" /> |
| `Compose.equivalent` self-equivalence prevention | <Badge type="info" text="Compile-time" /> |
| `Compose.intersection` ID collision prevention | <Badge type="info" text="Compile-time" /> |
| `Transform.pipe` stage chain compatibility | <Badge type="info" text="Compile-time" /> |
| Schema cross-keyword validation (`ValidateSchemaType`) | <Badge type="info" text="Compile-time" /> |

## Related

- [Constraint brands](/constraint-brands) — phantom brands for every constraint keyword
- [Schemas](/schemas) — standard keyword authoring
- [Migration to 0.4.0](/migration-0.4.0) — breaking changes in this release
