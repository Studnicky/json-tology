# 0004 — Downstream friction points from a strict-graph-mode consumer

**Status:** open
**Driver:** A heavy json-tology consumer (Torreya, see `https://github.com/Studnicky/torreya`) ran into six load-bearing workarounds while building out a typed primitive library and an OWL-class taxonomy per adapter. This document catalogues each workaround, names the underlying API contract gap, and proposes the smallest viable fix.

## Context

Torreya uses json-tology as its protocol package's type system. Every adapter (Discord/Slack/Twitch/Telegram/Teams/CLI) produces canonical Messages whose `class` IRI carries adapter-specific concrete subclasses (`Compose.subClassOf(MessageSchema, ...)`). Strings of distinct semantic kind are modelled as separate primitives via `Compose.subClassOf(StringValueSchema, ...)`. Wire decoders run at the adapter trust boundary and feed the result into the bus.

The result is a faithful "json-tology is the type system" architecture — schemas declared once, types derived, OWL TBox emitted for free. But six things forced workarounds:

| # | Workaround | Sites in Torreya HEAD |
|---|---|---|
| 1 | Cross-file `$ref` resolves to `unknown` in `InferSchemaType` | 15 downstream typecheck errors blocking `tsc --build` emit |
| 2 | Per-primitive `format: 'tor-<kind>'` to defeat structural-hash collision | 17 primitives |
| 3 | CURIE `$id` breaks the registry (storage/lookup mismatch) | ~200 `$id` declarations stuck on full IRIs |
| 4 | `materialize` doesn't run Transforms — wire decoders must use `instantiate` | 25+ wire decoders + casts |
| 5 | `SubClassOfSchemaInterface` not in the main barrel | 7 entity files import from `json-tology/interfaces` subpath |
| 6 | `Transform.getDecoder` signature too narrow for branded schemas | 1 `as unknown as Record<string, unknown>` cast |

#1 is load-bearing — every downstream consumer (`packages/core`, `packages/runtime`, `packages/server`) typechecks against `unknown` for any field that `$ref`s a primitive, cascading into `TS2345: Argument of type 'unknown' is not assignable to type 'string'` at every call site.

#3 and #4 are heavy by volume.

#2/#5/#6 are small but worth bundling.

---

## 1. Cross-file `$ref` → `unknown` in `InferSchemaType`

### What's happening

`InferSchemaType<TSchema, TRoot, TReferences>`'s `$ref` resolution branch (in `dist/types/Infer.d.ts`):

```ts
T extends { readonly '$ref': infer TRef extends string }
  ? TRef extends keyof TReferences
    ? InferSchemaType<TReferences[TRef], …>
    : HasReferencesType<TReferences> extends true
      ? RefNotFoundInterface<TRef>
      : unknown
  : unknown;
```

The default `TReferences` is `Record<never, never>`, so unless every consumer manually threads a `TReferences` argument, a `$ref` to anything outside `TRoot` resolves to `unknown`.

The typed `JsonTology<TMap>` instance (created via `JsonTology.create<const TSchemas>`) DOES have a complete TMap built from `SchemaMapFromTupleType<TSchemas>`. It's exactly the references map `InferSchemaType` needs. But it lives on the instance type — a standalone `InferSchemaType<typeof BattleParticipantSchema>` in a foreign entity file has no path to discover it.

The workaround in Torreya HEAD is to manually export a `ProtocolMap` type alias from `schemas/index.ts` and index into it from each entity file (`Battle.BattleParticipantType = ProtocolMap[typeof BattleParticipantSchema['$id']]`). This works but is unergonomic, breaks the natural "just write `InferSchemaType<typeof X>`" idiom, and requires every entity file to thread a type-only import of `ProtocolMap` to break the schemas-index ↔ entity dependency cycle.

### Proposed fix — module-augmentation registry

Expose a single empty interface that consumers augment via TypeScript declaration merging, and change `InferSchemaType`'s `TReferences` default to that interface:

```ts
// In json-tology types
export interface GlobalSchemaRegistry {}

export type InferSchemaType<TSchema, TRoot = TSchema, TReferences = GlobalSchemaRegistry> = …;
```

