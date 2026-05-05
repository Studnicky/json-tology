# Design 0001 — Typed `ref()` builder

**Status.** Draft for 0.4
**Authors.** Andrew Studnicky
**Date.** 2026-05-05

---

## Summary

Replace the bare-string `$ref` authoring pattern with a typed `ref(SourceSchema)` builder that returns `{ $ref: SourceSchema['$id']; readonly '~jt:source': typeof SourceSchema }`. The phantom `~jt:source` field is stripped before the JSON Schema is serialized to the wire, but it lets the TypeScript inference engine read the referenced schema's shape directly without going through a registry-wide `TReferences` map.

## Why

Today's path:

```ts
const UserSchema = { $id: 'urn:bookstore:User', ... } as const;

const OrderSchema = {
  $id: 'urn:bookstore:Order',
  properties: {
    buyer: { $ref: UserSchema.$id }            // $ref is a string literal
  }
} as const;

const jt = JsonTology.create({
  schemas: [UserSchema, OrderSchema] as const  // registry threads references at the type level
});
```

Inference works only when `UserSchema` is registered alongside `OrderSchema` in `JsonTology.create`'s tuple. Drop that registration and `order.buyer` is `unknown`.

Compare with Zod, which has no `$ref`: `z.object({ buyer: UserSchema })` rides the TypeScript reference directly. There is no registry because the value *is* the type.

We cannot make Zod's path the primary one - JSON Schema's wire format requires `{ $ref: <iri> }`. But we can keep the wire shape and recover the local-reference ergonomics by carrying a phantom alongside it.

## The builder

```ts
// src/modules/compose/Ref.ts
export function ref<TSchema extends { readonly '$id': string }>(
  source: TSchema
): RefType<TSchema> {
  return Object.freeze({ '$ref': source.$id }) as RefType<TSchema>;
}

// src/types/Ref.ts
export type RefType<TSchema extends { readonly '$id': string }> = {
  readonly '$ref': TSchema['$id'];
  readonly '~jt:source'?: TSchema;       // phantom, optional, stripped on serialize
};
```

The phantom uses `~jt:` prefix because:
- `$` and `_` collide with JSON Schema and JT extension keywords.
- `~` is reserved in JSON Pointer escaping but not in property names; valid JSON.
- The leading `~` sorts to the end alphabetically and reads as "annotation."
- The prefix `jt:` aligns with `jt:alias`, `jt:computed`, etc.

`?:` (optional) means non-typed callers writing `{ $ref: 'urn:...' }` still satisfy `RefType` syntactically. The phantom narrows the type when present.

## Authoring patterns

```ts
import { ref } from 'json-tology';

const UserSchema = {
  $id: 'urn:bookstore:User',
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name']
} as const;

const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    buyer: ref(UserSchema)                    // typed; no registry needed
  }
} as const;

type Order = InferType<typeof OrderSchema>;
//   ^? { readonly buyer?: { readonly name: string } }
```

`InferRefType` reads `~jt:source` first; if present, it recurses into the referenced schema with no registry lookup. If absent (legacy bare-string `{ $ref: 'urn:...' }`), it falls back to the existing `TReferences` map path. **Backwards-compatible**: every existing schema literal continues to work.

## Wire format

The `~jt:source` field never reaches the wire. Two layers strip it:

1. **Serializer (`dump`, `toSchema`, `toTbox`, `toShacl`, `toQuads`, `dumpJson`)**: walks the schema graph and omits any `~jt:*` properties before emitting. Already a small extension to the existing `omitInternalKeys` predicate in the Dump module.

2. **`SchemaRegistry.register`**: rejects (or strips, behind a flag) `~jt:*` keys before storing. The registry is the canonical store; the phantom is an authoring convenience, not a stored axis.

A round-trip test asserts `JSON.stringify(stripPhantoms(schema))` is byte-identical to the legacy bare-`$ref` shape.

## Pipeline integration

### Type inference (`InferType`, `InferSchemaType`)

`InferRefType` gains a new first branch:

