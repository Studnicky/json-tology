# Lazy `TMap` and brand-free `encode`

Two independent type-system changes that remove the last classes of caller-side
casts large-registry consumers are forced into. Each is small and surgical.

The motivating consumer is `@shortslop/signal` (a ~25-schema registry with a
deep root entity `Event`). After both changes its registry module collapses from
"erase the schema tuple to `{$id}[]`, hand-write the type map, re-attach it with
`as`, and keep a separate primitives tuple alive only for `typeof`" to a single
fully-inferred `JsonTology.create({ schemas })`, and its `defineSource` wrapper
becomes cast-free.

---

## Issue 1 — `create()` eagerly materializes `TMap`, tripping TS2589 on declaration emit

### What happens

`create<TSchemas>()` returns
`JsonTology<SchemaMapFromTupleType<TSchemas>, SchemaReferencesMapType<TSchemas>>`
(`src/JsonTology.ts` `create`, ~line 340). The two map types have very different
cost:

- `SchemaReferencesMapType<T> = { [$id]: K }` — the **raw** schema keyed by id.
  A single mapped type over the element union; depth O(1) in registry size.
  Cheap. ✔
- `SchemaMapFromTupleType<T> = { [$id]: ParseOutputType<K, TRefs> }` — the
  **fully resolved, `$ref`-traversed, branded output** type for *every* schema.

The map *shape* of both is O(1) (mapped over `T[number]`, not head/tail
recursion — see the note in `src/types/Registry.ts`). The blow-up is in the
**values** of `SchemaMapFromTupleType`: `ParseOutputType<K, TRefs>` walks the
whole schema graph for each `K`. For a deep root like

```
Event → topics[] → Concept → prefLabel → Label(brand)
      → attribution → Attribution → ingestedAt → Timestamp
      → geo → GeoPoint → Latitude
      → identifiers[] → Identifier → …
```

every leaf is resolved through a 25-entry `TRefs`.

A plain `tsc --noEmit` tolerates this — the deep value types stay lazy. But
**declaration emit** for an exported registry instance (`export const jt =
create(...)`) must fully materialize all 25 branded output types into the
`.d.ts`, and *that* full expansion exceeds TypeScript's instantiation-depth
ceiling (TS2589). The symptom therefore only appears under `tsc -b` / composite
builds / `declaration: true`, not under a bare typecheck — which is exactly what
makes it confusing to diagnose.

### Consumer workaround this forces

```ts
// schemas erased so create() returns JsonTology<{}, {}> (no deep TMap)…
export const signal = JsonTology.create<readonly [{ readonly $id: string }]>({
  schemas: SIGNAL_SCHEMAS as readonly [{ readonly $id: string }], …
}) as JsonTology<SignalTypeMap, SignalRefs>;   // …then re-attached by hand

// SignalTypeMap: 8 entity Interfaces hand-written (each derived in its own
//   small namespace scope so it doesn't blow the ceiling).
// SignalRefs = SchemaReferencesMapType<typeof WIRE_REF_SCHEMAS>, where
//   WIRE_REF_SCHEMAS is a const tuple of the raw primitives kept alive ONLY to
//   be read by `typeof` (its runtime value is unused → an eslint annoyance too).
```

The schema-erasure, the `as JsonTology<…>`, the hand-written `SignalTypeMap`,
and the `WIRE_REF_SCHEMAS` tuple are *all* consequences of the eager `TMap`.

### Fix: make `TMap` lazy — carry only `TRefs`, compute `ParseOutputType` per call

Drop the eager output map from the instance type entirely. The instance only
needs the cheap raw-schema references map; the branded output type is computed
on demand, at each typed method's call site, for the *one* schema in play.

```ts
// today
class JsonTology<TMap, TRefs> {
  instantiate<K extends keyof TMap & string>(id: K, data: unknown): TMap[K];
  materialize<K extends keyof TMap & string>(id: K, …): TMap[K];
  // (string-id overloads of toQuads/validate/is similarly keyed off TMap)
  set<const T extends { $id: string }>(schema: T):
    JsonTology<SchemaEntryType<T> & TMap, SchemaReferencesMapType<[T]> & TRefs>;
}
static create<TSchemas>(…):
  JsonTology<SchemaMapFromTupleType<TSchemas>, SchemaReferencesMapType<TSchemas>>;

// proposed — TMap is gone; everything is keyed off TRefs (raw schemas)
class JsonTology<TRefs> {
  instantiate<K extends keyof TRefs & string>(id: K, data: unknown):
    ParseOutputType<TRefs[K], TRefs>;
  materialize<K extends keyof TRefs & string>(id: K, …):
    ParseOutputType<TRefs[K], TRefs>;
  set<const T extends { $id: string }>(schema: T):
    JsonTology<SchemaReferencesMapType<[T]> & TRefs>;
}
static create<TSchemas>(…): JsonTology<SchemaReferencesMapType<TSchemas>>;
```