Consumers augment once at the package boundary:

```ts
// In @torreya/protocol/schemas/index.ts
declare module 'json-tology' {
  export interface GlobalSchemaRegistry extends SchemaMapFromTupleType<typeof PROTOCOL_SCHEMAS> {}
}
```

Every `InferSchemaType<typeof X>` in every entity file now resolves `$ref`s against the augmented map without explicit threading. This is the pattern @trpc, @tanstack/router, and styled-components use for typed contexts that need to span module boundaries.

### Why module augmentation over the alternatives

**Alternative A — instance-bound type method**:
```ts
class JsonTology<TMap> {
  type<TSchema>(schema: TSchema): InferSchemaType<TSchema, TSchema, TMap>;
}
// usage:
type T = ReturnType<typeof protocol.type<typeof BattleParticipantSchema>>;
```
Workable but every type declaration flows through the instance, which is awkward for entity files that don't yet have access to the registry singleton (chicken-and-egg with `schemas/index.ts`).

**Alternative B — `JsonTology.entities([...])` static returning a typed namespace**:
```ts
const E = JsonTology.entities([Foo, Bar]);
type Foo = E.Foo;  // namespace import
```
Same chicken-and-egg, plus weird namespace-as-typespace syntax.

Module augmentation has none of these problems and the consumer pattern is already familiar.

### Compatibility

Pure additive: `GlobalSchemaRegistry` defaults to `{}`, which is structurally equivalent to today's `Record<never, never>` default for `TReferences`. Existing code keeps working.

### What ships when this lands

- `ProtocolMap` type alias in `schemas/index.ts` → removed (replaced by `declare module`).
- 6 entity files' `import type { ProtocolMap }` plumbing → removed.
- 15+ downstream `unknown` errors → cleared.
- `tsc --build` emits for every package; dist staleness gate on boot-smoke verification dissolves.

---

## 2. Per-primitive `format: 'tor-<kind>'` markers

### What's happening

`SchemaRegistry.registerSingle` runs `findDuplicates()` whose `StructuralHash.of` strips `$id`/`title`/`description`/`$comment`/`examples` before hashing. Result: every `{type:'string', default:''}` primitive collides with every other one (and with inline `{type:'string'}` properties throughout the schemas). Strict mode then throws `SCHEMA_DUPLICATE_SHAPE`.

The marker `format: 'tor-iri'`, `format: 'tor-slug'`, etc. is the only non-stripped, non-runtime-cost keyword available, so it's forced into every primitive purely to differentiate hashes.

This is defensible — `format` IS the JSON-Schema-standard mechanism for semantic typing of strings — but it's mandatory for what should be a non-issue: two named schemas (`IriString` vs `Slug`) with different `$id`s and different attached `Transform`s should never collide structurally just because they both unwrap to "a string."

### Proposed fix — Transform-identity in structural hash

Include `Transform.getDecoder(schema) !== undefined` in the structural hash:

```ts
// In modules/data/StructuralHash.ts
static of(schema: object): string {
  const stripped = StructuralHash.strip(schema);
  const decoder = Transform.getDecoder(schema);
  const transformId = decoder !== undefined
    ? `::transform::${(schema as { $id?: string }).$id ?? Hash.value(stripped)}`
    : '';
  return Hash.value(stripped) + transformId;
}
```

A `CommandArgs` with `Transform.create(...)` attached can no longer hash-collide with a plain `RawText`, even when they both strip down to `{type:'string'}`. Two structurally-identical schemas that BOTH lack transforms still collide — and that's correct: that IS a real drift signal (someone wrote two semantically-distinct schemas with no differentiation; they should share a primitive).

### Compatibility

Strict-mode behaviour changes only for schemas with `Transform.create` attached. Schemas without transforms still get the existing collision check. The new behaviour is strictly more permissive, so existing code can't break.

### What ships when this lands

- Half the `format: 'tor-<kind>'` lines (those whose primitives carry Transforms) can drop the marker. Format-as-semantic-marker remains optional for OWL TBox output but is no longer load-bearing.
- The "format hack" framing dissolves.

---

## 3. CURIE `$id` doesn't work in the registry

