# Static helpers

> Validation modes: [Validation modes reference](/validation-modes)

Every operation that takes a registered schema also has a static counterpart on `JsonTology`. The static form builds a one-shot ephemeral registry containing only the supplied schema, runs the operation, and discards the registry.

> Use static when you do not need to reuse a registry across calls.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used in the example.

## Catalogue

| Static                              | Purpose                                                  | Instance equivalent           |
|-------------------------------------|----------------------------------------------------------|-------------------------------|
| `JsonTology.is(schema, data)`                        | Boolean type guard                                        | `jt.is(id, data)`             |
| `JsonTology.validate(schema, data)`                  | Returns `ValidationErrors`                                | `jt.validate(id, data)`       |
| `JsonTology.instantiate(schema, data, options?)`     | Validates and returns the typed value                     | `jt.instantiate(id, data)`    |
| `JsonTology.materialize(schema, partial?, options?)` | Fills defaults; throws on validation failure              | `jt.materialize(schema, ...)` |
| `JsonTology.subschemaAt(schema, pointer)`            | Resolves a sub-schema by JSON Pointer                     | `jt.subschemaAt(id, pointer)` |
| `JsonTology.dump(schema, value, options?)`           | Serializes to wire form                                   | `jt.dump(id, value)`          |
| `JsonTology.dumpJson(schema, value, options?)`       | Serializes to JSON string                                 | `jt.dumpJson(id, value)`      |
| `JsonTology.toQuads(schema, data)`                   | Projects instance to ABox quads                           | `jt.toQuads(schema, data)`    |
| `JsonTology.fromQuads(schema, quads)`                | Lifts quads back to typed objects                         | `jt.fromQuads(id, quads)`     |
| `JsonTology.toSchema(schema)`                        | Reconstructs JSON Schema from the canonical graph         | `jt.toSchema(id)`             |
| `JsonTology.toTbox(schemas)`                         | Returns OWL TBox builder for the given schemas            | `jt.toTbox()`                 |
| `JsonTology.toShacl(schemas)`                        | Returns SHACL shapes builder for the given schemas        | `jt.toShacl()`                |
| `JsonTology.ontology(schemas)`                       | Returns combined TBox + SHACL builder                     | `jt.ontology()`               |

The single-schema statics accept a schema object (not a string `$id`) because they need the full document to register internally. The multi-schema statics (`toTbox`, `toShacl`, `ontology`) accept a `ReadonlyArray` of schema objects.

## When to pick which

- **Static.** Self-contained schema, one or two operations, no shared state with other schemas.
- **Instance.** Multiple schemas that `$ref` each other, repeated operations on the same schema, registered computed fields or invariants, format plugins, vocabulary plugins, or anything that reuses validation state.

A static call rebuilds the canonical graph for every invocation. An instance reuses the registry's compiled validators, materializer, and graph cache.

## Comparison: instance vs static for `validate`

<RunnableExample src="examples/docs/static-helpers/01-instance-vs-static" />

The two forms return the same `ValidationErrors` collection. Pick the static form for one-off scripts, examples, and self-contained schemas; pick the instance form for everything else.

## JsonTology.create options {#jsontology-create-options}