Key facts that make this a clean swap:

- **Same result.** `SchemaMapFromTupleType<TSchemas>[K]` is *defined as*
  `ParseOutputType<K_schema, TRefs>`, and `TRefs[K]` is exactly `K_schema`. So
  `ParseOutputType<TRefs[K], TRefs>` is identical — only the *timing* changes
  (computed per call, in the consumer's local compilation, bounded by one
  schema's depth — never all 25 at once in a `.d.ts`).
- **Same keys.** `SchemaReferencesMapType` and `SchemaMapFromTupleType` are keyed
  by the same `$id` union, so `keyof TRefs` preserves the id autocomplete and
  unknown-id rejection `keyof TMap` gave.
- **`create()`'s return type** — and therefore the exported instance's `.d.ts` —
  now materializes only `SchemaReferencesMapType` (raw schemas, O(1)). No TS2589.

The schema-object overloads (`instantiate<TSchema>(schema, data):
ParseOutputType<TSchema>`, etc.) are unaffected — they already compute the output
type on demand from the passed schema; this change just makes the **string-id**
overloads behave the same way.

### Trade-off to note

This trades one eager registry-wide expansion for per-call-site computation. A
module that instantiates many *different* schemas pays each schema's
`ParseOutputType` depth where it's called rather than once at `create()`. That is
strictly better for declaration emit (the failure mode), and for typical call
sites is bounded by a single schema's `$ref`/nesting depth. If a pathological
single schema is itself too deep for one call site, that is a separate, smaller
problem (a depth guard inside `ParseOutputType`) and is not what bites here.

### What it eliminates downstream

`signal/jt.ts` becomes:

```ts
export const signal = JsonTology.create({
  baseIRI: 'https://ontology.shortslop.io/signal',
  schemas: SIGNAL_SCHEMAS,
  enableStrictGraph: true, enableStrictTypes: true, enableTypeCast: false,
  predicateFor: groundedPredicate,
});
```

— full inference, no `{$id}[]` erasure, no `as JsonTology<…>`, no hand-written
`SignalTypeMap`, no `WIRE_REF_SCHEMAS` tuple.

---

## Issue 2 — `addTransform`'s public `encode` demands the branded type

### What happens

`addTransform` (`src/JsonTology.ts`, ~line 912) types its functions as:

```ts
fns: {
  decode: (input: InferSchemaType<TSchema, TSchema, TRefs>) => TOut;
  encode: (output: TOut) => InferSchemaType<TSchema, TSchema, TRefs>;  // BRANDED
}
```

An `encode` returns a plain wire object that is subsequently re-validated; it
cannot realistically produce pre-*branded* values (`string & MinLength<1>`,
etc.). The implementation already knows this — `addTransform` immediately does:

```ts
Transform.create<TSchema, TOut>(schema, fns as unknown as {
  decode: (input: InferSchemaType<TSchema>) => TOut;
  encode: (output: TOut) => LooseInputType<InferSchemaType<TSchema>>;   // brand-free
});
```

So the public type says "branded" while the body treats encode as `LooseInputType`
(brand-free). A caller that writes the honest, ergonomic encode (returning the
brand-free shape) doesn't match the public param and must cast.

### Fix: type `encode`'s return as `LooseInputType`

```ts
encode: (output: TOut) => LooseInputType<InferSchemaType<TSchema, TSchema, TRefs>>;
```

(and the same on `Transform.create`'s static `encode`). The public type now
matches what the implementation actually wants — so the internal `as unknown as`
in `addTransform` also disappears, public and internal finally agreeing. `decode`
is unchanged (its input genuinely *is* the branded, validated payload).

### What it eliminates downstream

`defineSource`'s one bridge:

```ts
const codec = signal.addTransform(wireSchema, fns);   // was: fns as Parameters<…>[1]
```

---

## Net

Issue 1 removes the registry-instance type workaround (cast + hand-written map +
primitives tuple + schema erasure). Issue 2 removes the transform-wrapper cast.
Together they leave a large-registry consumer's registry module and codec factory
fully inferred and cast-free. The only `as` that should remain on the consumer
side is genuine *value*-level coercion between two **differently-branded** fields
(e.g. comparing a `Label`-branded id with an `Iri`-branded url) — correct nominal
behaviour, not a json-tology gap.

### Validation when implementing

- Add a declaration-emit test: a fixture registry with a deep root entity (≥6
  `$ref`/nesting levels) and ~20+ sibling schemas, built with `create()` and
  exported, compiled under `declaration: true` / `tsc -b`. It must emit without
  TS2589. (This reproduces the failure that the erasure currently hides.)
- Assert `instantiate(id, data)` and `materialize(id, …)` still return the
  branded entity type for a string `$id` (parity with the old `TMap[K]`).
- Assert an `addTransform` whose `encode` returns a plain brand-free object
  type-checks with no cast, and round-trips through `dump`/`encode`.