### What's happening

`SchemaRegistry.registerSingle` stores by `schema.$id` literal (no expansion). Every lookup helper routes through `this.resolve(schemaId)` which DOES call `Curie.expand`. Storage in CURIE form + lookup in expanded form → guaranteed miss.

Empirical:

```ts
const F = { $id: 'ex:Foo', type: 'object' } as const;
const jt = JsonTology.create({
  baseIRI: '.',
  schemas: [F],
  prefixes: { ex: 'https://example.com/' },
});
jt.instantiate(F, {});
// SCHEMA_NOT_REGISTERED: Schema not registered: https://example.com/Foo
```

The contradiction is structural — `registerSingle` stores `'ex:Foo'`, `instantiate` resolves to `'https://example.com/Foo'`, store miss.

### Proposed fix — normalize at registration

One line in `SchemaRegistry.registerSingle`:

```ts
registerSingle(schema) {
  const schemaId = this.resolve(schema.$id);  // ← expand CURIE → full IRI
  // … rest unchanged
  this.store.add(schemaId, entry);
}
```

Storage becomes canonical full-IRI form; lookups by either CURIE or full IRI both resolve correctly. Schema authors can write `$id: 'prot:IriString'` and it Just Works.

### Compatibility

Existing schemas with full-IRI `$id`s store under identical keys (resolve of a full IRI returns the IRI). CURIE-form schemas that previously silently broke now work. Pure improvement.

### What ships when this lands

- 200+ full-IRI `$id` declarations in protocol entity files can become CURIEs (`'prot:IriString'`, `'prot:discord#SlashCommandMessage'`, etc.). Source becomes meaningfully shorter and ontology-aligned. The prefix map in `JsonTology.create({ prefixes })` becomes the single source of truth for the project namespace.

---

## 4. `materialize` doesn't run Transforms

### What's happening

Wire decoders produce trusted data (the platform SDK is the boundary, not the wire decoder). `materialize` is the documented API for "you produced this; fill defaults and validate," which is exactly the wire-decoder contract.

But `materialize`'s return type is `MaterializedSchemaType<T>` which uses `InferSchemaType` for property types (wire shape) and does NOT run registered decoders. Only `instantiate` returns `ParseOutputType<T>` (decoded shape) AND runs Transforms.