```ts
type InferRefType<T, TRoot, TReferences>
  = T extends { readonly '~jt:source': infer TSource }
    ? InferSchemaType<TSource, TSource, TReferences>     // direct recursion, no map
    : T extends { readonly '$ref': `#/$defs/${...}` } ?
    ...                                                   // existing branches unchanged
```

The phantom branch fires before any of the existing string-pattern branches, so the typed path is always preferred when present.

### Runtime registry

Two modes coexist:

1. **Phantom-aware registry** (no-op for `ref()`-built schemas): when a schema's `$ref` slot has `~jt:source`, the registry doesn't need cross-references at parse time - the schema is self-contained at the type level. Runtime resolution still uses the IRI for graph identity, so the source schema must be registered (otherwise `$ref` resolution at validate time fails). The registry can auto-register transitive sources when it walks a schema with phantoms, removing the need to enumerate every schema in `JsonTology.create`'s tuple.

2. **Tuple-driven registry** (today's behaviour, default for legacy callers): `JsonTology.create({ schemas: [...] })` walks the tuple, registers each, and the type-level `TReferences` map handles bare-string `$ref`s.

Auto-registration via phantom traversal is the 0.4 ergonomic win:

```ts
const jt = JsonTology.create({
  schemas: [OrderSchema] as const                // no need to list UserSchema
  // OrderSchema's properties.buyer carries ~jt:source = UserSchema, so the
  // registry can walk the tree and register UserSchema transitively.
});
```

### Validation

No change to `validate()` semantics. The runtime walks the registered schema graph by IRI, the same way it does today. The phantom is invisible to AJV's compiled validator (it's a sibling property the validator doesn't recognize, so JSON Schema 2020-12 says ignore it).

### Instantiate / Coerce / Materialize

Unchanged at the runtime layer. The compile-time return type already comes from `TMap[K]` or `ParseOutputType<TSchema>`, both of which call `InferSchemaType`, which now reads `~jt:source` first.

### Graph construction

`SchemaGraph` already builds graph nodes keyed by IRI. The phantom is read once during translation - the source schema's IRI is added to the parent's range edges - and dropped. Graph identity remains IRI-based, so `findDuplicates`, `equivalent`, `extend`, `Compose.discriminatedUnion`, and TBox emission all continue to work unchanged.

### Composition

```ts
import { Compose, ref } from 'json-tology';

const OrderWithPaymentSchema = Compose.extend(
  OrderSchema,
  { payment: ref(PaymentSchema) } as const,
  'urn:bookstore:OrderWithPayment'
);

