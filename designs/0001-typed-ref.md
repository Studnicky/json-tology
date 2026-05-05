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

---

## Addendum: risks deepened, with comparator analysis

The "registry-as-cache" addendum sketched four risks. This section names them concretely, walks the failure mode for each, surveys how Zod, TypeBox, and Pydantic handle the same problem, and proposes a mitigation. One of the surveys (wrap-and-return on metadata) is strong enough to revise the architecture.

### Risk 1: Side-effecting imports register module-global state

**Concrete failure modes:**

- **Import-order coupling.** Module A imports `UserSchema` and calls `Invariant.add(UserSchema, validateName)`. Module B imports `UserSchema` directly without ever loading A. Module B's calls to `JsonTology.validate(UserSchema, ...)` silently skip the invariant. The invariant is "registered" only when A's module evaluation order puts it ahead of the validation call. Bug surfaces only at runtime, often in production where a barrel file masked an import that the dev tree happened to include.
- **Test pollution.** Test 1 calls `Invariant.add(S, fn)`. Test 2 runs in the same process, re-imports `S`, and observes Test 1's invariant. Test 2 may fail or pass spuriously depending on Test 1's execution.
- **Hot-reload duplication.** A dev server reloads the module that calls `Transform.create(S, decoderA)`. Because the schema literal `S` is reconstructed on reload as a new object reference, the WeakMap accumulates an entry per reload. Memory grows; old decoders linger keyed against orphaned schema objects. (Survives because the test harness keeps strong refs for assertions; otherwise this would self-clean.)
- **Race between transitive imports.** `Compose.equivalent(PersonNameSchema, ...)` for `CustomerNameSchema` and `AuthorNameSchema` in two separate modules. Whichever module evaluates first wins the global IRI map; the second observes a mismatch and either silently overrides or throws.
- **Code-splitting / tree-shaking.** A bundler removes `Invariant.add(S, fn)` because the call has no observable return value. Validator now skips the invariant in production builds only.

**Zod's approach.** No process-global state. `.refine(fn, msg)` returns a NEW schema with the refinement baked into the validator chain. Modules that need the refinement import the refined schema, not the original. Identity is the schema variable, not an IRI. Test isolation is structural - each test imports the schemas it actually exercises. There is no "did A's module load before B's?" question because there is no shared mutable side-channel.

**TypeBox's approach.** Same as Zod. Refinements (`Type.String({ minLength: 1 })`) live inside the schema body. `Type.Transform(...)` returns a new schema. `TypeCompiler.Compile(Schema)` returns a compiled validator function the user holds; no cache. The user manages a Map<schema, compiled> if they want one.

**Pydantic's approach.** Validators live on the class itself via `@validator('field')` decorators. The class definition is the registration site, evaluated exactly once at module-load. Subclasses inherit; runtime mutation of an existing class's validators is not supported. The class IS the storage; there is no side-channel to fall out of sync with.

**The mitigation that follows from the survey: wrap-and-return.**

Replace the side-effecting `Invariant.add(S, fn)` with `Invariant.attach(S, fn)` that returns a new schema with the invariant baked in via a phantom field:

```ts
// Before (side-effecting, module-global state)
import { UserSchema } from './schemas/User.js';
Invariant.add(UserSchema, u => u.name.length > 0 ? null : 'name required');
// every consumer of UserSchema now indirectly sees this invariant

// After (wrap-and-return, no side-effect)
import { UserSchema as _UserSchemaBare } from './schemas/User.bare.js';
import { Invariant } from 'json-tology';
export const UserSchema = Invariant.attach(_UserSchemaBare,
  u => u.name.length > 0 ? null : 'name required'
);
// consumers import the refined UserSchema; the bare version stays available
```

The phantom storage is `~jt:invariants?: ReadonlyArray<InvariantFnInterface>`, stripped at every serializer alongside `~jt:source`. `Compose.equivalent`, `Compose.extend`, `Compose.intersection`, and the rest preserve the phantom array on combine.