So for any wire decoder consuming a schema with a Transform-bearing field (Torreya's `CommandArgs`, but in general anything with a `Transform.create` attached to a sub-field), `materialize` returns a structurally-valid but semantically-half-decoded object: `commandArgs` stays a `string` instead of becoming `CommandValue[]`.

Torreya's workaround was to switch every wire decoder from `materialize` to `instantiate`. That works, but `instantiate`'s stricter validation semantics may reject inputs the materialize path would have accepted, and `instantiate`'s "data crosses a trust boundary" contract doesn't match what wire decoders actually do.

### Proposed fix — option flag on materialize

```ts
materialize<TSchema>(
  schema: TSchema,
  partial?: Partial<…>,
  options?: { enablePartial?: boolean; runTransforms?: boolean }
): MaterializedSchemaType<TSchema> | ParseOutputType<TSchema>
```

When `runTransforms: true`, materialize runs registered decoders and returns `ParseOutputType<TSchema>`. Wire decoders use this: trusted-producer semantics (no overzealous validation throws) AND decoded shape (`commandArgs: CommandValue[]`).

### Why an option rather than always-on

The split is deliberate — `materialize` for test fixtures and form scaffolding (cheap, no transform overhead), `instantiate` for trust boundaries (full validation + decode). The option preserves both modes without forcing every materialize caller to pay for transforms.

### Compatibility

Default `runTransforms: false` keeps existing behaviour. Pure additive.

### What ships when this lands

- 25+ wire-decoder `jt.instantiate(Schema, wireData as unknown) as XxxInterface` become `jt.materialize(Schema, wireData, { runTransforms: true })`.
- The `as unknown` cast goes away because the materialize input type accepts the wire shape directly.
- Wire decoders stop being misclassified as trust boundaries.

---

## 5. `SubClassOfSchemaInterface` not in main barrel

### What's happening

`dist/index.d.ts` has:

```ts
export * from './modules/composition/Compose.js';
```

This exports the runtime `Compose` class but not the type-only brand interfaces (`SubClassOfSchemaInterface`, `DiscriminatedUnionSchemaInterface`, etc.) which live in `interfaces/Compose.d.ts`.

Torreya works around with:

```ts
import type { SubClassOfSchemaInterface } from 'json-tology/interfaces';
```

The subpath export works, but the natural `from 'json-tology'` doesn't.

### Proposed fix — one line

Add to `src/index.ts`:

```ts
export type * from './interfaces/index.js';
```

### Compatibility

Pure additive; no existing names change. The subpath `'json-tology/interfaces'` continues to work for any consumer that prefers it.

### What ships when this lands

- 7 `from 'json-tology/interfaces'` imports in Torreya entity files revert to `from 'json-tology'`.

---

## 6. `Transform.getDecoder` signature too narrow

### What's happening

```ts
static getDecoder(schema: Record<string, unknown>): TransformFnsInterface | undefined;
```

Branded `Compose.subClassOf` schemas don't satisfy `Record<string, unknown>` cleanly — the brand interface adds intersection types that break structural assignability. Torreya has one site:

```ts
const decoder = Transform.getDecoder(CommandArgsSchema as unknown as Record<string, unknown>);
```

### Proposed fix — generic signature

```ts
static getDecoder<TSchema extends { readonly $id?: string }>(
  schema: TSchema
): TransformFnsInterface | undefined;
```

Accepts any schema-like object that may carry `$id`. The runtime body is unchanged (still a WeakMap lookup keyed by reference).

### Compatibility

Pure widening. Existing callers that pass `Record<string, unknown>` still work.

### What ships when this lands

- The `as unknown as Record<string, unknown>` cast in `primitives.entity.ts` goes away.

---

## Priority order

Two heaviest fixes (load-bearing):

1. **#1 — Cross-file `$ref` via `GlobalSchemaRegistry` module augmentation.** Unblocks `tsc --build` for the entire Torreya tree. Removes ~15 `unknown`-typecheck errors and the `ProtocolMap` workaround pattern.
2. **#4 — `materialize` runs transforms via option.** Reverses 25+ wire-decoder migrations and clarifies the materialize-vs-instantiate semantics.

Two small but high-value:

3. **#3 — CURIE `$id` normalization at registration.** One-line fix; enables 200+ schema-source-line cleanups across consumer codebases.
4. **#2 — Transform-identity in structural hash.** Removes the format-marker workaround for transform-bearing primitives.

Two micro-fixes (one line each):

5. **#5 — Re-export interfaces from main barrel.**
6. **#6 — Widen `Transform.getDecoder` signature.**

All six are pure-additive or behaviour-strictly-more-permissive — none break existing consumers.

## Reproduction repo state

The Torreya consumer's HEAD that exhibits each workaround is at branch `feature/pokemontology-extraction-phase2`, commits `c9c2f4a` and `e3728f5`. Specific files for each workaround:

- #1: `packages/protocol/src/schemas/index.ts` (`ProtocolMap` export); `packages/protocol/src/entities/battle.entity.ts` and 5 siblings (the `InferSchemaType` derivations that fall back to `unknown`); cascade in `packages/core/src/BattleManager.ts`, `packages/runtime/src/commands/*.ts`, `packages/server/src/trpc/routers/*.ts`.
- #2: `packages/protocol/src/entities/primitives.entity.ts` (17 primitives with `format: 'tor-<kind>'`).
- #3: every `$id: 'https://torreya.dev/protocol/...'` literal across `packages/protocol/src/entities/*.entity.ts`.
- #4: every `config.jt.instantiate(Schema, wireData as unknown)` in `packages/adapter-*/src/wire/*.ts`.
- #5: 7 entity files with `import type { SubClassOfSchemaInterface } from 'json-tology/interfaces'`.
- #6: `packages/protocol/src/entities/primitives.entity.ts`, the `commandArgsTransformFns = Transform.getDecoder(CommandArgsSchema as unknown as Record<string, unknown>)` line.