type OrderWithPayment = InferType<typeof OrderWithPaymentSchema>;
//   ^? Order & { readonly payment?: Payment }
```

`Compose.extend` already deep-clones additions; it just needs to preserve `~jt:source` on the cloned `$ref` slot. One-line change.

### Transforms

Transforms attach by `$id`, not by reference shape. `Transform.create(SourceSchema, { decode, encode })` is unaffected. A consumer schema that does `{ field: ref(SourceSchema) }` automatically inherits the decoder at runtime because the registry resolves by IRI. The phantom doesn't carry transform info; that stays in the WeakMap keyed by source schema object identity.

### Serialization (toTbox / toShacl / toQuads / dumpJson / toSchema)

Each serializer walks the canonical graph (IRI-keyed). Phantoms never reach the graph - they're stripped at registration time. No change to the projection layer.

### Tooling and errors

Compile-time:

- `ref(notASchemaWith$id)` is a type error.
- `ref(SourceSchema)` returns a type with the `$ref` literal locked to `SourceSchema['$id']`. Misspelling the IRI in a bare-string fallback no longer compiles silently to `unknown` - users prefer `ref()` because it gives them types and IRI safety in one move.
- `JsonTology.create({ schemas: [...] })` could accept a single root schema (any schema referenced via phantoms is auto-registered). Existing tuple form stays valid.

Runtime:

- `register()` warns (or errors under `enableStrictGraph`) if a schema carries `~jt:source` for an IRI that's not yet registered AND the target schema isn't reachable via phantom traversal.
- Validators emit a one-time warning if asked to validate against a schema whose phantom IRI doesn't match its `~jt:source.$id`. (Catches refactor mistakes where someone copies a schema literal and forgets to update the phantom.)

### Migration path

No breaking change. Three paths coexist:

1. **Phantom-typed**: `{ buyer: ref(UserSchema) }`. Best ergonomics, type-safe IRIs, no registry tuple needed.
2. **Bare-string with registered tuple**: `{ buyer: { $ref: UserSchema.$id } }` plus `JsonTology.create({ schemas: [UserSchema, OrderSchema] })`. Works today, continues to work.
3. **Bare-string IRI literal**: `{ buyer: { $ref: 'urn:bookstore:User' } }` plus tuple registration. Works today, continues to work, but the IRI string is unchecked at the call site.

A codemod (`json-tology codemod ref`) walks a project's schemas and rewrites `{ $ref: SchemaName.$id }` literals to `ref(SchemaName)`. The codemod is a separate ship, not blocking 0.4.

## What this changes for users

| Before (0.3) | After (0.4) |
|--------------|-------------|
| Must list every schema in `JsonTology.create({ schemas: [...] })` for type inference to follow `$ref`s | Listing only the root schema is enough; `ref()` propagates types and the registry auto-walks |
| `{ $ref: UserSchema.$id }` types as `unknown` outside a registered tuple | `ref(UserSchema)` types correctly anywhere, including in standalone schema literals |
| Misspelled IRI compiles silently to `unknown` | Misspelled IRI is a type error at the `ref(...)` call site |
| `JsonTology.create({ schemas: [A, B, C, D, E, F, G] as const })` is the canonical form | The tuple is optional; only needed for legacy bare-string `$ref`s |

## What this does NOT change

- The wire format. JSON Schema documents emitted by `toSchema()` are byte-identical to today's output.
- Cross-schema runtime resolution. The registry still resolves by IRI.
- The graph model. Nodes and edges are IRI-keyed.
- Composition semantics. `Compose.extend`, `Compose.intersection`, `Compose.discriminatedUnion`, `Compose.equivalent`, `Compose.pick`, `Compose.omit`, `Compose.partial`, `Compose.required`, `Compose.getDefaults`, and `Compose.narrow` all keep their current contracts.
- Transform decoders/encoders. Same `Transform.create` API, same WeakMap registry.
- TBox/SHACL/JSON-LD output. Same projections, same predicates.

## Risks

- **Phantom stripping must be absolute.** Anywhere a schema is serialized to JSON, the `~jt:*` family must be omitted. Add a single canonical `stripJtAnnotations(schema)` helper used by every serializer; cover with a property-test (`assert.deepEqual(JSON.parse(JSON.stringify(stripJtAnnotations(s))), s.withoutPhantoms)`).
- **Schema identity.** Two `ref(SourceSchema)` calls produce two distinct `Object.freeze`d objects. Identity is IRI-based, not reference-equality, so this is fine, but lint should warn against `ref()` in tight loops.
- **Recursive types.** `ref(Self)` requires the source schema's literal to be in scope. Self-references continue to work via bare-string `{ $ref: '#' }` or `{ $ref: SelfSchema.$id }`. `ref()` can be extended later with a forward-declaration helper if needed.
- **Type-level cost.** The phantom adds one branch to `InferRefType`. The branch is at the top, so it short-circuits early for the typed path; legacy paths see no extra work.
- **JSON Schema validators downstream.** AJV ignores unknown keywords; `~jt:source` is a property on the `$ref` object, which validators must already ignore per spec. Verified.

## Open questions

1. **Should `ref()` accept an inline schema literal?** `ref({ $id: '...', type: 'string' } as const)` would be valid TypeScript but registers an inline schema by IRI. Probably yes - it's a natural extension and lets users author and reference in one expression. Decide before implementation.
2. **Should the registry auto-strip on `register()`, or reject?** Strip is friendlier; reject is louder. Lean strip, behind a `enableStrictPhantoms` option that promotes to error.
3. **Should `ref()` produce a `Symbol`-keyed phantom instead of a string-keyed `~jt:source`?** `Symbol`s are stripped automatically by `JSON.stringify`. Pro: zero-cost serialization, no helper needed. Con: `Symbol`-keyed properties are invisible to TypeScript's structural inference; we'd need a brand interface intersection trick. Deferred - the string-keyed phantom is simpler and the strip helper is small.
4. **Codemod scope.** `{ $ref: X.$id }` is mechanical. `{ $ref: 'urn:...' }` (bare literal) requires resolving the literal back to a schema variable; only feasible when the IRI matches a known `$id` in the same project. Codemod targets the first form and warns for the second.
5. **Static helpers.** `JsonTology.validate(schema, data)` and friends already accept a schema object; `ref()`-containing schemas pass through unchanged. Confirm with a smoke test.

## Implementation outline

Phase 1 (0.4-alpha):

1. `src/types/Ref.ts` - add `RefType`.
2. `src/modules/compose/Ref.ts` - add `ref()` builder.
3. `src/types/Infer.ts` - prepend the `~jt:source` branch in `InferRefType`.
4. `src/modules/dump/StripJtAnnotations.ts` - extract the strip helper, wire into every serializer.
5. `src/modules/registry/SchemaRegistry.register` - strip on register; add `enableStrictPhantoms` option.
6. Phantom auto-walk in registry: when `register()` sees a schema with `~jt:source`, recursively register the source if not already registered.

Phase 2 (0.4-rc):

7. Codemod in `src/cli/Codemod.ts` for `{ $ref: X.$id }` -> `ref(X)`.
8. Lint rule: prefer `ref()` over bare-string `$ref` when the source is in scope.
9. Doc rewrite: every page that authors a multi-schema example switches to `ref()`.

Phase 3 (0.4 release):

10. Soft-deprecate the bare-string + tuple authoring path. Bare-string keeps working; codemod is offered on first run.

## Done means

- `OrderSchema` with `ref(UserSchema)` infers correctly outside a `JsonTology.create({ schemas: [...] })` registration.
- `JsonTology.create({ schemas: [OrderSchema] })` successfully resolves transitive references via phantom traversal.
- `JSON.stringify(toSchema(jt, OrderSchema.$id))` matches the byte sequence today's bare-string version produces.
- All 0.3.x usage examples continue to work without modification.
- The codemod converts `{ $ref: X.$id }` -> `ref(X)` on a representative project (the bookstore example) without regressions.
- The 22 remaining `compile-time-constraints.test.ts` errors that aren't about `$ref` are addressed separately (tracked in #13).

## Done does NOT mean

- Bare-string `$ref` is removed.
- The registry is removed. (Runtime IRI resolution still requires it.)
- The wire format changes.

---

## Addendum: registry-as-cache, not registry-as-requirement

The phantom only solves type inference. The deeper goal is that **users should not have to import or thread a registry to do anything** — including runtime validation, instantiation, materialization, transforms, invariants, computeds, or graph projection. Just import the schema and use it.

### Today's friction

Right now the runtime path looks like:

```ts
// schemas/User.ts
export const UserSchema = { $id: '...', ... } as const;