Every concrete failure mode above evaporates: import order is irrelevant (you import the refined schema directly), tests pass refined schemas as fixtures, hot-reload produces new objects with the same content, code-splitting cannot tree-shake away a pure expression that's exported, and there is no global IRI map for races to hit.

The cost: users have to choose between exporting `UserSchema` (refined) and exporting `UserSchema_bare` (no invariant). For most projects there's only one - the refined version is the canonical export. Same convention Zod uses.

**Recommendation: 0.4 adopts wrap-and-return for `Invariant`, `Computed`, `Transform`. The process-global IRI map stays, but only as an auto-populated index for `JsonTology.materialize('urn:.../X', data)` style string-IRI calls. Snapshot/restore stays for test isolation.**

---

### Risk 2: WeakMap memory and GC behaviour

**Concrete failure modes:**

- **Phantom retention.** A WeakMap keyed by schema objects allows GC when the schema is unreferenced. Schemas are typically frozen module-level constants retained for program lifetime, so the WeakMap entries also live for program lifetime. Not a leak (everything's reachable), but not a feature either.
- **Per-request schemas.** A user generates schemas dynamically per request (e.g. building variant schemas from query parameters). The WeakMap GC's correctly when the request handler returns - good. But the compiled validator cache is also released, so each request pays the compilation cost.
- **Heap snapshots show "unreleasable" entries.** A monitoring engineer reviewing a heap snapshot sees a 50-MB WeakMap and panics. The schemas are intentional long-lived state; the WeakMap is doing exactly what it should.

**Zod's approach.** No metadata WeakMap. Schemas are JS objects with methods on them; the schema body holds everything. Each parse interprets the schema. Compilation cache (when used via third-party libraries like `zod-fast-check`) is the user's responsibility.

**TypeBox's approach.** No metadata WeakMap. Schemas are plain JSON Schema objects. `TypeCompiler.Compile` returns a closure - the user decides what to do with it. Heap impact is exactly what the user holds.

**Pydantic's approach.** Validator code lives on the class via the metaclass. Classes are interned in Python's module namespace. Heap impact is exactly the class set.

**Mitigation:**

If the wrap-and-return refactor lands, the only WeakMaps left are:

1. **Compiled validator cache** (purely a performance optimisation; identity-keyed, schemas frozen).
2. **Process-global IRI map** (intentional state for string-IRI lookup).

Both are documented as "long-lived by design." Provide:

- `Schemas.heapStats()` debug helper returning `{ schemaCount, validatorCount, byteEstimate }` for monitoring.
- `Schemas.evict(SchemaLiteral)` and `Schemas.clear()` for explicit teardown.
- Doc page under Reference titled "Process-global state" enumerating exactly what state exists, where, and how to reset it.

---

### Risk 3: Forward references and cycles

**Concrete failure modes:**

- **Mutual recursion.** `EmployeeSchema` references `ManagerSchema` references `EmployeeSchema`. `ref(ManagerSchema)` cannot evaluate at the time `EmployeeSchema` is being defined.
- **Self-reference at the type level.** `PersonSchema.manager: ref(PersonSchema)` requires `PersonSchema` to exist when its own `properties.manager` is being authored.
- **Lazy circular imports.** Module A imports B which imports A. ESM breaks the cycle by giving one side a partially-initialised binding; whichever side calls `ref(...)` on the partial wins or loses depending on order.

**Zod's approach.** `z.lazy(() => Schema)` defers resolution to first use. TypeScript handles recursive types fine when the user supplies an explicit type annotation - Zod publishes the pattern in its docs. Internally `z.lazy` stores the thunk and invokes it on first parse.

**TypeBox's approach.** `Type.Recursive((This) => Type.Object({ next: This }))` passes a self-reference as a type parameter to the body. Type-level recursion lives inside the parameter. Cleaner than Zod for self-reference; mutual recursion still wants a thunk.

**Pydantic's approach.** Forward references as string class names: `manager: 'Manager'`. After both classes are defined, `Model.model_rebuild()` resolves the strings. Slightly clunky but explicit.

**Mitigation:**

- **`lazyRef(() => Schema)`** for the mutual-recursion case. Returns `{ $ref: <thunked-id>; '~jt:source-thunk': () => TSchema }`. The phantom is invoked at first use, memoised thereafter.
- **`Self` builder** for direct self-reference: `{ manager: Self }` resolved against the enclosing schema's `$id` at translation time. Same trick TypeBox uses.
- **Type-level recursion** already works in `InferType` because TypeScript natively supports it when the schema is a `const`.
- **ESM cycle handling.** Document that mutual-reference schemas should be defined in the same file (the natural unit). Cross-file mutual references must use `lazyRef`.

---

### Risk 4: Discoverability of the metadata API surface

**Concrete failure modes:**

- A user opens the docs and reads about `JsonTology.validate(schema, data)`. They want to add an invariant. They search the `JsonTology` API and find nothing. They give up or attach the check by hand.
- A user is mid-IDE auto-complete on a schema literal, types `.`, and gets nothing because schema literals are plain `as const` objects with no methods.
- A user reads a Zod migration guide and looks for the json-tology equivalent of `.refine`. Without explicit landing-page presence, they don't find it.

**Zod's approach.** Everything is a method on the schema instance. `.refine`, `.transform`, `.default`, `.optional`, `.describe`, `.brand`. IDE auto-complete is the documentation. Tradeoff: Zod is not interoperable with raw JSON Schema; you have to use Zod's DSL throughout.

**TypeBox's approach.** Namespaced builders. `Type.Object`, `Type.Union`, `Type.Transform`, `Type.Recursive`. `Value.Decode`, `Value.Errors`, `Value.Cast`. `TypeCompiler.Compile`. Each namespace covers one axis. Auto-complete on `Type.` surfaces every builder; on `Value.` every runtime op. Easy to discover.

**Pydantic's approach.** Methods on the class plus decorators. `@validator`, `@root_validator`, `@field_serializer`. Documentation is the primary discovery mechanism; auto-complete is partial because decorators are out-of-band.

**Mitigation:**

Adopt TypeBox's namespacing for the wrap-and-return APIs:

```ts
import { Compose, Invariant, Computed, Transform } from 'json-tology';

const UserSchema = Invariant.attach(_UserSchemaBare, validateName);
const ProductSchema = Computed.attach(_ProductSchemaBare, 'displayName', deriveDisplayName);
const TimestampSchema = Transform.attach(_TimestampSchemaBare, { decode: ..., encode: ... });
const Equiv = Compose.equivalent(...);
const Extended = Compose.extend(...);
```

`.attach` is the consistent verb. `.attach` returns a new schema; the old `.add` (side-effecting) is removed. Every namespace has exactly one verb. The doc page "Authoring patterns" lists all six in one table.

**Compose surface stays.** Today's `Compose.extend`, `Compose.intersection`, `Compose.discriminatedUnion`, `Compose.equivalent`, `Compose.pick`, `Compose.omit`, `Compose.partial`, `Compose.required`, `Compose.getDefaults`, `Compose.narrow` are all wrap-and-return already. Pattern is consistent end to end.

---

### Risk 5: Cache invalidation across schema variants

**Concrete failure mode (specific to wrap-and-return).**

- User writes `const S = SchemaBare; const S2 = Invariant.attach(S, fn);` then exports both. A consumer imports `S2` (refined) but a separate consumer imports `S` (bare). Both compile validators. The compiled validator cache is keyed by schema object identity, so two cache entries exist - which is correct, since they're distinct schemas with distinct semantics. Memory cost: 2x. Behaviour: correct.
- User writes `const S2 = Invariant.attach(S, fn1); const S3 = Invariant.attach(S, fn2);` - two attachments on the SAME bare schema producing two refined schemas. Both compile. Cache holds three entries (S, S2, S3). Behaviour correct; users can reason about the cache by counting the schema objects they created.

**Zod's approach.** Same outcome - `.refine` returns new schema, cache (when used) is keyed by the new schema instance.

**TypeBox's approach.** Same.

**Pydantic's approach.** Each subclass produces its own validator. Same outcome.

**Mitigation: none needed.** Wrap-and-return makes cache identity match semantic identity. The "user accidentally caches twice" scenario reduces to "user wrote two distinct schemas."

---

### Risk 6: Bundler / tree-shaking interactions

**Concrete failure modes (specific to side-effecting design):**

- `Invariant.add(S, fn)` is a no-return-value expression statement at module top level. A naive tree-shaker considers it side-effect-free and elides it. The validator now skips the invariant in production-only.
- `package.json#sideEffects: false` on json-tology marks the package as side-effect-free, which means consumers' bundlers may drop calls to `Invariant.add`. We can mark only the specific re-export paths as side-effectful, but it's fragile.
- Webpack and Rollup differ on how they treat `import './side-effect-module.js'` patterns.

**Wrap-and-return eliminates this entire risk class.** `const S2 = Invariant.attach(S, fn)` is an assignment with a return value the rest of the program reads. Tree-shakers can't elide it without breaking the program, because `S2` is observably used downstream.

**Zod / TypeBox / Pydantic.** None have this risk because none use side-effecting registration.

---

### Risk 7: Mental-model fragmentation across the API

If we kept side-effecting metadata for `Invariant` and `Computed` while `Transform.create` already returned a new schema, users would have two patterns:

- `Transform.create(S, ...)` returns a new schema. Use the returned value.
- `Invariant.add(S, fn)` returns nothing. Use S directly.

Same library, different ergonomics for adjacent operations. Confusing.

**Mitigation: wrap-and-return everywhere.**

```ts
const A = SchemaBare;
const B = Transform.attach(A, { decode, encode });   // returns new
const C = Invariant.attach(B, fn);                    // returns new
const D = Computed.attach(C, 'derived', fn);          // returns new
// D carries: bare body + transform + invariant + computed, all via phantom arrays
```

One verb, one pattern, one mental model. Renames Transform.create to Transform.attach for consistency (alias the old name during 0.3.x → 0.4 transition).

---

## Revised recommendation

The original design described a registry-as-cache architecture with module-level WeakMaps for invariants and computeds. The comparator analysis shows that approach pays a list of avoidable risks (side-effect coupling, tree-shaking interactions, test pollution, mental-model fragmentation) for a small ergonomic win.

**Replace the side-effect path with wrap-and-return for every metadata axis.** Phantoms (`~jt:source`, `~jt:invariants`, `~jt:computeds`) ride on the schema literal. Every operator (`Compose.*`, `Transform.attach`, `Invariant.attach`, `Computed.attach`, `ref`, `lazyRef`) is pure: takes a schema, returns a schema. The only surviving WeakMaps are pure performance caches (compiled validators, structural-hash dedupe) - never correctness-load-bearing.

This costs users one extra `const X = ...` line per metadata addition and no longer offers the `S.addInvariant(...)` ergonomic. In exchange, the library has zero process-global mutable correctness state. That tradeoff matches what every comparator settled on.

Update done-means accordingly:

- A consumer can `import { OrderSchema } from './schemas/Order.js'; const result = JsonTology.instantiate(OrderSchema, data);` and have validation, defaults, transforms, invariants, computeds, and `$ref` resolution all work. (Unchanged.)
- Every metadata addition is a `const X = Op.attach(S, ...)` returning a new schema. Wrap-and-return is the universal pattern. (New.)
- The library exports zero side-effecting public functions. (New.)
- `Schemas.byId(...)` is the only process-global state, populated automatically by `ref()` only when the IRI is observed; offers `snapshot/restore/clear`. (Refined.)

---

## Addendum: adopt TypeBox-style `recursive((self) => body)` for self-reference

Earlier the doc proposed `lazyRef(() => Schema)` for cycles plus a `Self` builder for direct self-reference. TypeBox's pattern is more graceful and we should match it.

### The pattern

```ts
import { recursive } from 'json-tology';

const PersonSchema = recursive(
  { $id: 'urn:bookstore:Person' },
  (self) => ({
    type: 'object',
    properties: {
      name:    { type: 'string' },
      manager: self                      // self is RefType<typeof PersonSchema>
    },
    required: ['name']
  } as const)
);

type Person = InferType<typeof PersonSchema>;
//   ^? { readonly name: string; readonly manager?: Person }
```

`self` is the typed reference. The user describes the body once; the closure receives a placeholder that the builder backfills with the assembled schema's `~jt:source` after the body returns. Type inference handles the cycle naturally because TypeScript supports recursive type aliases when they pass through a reference.

### Compared to the alternatives

```ts
// TypeBox: graceful, single-pass, type-safe
const Person = Type.Recursive((This) => Type.Object({ manager: Type.Optional(This) }));

// Zod: thunked, explicit lazy boundary, requires a manual type annotation for the recursive type
type Person = { name: string; manager?: Person };
const Person: z.ZodType<Person> = z.lazy(() => z.object({ name: z.string(), manager: Person.optional() }));

// Pydantic: forward-reference string + post-hoc rebuild
class Person(BaseModel):
    name: str
    manager: Optional['Person'] = None
Person.model_rebuild()
```

TypeBox wins on ergonomics: no thunk, no forward-ref string, no type annotation, no rebuild step. The user sees one expression that reads top-to-bottom.

### Implementation sketch

```ts
// src/modules/compose/Recursive.ts
export function recursive<TBody extends JSONSchema7Definition>(
  meta: { readonly '$id': string },
  build: (self: RefType<{ readonly '$id': string }>) => TBody
): TBody & { readonly '$id': string; readonly '~jt:source'?: TBody } {
  const placeholder = { '$ref': meta.$id } as RefType<{ readonly '$id': string }>;
  const body = build(placeholder);
  const assembled = Object.freeze({ ...meta, ...body });
  // backfill the placeholder so any consumer that grabs it via the closure
  // capture sees the assembled schema as its phantom source
  Object.defineProperty(placeholder, '~jt:source', {
    value: assembled, enumerable: true, writable: false, configurable: false
  });
  return assembled as never;
}
```

Two subtle points:

1. **Placeholder is shared.** Every `self` in the closure is the same frozen `{ $ref, ~jt:source }` object. Composition operators (`Compose.extend` etc.) preserve identity via spread, so the same `~jt:source` flows through all derived schemas.
2. **`~jt:source` is set after construction.** `Object.defineProperty` mutates the placeholder once. Callers never observe the unfilled state because `build` finishes before any consumer reads the schema.

### Mutual recursion

For cross-file or mutually recursive schemas a single closure is not enough. Use `lazyRef(() => Schema)` (kept from the previous addendum) - one explicit thunk for the rare case, while the common case uses `recursive`.

```ts
const Employee = recursive({ $id: 'urn:bookstore:Employee' }, (self) => ({
  type: 'object',
  properties: { id: { type: 'string' }, manager: lazyRef(() => Manager) }
} as const));

const Manager = recursive({ $id: 'urn:bookstore:Manager' }, (self) => ({
  type: 'object',
  properties: { id: { type: 'string' }, reports: { type: 'array', items: ref(Employee) } }
} as const));
```

### Updates to the design

- Replace the `Self` builder mentioned in earlier addenda with `recursive((self) => body)`.
- Keep `lazyRef(() => S)` only for genuine cross-file mutual recursion.
- Update the comparator table risk-3 row to reflect the new pattern.
- Add a "Recursive schemas" section to the doc landing page; example uses the bookstore manager-chain motif from `compile-time-constraints.test.ts`.
- Implementation phase 1 grows `recursive` by one file (`src/modules/compose/Recursive.ts`); phantom logic is a one-line `Object.defineProperty`.

### Done means (delta)

- A consumer can author a self-referential schema with `recursive((self) => ({ ..., manager: self }))` and `InferType` produces the recursive type with no manual annotation.
- Mutual recursion uses `lazyRef(() => OtherSchema)`; documented as the explicit-thunk path for the rare case.
- TypeBox-comparison block on the docs site shows the recursive case side-by-side and notes `recursive` matches TypeBox's ergonomics.