Options marked <Badge type="info" text="Compile-time" /> affect type inference only; options marked <Badge type="tip" text="Runtime" /> affect the validation or materialization path. See [Validation modes](/validation-modes) for the badge reference.

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `baseIri` | `string` | _(required)_ | Base URI for the canonical graph and ontology output. |
| `schemas` | `readonly Schema[]` | `[]` | Schemas to register at construction. Order matters when using `$ref`: register referenced schemas before referencing schemas. |
| `prefetched` | `SnapshotInterface` | _(none)_ | Pre-resolved schema bundle produced by `JsonTology.prefetch`. Schemas passed via `schemas` register first; entries from the snapshot then fill any IRIs not already in the registry. `schemas` wins on `$id` collision. See [Schema federation](/advanced/schema-federation). |
| `prefixes` | `Record<string, string>` | `STANDARD_PREFIXES` | Vocabulary prefix → IRI mappings, merged with built-in defaults (`rdf`, `rdfs`, `owl`, `sh`, `xsd`, `schema`, `foaf`, `dc`, `dcterms`, `dcat`, `skos`, `prov`, `time`, `geo`, `vann`, `dash`, `jt`). |
| `formats` | `Record<string, FormatValidatorFn>` | `{}` | Custom format validators. Keys are format names (`'isbn'`), values are `(value: unknown) => boolean`. |
| `enableTypeCast` | `boolean` | `false` | Enable string→number/boolean coercion at validation time. |
| `enableStrictTypes` | `boolean` | `false` | Reject implicit coercions globally. Per-field `jt:strict` overrides. Different from `enableStrictGraph`. |
| `enableDefaults` | `boolean` | `true` | Fill schema `default` values during `instantiate`. Set `false` to validate without mutating missing fields. |
| `enableDebug` | `boolean` | `false` | Surface internal debug logging via `logger.debug` (graph construction, validator compilation, materialization steps). Useful when investigating unexpected validation outcomes. |
| `enableInlineWarnings` | `boolean` | `true` | Surface inline-object, inline-primitive, and inline-array-items warnings via `logger.warn` at registration. Forced `true` when `enableStrictGraph` is on; pass `false` explicitly to opt out. See [graph-native authoring](/advanced/graph-native-authoring). |
| `enableDuplicateDetection` | `boolean` | `true` | Run `findDuplicates()` at registration and warn on structural duplicates. Forced `true` when `enableStrictGraph` is on; pass `false` explicitly to opt out. |
| `enableStrictGraph` | `boolean` | `true` | Promote inline warnings and duplicate detection to `SchemaError` throws. Requires all sub-schemas to be standalone `$id` schemas or `$defs` entries. Pass `false` to opt out. See [strict graph mode](/advanced/strict-graph-mode#enablestrictgraph). |
| `keywords` | `KeywordDefinitionInterface[]` | `[]` | Custom keyword handlers for unrecognized JSON Schema vocabulary. |
| `vocabularies` | `VocabularyPluginInterface[]` | `[]` | Vocabulary plugins for custom RDF output (DCAT, FOAF, etc.). |
| `materializer` | `MaterializerOptionsInterface` | _(built-in)_ | Override the default materializer (rare). |
| `maxSchemaDepth` | `number` | _(no limit)_ | Maximum schema-graph traversal depth. Protects against pathological schemas. |
| `logger` | `LoggerInterface` | `SILENT_LOGGER` | Logger for warnings (`enableInlineWarnings`, `enableDuplicateDetection`). Must be set for warnings to surface. |
| `invariants` | `Record<string, InvariantInterface[]>` | `{}` | Cross-field invariant functions, keyed by schema `$id`. |
| `computeds` | `Record<string, Record<string, ComputedFunctionInterface>>` | `{}` | Computed-field functions, keyed by schema `$id` then property name. |

### Type inference options

These options are configured via module augmentation in a `.d.ts` file, not through `JsonTology.create`. They affect `InferType` output only and have zero runtime cost.

| Flag | Default | Purpose |
|------|---------|---------|
| `tightStringLengths` | `false` | <Badge type="info" text="Compile-time" /> Narrow strings with `minLength`/`maxLength` bounds within 8 to fixed-length template literals. Opt in with `declare module 'json-tology/types' { interface JsonTologyTypeConfigInterface { 'tightStringLengths': true } }`. |

See [Constraint brands - tightStringLengths](/constraint-brands/narrowing#tightstringlengths-opt-in-narrowing) for the full reference.

### Graph emission options

These options control how `toQuads` mints subject IRIs and how `fromQuads` reverses them. See [Skolemization](/advanced/skolemization) for the full reference.

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `iriFor` | `string` | _(content-hash)_ | Default root-only IRI override for `toQuads`. The string `'blank-node'` is a runtime-recognised constant that emits anonymous subjects (not a discriminated type member). Per-call options override this. |
| `iriForFunction` | `SkolemizeFunctionInterface` | _(none)_ | Default custom IRI minting strategy for `toQuads`. Takes precedence over `iriFor` when both are set. Per-call options override this. |
| `defaultGraphIri` | `string` | _(none)_ | Default `graph` field for every quad emitted by `toQuads`. Per-call `graphIri` overrides. |
| `defaultDeskolemize` | `boolean` | `false` | Treat `*/.well-known/genid/*` IRIs as blank nodes during `fromQuads`. Reverses `Skolemize.wellKnownGenid`. |

## Related

- [Picking a method](/picking-a-method) - decision guide across the validation surface
- [Argument conventions](/argument-conventions) - schema reference rules shared by both forms
- [`validate`](/validation/validate) and [`instantiate`](/validation/instantiate) - the most common pair
- [`toQuads` / `fromQuads`](/advanced/quads) - RDF round-trip with both static and instance variants

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in the example