// schemas/Order.ts
export const OrderSchema = { $id: '...', properties: { buyer: { $ref: UserSchema.$id } } } as const;

// services/order-handler.ts
import { JsonTology } from 'json-tology';
import { UserSchema } from '../schemas/User.js';
import { OrderSchema } from '../schemas/Order.js';

const jt = JsonTology.create({ schemas: [UserSchema, OrderSchema] as const });

export function handleOrder(req: unknown) {
  return jt.instantiate(OrderSchema.$id, req);   // jt is mandatory
}
```

`jt` is a *handle* the caller has to construct, hold, and pass around. In a multi-file codebase you end up with a "schemas registry" module that exports `jt`, and every consumer imports from it. That's the registry-import-everywhere problem.

### The design target

```ts
// services/order-handler.ts
import { JsonTology } from 'json-tology';
import { OrderSchema } from '../schemas/Order.js';

export function handleOrder(req: unknown) {
  return JsonTology.instantiate(OrderSchema, req);  // no registry; no tuple; types ride the import
}
```

`JsonTology.<op>(schema, data)` exists today as the "static counterpart" surface (the 13 statics added in 0.3). 0.4 makes those statics first-class:

- They walk the schema's phantoms to discover every dependent schema.
- They auto-attach transforms, invariants, and computeds carried by the schema object.
- They internally cache compiled validators by schema-object identity (WeakMap), so the second call against the same `OrderSchema` is warm.

`JsonTology.create({ schemas: [...] })` becomes a *performance affordance*, not a correctness requirement:

- Pre-compile validators across a known set of schemas at boot.
- Keep a long-lived handle when you want to reuse the same compiled validator graph.
- Get an `entities.value.cast(id, data)` style API where `id` is a string lookup.

If the user never calls `create()`, every static helper still works.

### What has to travel with the schema object

For `JsonTology.<op>(SchemaLiteral, data)` to be sufficient, every piece of metadata that's currently attached via the registry must instead travel with the schema literal — either embedded in it or stored against its object identity.

| Today's API | Today's storage | 0.4 design |
|---|---|---|
| `Transform.create(S, { decode, encode })` | WeakMap keyed by S | Same. WeakMap survives across files because S is the same object. ✓ already works |
| `addInvariant(S, fn)` (instance method on `JsonTology`) | Per-registry map | Move to a module-level WeakMap keyed by S. Expose as `Transform.addInvariant(S, fn)` or `Invariant.add(S, fn)`. Same identity model as Transform. |
| `addComputed(S, key, fn)` | Per-registry map | Same — module-level WeakMap. `Computed.add(S, key, fn)`. |
| Cross-schema `$ref` resolution | Registry IRI → schema lookup | `~jt:source` phantom + transitive walk; registry only consulted as a fallback for legacy bare-string `$ref`s |
| Compiled validator cache | Per-registry map | Module-level WeakMap keyed by schema literal; eviction on schema mutation (frozen schemas never evict) |

The pattern is consistent: **everything keyed by `$id` in the registry today moves to a module-level WeakMap keyed by the schema's object identity in 0.4**. Schema literals are typically frozen and exported once, so identity is stable across the program.

### What still requires a registry

Two scenarios genuinely need a long-lived handle:

1. **Lookup by IRI.** `entities.materialize('urn:bookstore:Order', data)` takes a string. There's no schema object in the call site to walk. If this is a desired surface, it needs a place that holds `{ iri → schema }`. Solution: keep `JsonTology.create({ schemas: [...] })` for callers who want this; move the underlying lookup to a process-global IRI map maintained by `Transform.create`/`ref()` (every call to those auto-registers the source schema in the global IRI map by its `$id`). String-IRI lookup then works without an explicit `create()`.
2. **Mutual-reference `Compose.equivalent` cycles.** Two schemas that reference each other before either has been declared as a TS variable need a forward-reference. Solution: `lazyRef(() => SchemaB)` builder for the cyclic case. (Same pattern Zod uses for `z.lazy(() => Schema)`.)

Everything else falls out of "metadata travels with the schema object."

### Process-global IRI map

A single module-level `Map<string, SchemaLiteral>` populated automatically by `ref()` and `Transform.create` and `Compose.*`. Public API:

```ts
import { Schemas } from 'json-tology';

Schemas.byId('urn:bookstore:User')  // returns UserSchema or throws
Schemas.has('urn:bookstore:User')   // boolean
```

This is the *only* state that's process-global. It's small, monotonic, and reflects "every schema this Node process has seen." `JsonTology.create({ schemas: [...] })` becomes equivalent to "ensure these schemas are in the global IRI map" + "compile validators eagerly" + "return a stateful handle for the cache-reuse case."

For test isolation, expose `Schemas.snapshot()` / `Schemas.restore(snapshot)` / `Schemas.clear()` — the same pattern Zod uses for its global registry of `z.string().describe(...)` metadata.

### What the public surface looks like in 0.4

```ts
import {
  ref, lazyRef,                          // type-typed references
  Transform, Invariant, Computed,        // schema-attached metadata
  Compose,                               // schema combinators
  JsonTology,                            // static helpers + optional cache handle
  Schemas                                // process-global IRI lookup
} from 'json-tology';

// Authoring (no registry import)
const UserSchema = {
  $id: 'urn:bookstore:User', type: 'object',
  properties: { name: { type: 'string' } }, required: ['name']
} as const;

Invariant.add(UserSchema, u => u.name.length > 0 ? null : 'name required');

const OrderSchema = {
  $id: 'urn:bookstore:Order', type: 'object',
  properties: { buyer: ref(UserSchema), total: { type: 'number' } }
} as const;

// Use (no registry import, no tuple)
const order = JsonTology.instantiate(OrderSchema, data);
const ok = JsonTology.is(OrderSchema, data);
const tbox = JsonTology.toTbox(OrderSchema);

// Optional cache handle (only when warm-up matters)
const jt = JsonTology.create({ schemas: [OrderSchema] });
jt.instantiate(OrderSchema, data);            // hot path; phantom auto-walks UserSchema
jt.materialize('urn:bookstore:Order', data);  // string-IRI lookup via global map
```

The mental model: schemas are *values that know how to validate themselves*. The library provides operators (static helpers) that take a schema and produce a result. A registry is one operator's optional cache, not a thing every operator needs.

### Migration story (revised)

| Today | 0.4 |
|---|---|
| `const jt = JsonTology.create({ schemas: [A, B, C] })` + import `jt` everywhere | Drop. Use `JsonTology.<op>(SchemaLiteral, data)` directly. |
| `jt.addInvariant(SchemaA, fn)` | `Invariant.add(SchemaA, fn)` at module scope, runs once at module load. |
| `jt.addComputed(SchemaA, 'key', fn)` | `Computed.add(SchemaA, 'key', fn)` at module scope. |
| `jt.materialize('urn:.../A', data)` | Either `JsonTology.materialize(SchemaA, data)` (preferred) or keep the string-IRI form via global map (`Schemas.byId`). |
| `JsonTology.create` with 50 schemas as a tuple | Optional — only when you want eager compilation. The schemas are in the global IRI map regardless once their modules load. |

### Risks of this expansion

- **Process-global mutable state.** A side-effecting import (`Invariant.add`, `Transform.create`) registers things in module-global WeakMaps. Test isolation requires snapshot/restore. Document it loudly. Provide ESLint rule: prefer module-top-level metadata calls over runtime ones.
- **WeakMap memory.** Schema literals are typically retained for the program lifetime, so the WeakMaps don't actually allow GC. That's fine — schemas are intentionally long-lived — but document it so users don't expect freeing.
- **Forward references.** `lazyRef(() => Schema)` works but adds a small runtime cost. Document when it's needed.
- **"Where do my transforms live?"** discoverability. Today users find them on `jt.*`. Tomorrow they're module-level functions. Doc landing page must surface `Transform`, `Invariant`, `Computed`, `Schemas` as peers of `JsonTology`.

### Open questions added

6. **Module-level metadata APIs.** `Invariant.add(S, fn)` vs `addInvariant(S, fn)` (free function) vs `S.addInvariant(fn)` (method on a frozen schema — requires unfreezing or a Proxy). Lean: `Invariant.add(...)` for symmetry with `Transform.create`.
7. **Process-global IRI map.** Is the auto-populating `Schemas` map a public API, or an internal implementation detail of `JsonTology.<op>` statics? If public, what's its mutation API (only `add`?), what's its query API (`byId`, `has`, `iter`?), what's the test-isolation contract?
8. **Should `JsonTology` the class even be exported in 0.4?** If the static helpers are the canonical surface and the cache handle is opt-in, maybe the export is `jsonTology` (an object with the statics) and the constructor surface (`createCache({ schemas })`) is a separate name. Naming-bikeshed; defer until Phase 1 lands.

### Done means (revised)

- A consumer can write `JsonTology.instantiate(OrderSchema, data)` in a fresh file, with only `import { JsonTology } from 'json-tology'` and `import { OrderSchema } from './schemas/Order.js'`, and have validation, defaults, transforms, invariants, computeds, and `$ref` resolution all work — no `JsonTology.create` call anywhere in the program.
- A consumer who wants warm validators can opt into `JsonTology.create({ schemas: [...] })` and pass the resulting handle to functions that prefer it. Both forms produce identical behaviour; only the perf profile differs.
- The bookstore example app demonstrates both modes side-by-side.
