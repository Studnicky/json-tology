# 0005 — Response & remediation plan for downstream friction (0004 + lazy-TMap)

**Status:** proposal
**Inputs:** `designs/0004-downstream-friction-points.md` (Torreya, 6 items) and
`docs/plans/lazy-tmap-and-brand-free-encode.md` (@shortslop/signal, 2 items).
**Method:** every claim was verified against current `src/` (file:line evidence
below), then judged against the project vision (`designs/0001-typed-ref.md`
"three first-class authoring paths" + registry-as-cache; `designs/0002` compile-time
enforcement; `CLAUDE.md` graph-native architecture).

Each item is classed:
- **SHIP** — accurate, aligned with the vision, a real gap → implement.
- **DONE** — already resolved.
- **SHIP-PLANNED** — real gap, but the vision's chosen answer differs from the
  consumer's proposal → implement the planned design (and document it).
- **DOCS** — the implementation is fine; the consumer worked around a feature
  they didn't know existed or that is intentionally shaped this way → clarify
  docs / API discoverability, do **not** change the contract.

## Guiding principle (locked)

json-tology is a **drop-in type system**: every consumer-facing surface yields a
**full, precise type at compile time**, and internally we always know the exact
type. From that, the hard rules every fix below obeys:

1. **No widening, no `unknown`, no `any`, no casts** — not in the library, not
   forced on the consumer. A fix that "loosens a signature so the cast goes
   away" is wrong; the right fix gives the **precise** type so no cast was ever
   needed. (Two items below — #6, #8 — were mis-described as "widening" in an
   earlier draft; they are restated here as **type-preserving / type-correcting**.)
2. **Never fall back to `unknown`.** Where inference can't resolve a reference
   today and silently yields `unknown`, the target is a **typed error brand**
   (e.g. `RefNotFound<'urn:…'>`) that fails the build — not a silent `unknown`
   the consumer then casts away. A missing/mis-spelled `$ref` is a compile error.
3. **Strict graph is the preferred default; the permissive path must also work.**
   Fixes must not weaken strict-graph guarantees to serve the permissive path;
   they make the permissive path *also* correct.
4. **The consumer should use types correctly** — the library's job is to make the
   correct type the easy/only path, never to accept a loose one.
5. **One way to do things — no parallel/back-compat mechanisms.** We do not add a
   second mechanism to prop up an older usage, and we do not ship migration
   tooling (no codemod). There is one canonical way per capability; consumers
   update their own code. (This retires the `GlobalSchemaRegistry` suggestion.)
6. **Native JSON Schema is the authoring language.** We work *with* native `$ref`
   / `$defs` and make them type-infer correctly; we do **not** force consumers to
   rewrite native JSON Schema into a library-specific builder. A fix that requires
   replacing `{ $ref: X.$id }` with a proprietary call is the wrong fix — the
   right fix makes the native form precise.

## Summary

| # | Item | Verified | Class | Effort | Headline |
|---|------|----------|-------|--------|----------|
| 1 | Cross-file `$ref` → `unknown` | TRUE | **DONE** | M | `RefNotFound` brand replaces the `unknown` fallback (self-`$id` refs still resolve); `SchemaReferencesMapType` / `InferType<X, Refs>` thread the schema set |
| 2 | Structural-hash collides distinct primitives | TRUE; transforms not in hash | SHIP (refined) + DOCS | M | Nominal-subclass-aware dedup; format-marker is the documented escape today |
| 3 | CURIE `$id` broken | WAS TRUE | **DONE** | — | Fixed on `feature/curie-canonicalization` |
| 4 | `materialize` skips Transforms | TRUE | DOCS (+ opt. flag) | S | `instantiate` IS the wire-decode tool; document the split |
| 5 | Interfaces not in root barrel | TRUE (by design) | DOCS (+ open Q) | S | `json-tology/interfaces` is the intended import; root export is forbidden |
| 6 | `getDecoder` param type-erasing | TRUE (interface lacks index sig) | **DONE** | XS | Param → precise `JsonSchemaDocumentObjectType`; accepts branded schemas cast-free |
| 7 | Eager `TMap` → TS2589 on `.d.ts` emit | TRUE | **DONE** | L | `JsonTology<TRefs>`; per-call `ParseOutputType<TRefs[K], TRefs>`; loose overloads deleted; declaration-emit regression test added (designs/0006) |
| 8 | `addTransform` `encode` typed with wrong face | TRUE | **DONE** | XS | `encode` returns the precise InputType; deletes both internal `as unknown` casts |

Net: the two genuine type-architecture items (#1 `RefNotFound`, #7 lazy `TRefs` +
precise method surface) are **DONE** (designs/0006) alongside the already-shipped
#3/#6/#8; #2 ships nominal-aware dedup; #4/#5 remain DOCS.

---

## 1 — Cross-file `$ref` → `unknown`  ·  SHIP-PLANNED + DOCS

**Verified.** `InferSchemaType<T, TRoot = T, TReferences = Record<never, never>>`
(`src/types/Infer.ts:993`). With the default empty references map, a bare
`{ $ref: 'urn:Other' }` outside `TRoot` resolves to `unknown`
(`Infer.ts:748`). `SchemaMapFromTupleType`/`SchemaReferencesMapType`
(`src/types/Registry.ts:37`) only thread references when a registry tuple is in
scope. **`ref()` / `RefType` / `~jt:source` do NOT exist yet** — design 0001
Path C is unimplemented (only a comment at `Infer.ts:358` references it). No
`GlobalSchemaRegistry` exists, but module augmentation is already an in-repo
pattern: `JsonTologyTypeConfigInterface` (`Infer.ts:1006`).

**Judgement.** The friction is real, but the fix stays **native JSON Schema** —
`{ $ref: 'urn:…' }` / `{ $ref: X.$id }` is the canonical authoring form and we do
**not** force consumers onto a non-native `ref(X)` builder (nor a
`GlobalSchemaRegistry` shim). Native cross-file inference already has two working,
pure-JSON-Schema paths:

- **A — `$defs` + `#/$defs/X`** (single-file, self-contained): full inference
  today, no tuple, no helper.
- **B — bare-`$ref` IRIs + the registered schema set**: `SchemaMapFromTupleType` /
  `SchemaReferencesMapType<typeof SCHEMAS>` thread the references; full inference
  today.

The `unknown` Torreya hit is the *standalone* `InferSchemaType<typeof X>` in a
file that does not thread the schema set — and a bare string IRI genuinely cannot
carry a type on its own. The native answer is to thread the schema set (B), which
is exactly what their `ProtocolMap` already does; that pattern is **correct**,
just under-documented and not blessed as a first-class helper. So the gap is
(a) the silent `unknown` fallback (a strictness bug) and (b) the
ergonomics/discoverability of the native references derivation — **not** a missing
builder.

**Plan.**
- [ ] **Replace the `unknown` fallback with a `RefNotFound<'urn:…'>` compile
      error** (design 0002 Finding 15). A bare-`$ref` that can't be resolved
      through the threaded schema set fails the build — never silent `unknown`.
      This forces the native fix (include the target in the schema set, or
      self-contain via `$defs`) and is the load-bearing strictness change
      (`Infer.ts:748`'s `: unknown` arm becomes the brand). Works entirely on
      native `$ref`; no builder involved.
- [ ] **Bless the native cross-file derivation as a first-class, exported,
      documented helper** so standalone files stop hand-rolling `ProtocolMap`:
      export `SchemaMapFromTupleType<typeof SCHEMAS>` (a `$id → inferred type`
      map, references threaded internally) from `json-tology/types`, plus an
      `InferType<typeof X, typeof SCHEMAS>` reference-threading form. Pure JSON
      Schema in, precise types out, no builder, no shim.
- [ ] DOCS: native authoring paths (A `$defs`, B bare-`$ref` + schema set) are THE
      documented ways for cross-file refs; show the one-line native derivation.

No `ref()` migration, no `GlobalSchemaRegistry`, no codemod — consumers keep
native `{ $ref: X.$id }` and update their own derivation sites to the blessed
helper.

**Decision (ruled): `ref()` is dropped.** Design 0001's Path C (the `ref()`
builder + `~jt:source` phantom) is retired — it is a non-native, library-specific
authoring form that rules 5–6 forbid. The only cross-file mechanisms are native
JSON Schema: `$defs` (A) and bare-`$ref` + the registered schema set (B). Nothing
in #1 ships a builder; design 0001 should be marked superseded for Path C.

**Enables/corrects:** an unresolved `$ref` becomes a compile error instead of a
silent `unknown`; the consumer's `ProtocolMap` becomes a one-line library helper
over the native schema set; native JSON Schema authoring is untouched.

---

## 2 — Per-primitive `format: 'tor-<kind>'` to defeat hash collision  ·  SHIP (refined) + DOCS

**Verified.** `StructuralHash.of` strips `$id`/`title`/`description`/`$comment`/
`examples` (`src/constants/STRUCTURAL_HASH.ts`, `src/modules/data/StructuralHash.ts:12`)
then `Hash.value`. Attached Transforms live in a separate WeakMap
(`Transform.ts:43`) and are **not** in the hash. So two `Compose.subClassOf(
StringValue, {$id, type:'string'})` primitives with no distinguishing constraint
hash-collide and trip `SCHEMA_DUPLICATE_SHAPE` under strict graph mode.

**Judgement.** Partly a real refinement, partly a misframing. Strict-graph
duplicate detection is *intentional* drift-detection (`CLAUDE.md`); for a
**nominal primitive library** (many named string subtypes) it is over-eager —
the consumer genuinely wants `IriString` and `Slug` to be distinct nominal
classes even though both erase to "a string." The consumer's transform-identity
proposal only helps transform-bearing primitives; the deeper issue is
nominal-vs-structural identity for `subClassOf`-derived schemas.

**Plan (prefer the more general fix over transform-identity alone).**
- [ ] Make duplicate detection **nominal-aware**: a schema that is an explicit
      subclass (carries `allOf:[{$ref:Parent}]` / a `~jt:subClassOf` brand) with
      its own `$id` is an intentional named class, not a structural dup of its
      parent or of sibling subclasses. Exclude these from `SCHEMA_DUPLICATE_SHAPE`
      (still flag *two literally-identical inline anonymous shapes*, the real drift).
- [ ] (Smaller, complementary) include transform-identity in the hash as the
      consumer proposed — cheap, strictly more permissive.
- [ ] DOCS: document the existing escape hatches (`enableDuplicateDetection:false`,
      `enableStrictGraph:false`) and that `format` is the standard JSON-Schema
      semantic-typing keyword — so format-marking is a *choice*, not a forced hack.

**Enables/corrects:** drops the mandatory `format:'tor-<kind>'` marker on
primitives that don't otherwise need it; keeps real drift detection intact.

---

## 3 — CURIE `$id` doesn't work  ·  DONE

**Resolved this cycle** on `feature/curie-canonicalization` (commit `e27d66b`):
`registerSingle` normalizes `$id` to its canonical absolute IRI; all read paths
resolve CURIEs; `lookupSchema`/`sameAs`/computed expand too. The exact
reproduction in 0004 §3 now works. Covered by `test/unit/curieRegistration.test.ts`.
- [ ] Close 0004 §3 as shipped; note it in the consumer's upgrade.

---

## 4 — `materialize` doesn't run Transforms  ·  DOCS (+ optional flag)

**Verified.** `instantiate` runs `RefDecoder.run` then
`decodeWithTransform → Transform.getDecoder(schema).decode`
(`SchemaRegistry.ts:1056–1057, 870`). `materialize` (`Materializer.ts:324–349`)
fills defaults + validates and does **not** run transforms.

**Judgement.** Largely a **misunderstanding of the intended tool**. `instantiate`
*is* the "decode wire data into the runtime shape" API — validate + resolve
refs + run decoders — which is exactly the wire-decoder contract. `materialize`
is deliberately the "scaffold defaults, no decode" tool (fixtures, forms). The
consumer's instinct to start on `materialize` was the wrong tool; switching to
`instantiate` (which they did) is **correct usage**, not a workaround. The
real residue is naming/mental-model ("instantiate = trust boundary") and the
`wireData as unknown` cast.

**Plan.**
- [ ] DOCS: a decision table — *decode wire/untrusted data* → `instantiate`;
      *fill defaults on data you produced, no transforms* → `materialize`. State
      plainly that `instantiate` runs transforms and is the wire-decode entry.
- [ ] Investigate the `wireData as unknown` cast: `instantiate(schema, data)`'s
      `data` is already `unknown` — if a real input-typing gap exists on the
      schema-object overload, fix that (small); if it's a consumer habit, the
      doc removes it.
- [ ] OPTIONAL (only if demand): additive `materialize(schema, partial,
      { runTransforms?: boolean })` for the niche "defaults **and** decode" combo.
      Default `false`, pure-additive. Not required to unblock the consumer.

**Enables/corrects:** consumers stop misclassifying wire decoders; removes the
`as unknown` cast; no contract change.

---

## 5 — Interfaces not in the main barrel  ·  DOCS (+ one open design question)

**Verified.** `src/index.ts` exports no interface contracts; its own comment
(index.ts §"Runtime classes only") states interface contracts live behind
`json-tology/interfaces` and that root export "is forbidden — it forces
consumers' bundlers to pull the entire type graph … and invites circular
import cycles." (A stray root re-export of the Compose interfaces was *removed*
this cycle for exactly this reason.)

**Judgement.** This is a **misunderstanding**: `import type { SubClassOfSchemaInterface }
from 'json-tology/interfaces'` is the **intended, correct** import — not a
workaround. The architecture deliberately keeps interface contracts off the root
entry. **Do not** add the root export the consumer asks for; it re-introduces the
exact leak just removed.

One legitimate open question worth a decision (not a blocker): the
"forbidden" rationale (bundler pull, circular imports) is about *value/namespace*
re-exports. A **type-only** `export type * from './interfaces/index.js'` is
erased at compile time — zero runtime cost, no bundler graph pull, no runtime
cycle. If the only goal is letting `import type { X } from 'json-tology'` work,
a type-only root re-export may be defensible. This needs an explicit ruling
rather than a silent change.

**Plan.**
- [ ] DOCS: a "Package exports map" page — what lives behind `.`, `./types`,
      `./interfaces`, `./value`, `./ontology`, `./viz` — and that interface
      contracts are *intentionally* on the subpath. Add to the README import
      examples.
- [ ] DECISION: ratify or reject a type-only root re-export of interfaces.
      Default recommendation: **keep the subpath** (consistent with the stated
      architecture); document loudly instead.

**Enables/corrects:** the consumer's "workaround" was already correct; this is a
discoverability fix.

---

## 6 — `Transform.getDecoder` parameter is type-erasing  ·  SHIP (XS)

**Verified.** `static getDecoder(schema: Record<string, unknown>)`
(`Transform.ts:155`). A branded Compose **interface** (e.g.
`SubClassOfSchemaInterface`) has no index signature, so TS rejects it against
`Record<string, unknown>` ("index signature missing"), forcing the consumer's
`as unknown as Record<string, unknown>` cast — the exact widening cast we forbid.

**Implemented (Tier 1).** Parameter changed from `Record<string, unknown>` to the
**precise canonical schema type `JsonSchemaDocumentObjectType`** — the same type
`Transform.create`/`chain` use, i.e. exactly what `getDecoder` expects (a JSON
Schema object), not `object` and not `Record<string, unknown>`:

```ts
static getDecoder(schema: JsonSchemaDocumentObjectType): TransformFnsInterface | undefined;
```

`JsonSchemaDocumentObjectType` accepts **both** the branded consumer `Compose.*`
schemas (which satisfy the canonical schema type — they're passed to
`Transform.create` the same way) **and** every internal caller, with **zero
casts** anywhere. (`JsonSchemaDocumentObjectType` is all-optional, so the internal
runtime representations satisfy it structurally; verified by `tsc`.) No `object`,
no `unknown`/`any`, no widening — the signature states precisely what it takes.

**Done:**
- [x] `getDecoder(schema: JsonSchemaDocumentObjectType)`; deleted the consumer's
      `as unknown as Record<string, unknown>` cast **and** an identical internal
      cast at `JsonTology.encode`'s call site. New `Transform.register(schema:
      JsonSchemaDocumentObjectType, fns)` is the single typed storage boundary.
- [ ] (Stretch, deferred) carry the schema's decode/encode types in the return so
      the returned decoder is itself precisely typed rather than the erased
      `TransformFnsInterface`.

**Enables/corrects:** deletes the consumer's `as unknown as …` cast; zero
`unknown`/`any`/widening.

---

## 7 — Eager `TMap` trips TS2589 on declaration emit  ·  DONE (designs/0006)

> Shipped. `JsonTology<TRefs>` is the single generic; `create` returns
> `JsonTology<SchemaReferencesMapType<TSchemas>>` and every typed method computes
> its output lazily as `ParseOutputType<TRefs[K], TRefs>` — identical precision to
> the former eager `TMap`, O(1) to construct. The loose `(schema: Record<string,
> unknown> & {$id}) → unknown | boolean` fallback overloads are deleted; each
> method has two precise overloads (id + object), both `TRefs`-threaded. The
> declaration-emit regression test (`test/types/declaration-emit/`, `npm run
> test:decl`) emits a deep/wide registry's `.d.ts` without TS2589, and parity
> tests confirm string-id `instantiate`/`materialize` still return the branded
> type. Full implementation and the refining decisions are in
> **`designs/0006-precise-method-surface.md`**.


**Verified.** `class JsonTology<TMap = Record<never,never>, TRefs = Record<never,never>>`
(`JsonTology.ts:251`); `create` returns
`JsonTology<SchemaMapFromTupleType<TSchemas>, SchemaReferencesMapType<TSchemas>>`
(`:340`). `SchemaMapFromTupleType` eagerly resolves `ParseOutputType` for **every**
schema; string-id overloads key off `TMap[K]` (`:1259, :1288`). A deep root
exported via `create()` must materialize all branded outputs into the `.d.ts`,
exceeding TS's instantiation ceiling under `declaration:true`/`tsc -b`.

**Judgement.** Real, well-argued, vision-aligned (the registry must scale).
`SchemaMapFromTupleType[K]` is *defined as* `ParseOutputType<TRefs[K], TRefs>`,
so dropping the eager map and computing per-call is the **same result, lazy
timing** — strictly better for declaration emit.

**Plan.**
- [ ] Collapse the class to `JsonTology<TRefs>`; key the string-id overloads on
      `keyof TRefs` and return `ParseOutputType<TRefs[K], TRefs>` per call;
      `create` returns `JsonTology<SchemaReferencesMapType<TSchemas>>`.
- [ ] Migration note: consumers who wrote `JsonTology<SomeMap>` explicitly must
      drop to the single param. Rare; call it out in the changelog (0.x → minor
      per the project's `0.x breaking→minor` rule).
- [ ] Add the declaration-emit regression test the plan specifies (deep root,
      ~20 siblings, `declaration:true`, must emit without TS2589) + parity tests
      that string-id `instantiate`/`materialize` still return the branded type.

**Enables/corrects:** removes the consumer's schema-erasure +
`as JsonTology<…>` + hand-written type-map + dead `WIRE_REF_SCHEMAS` tuple.

---

## 8 — `addTransform`'s `encode` is typed with the wrong side of the schema  ·  SHIP (XS)

**Verified.** The public overload types `encode: (output) =>
InferSchemaType<TSchema, TSchema, TRefs>` (the **branded output** type), but the
impl immediately does `fns as unknown as { … encode: (output) =>
LooseInputType<InferSchemaType<TSchema>> }` (`JsonTology.ts:918–928`).
`LooseInputType` already exists (`Infer.ts:1766`).

**This is type-correcting, not widening — it removes a cast by stating the
precise type.** A schema has **two** precise compile-time faces:
- **OutputType** — branded, post-validation (`string & MinLength<1>`). What
  `instantiate` *returns* and what `decode` *receives*.
- **InputType** — the brand-free wire shape (`string`) you may *pass in* and that
  the serializer re-validates. What `encode` *produces*.

`encode` runs on the way **out** to the wire; brands are validation artifacts and
do not exist on raw wire data, so a branded `encode` return is **unsatisfiable**
— which is exactly why the body casts with `as unknown` and why a consumer must
cast too. Typing `encode` as the schema's **InputType** (`LooseInputType<…>`) is
the *accurate, fully-known* type — not a loosening of `unknown`; it is the
correct one of the schema's two precise types. `decode` consumes the **InputType**
too: it receives raw wire data (pre-decode), so a branded `InferSchemaType` input
both contradicts the brand-free wire *and* degrades to `RefNotFound` for transforms
attached to composed / `$ref`-bearing schemas (`Transform.create` is static — there
is no references map to resolve the ref). The decoded runtime shape is `decode`'s
**return** (`TOut`), not its input.

> Strictness note: `LooseInputType<T>` is a fully-computed, known type — never
> `unknown`/`any`. "encode returns the InputType; decode consumes the InputType
> and returns the decoded `TOut`" is the two-sided model — both halves of the wire
> boundary speak the InputType — expressed with the **canonical** types directly.

**Implemented (Tier 1).** `addTransform`'s public `encode` is now
`(output: TOut) => LooseInputType<InferSchemaType<TSchema, TSchema, TRefs>>`
(`Transform.create` already had this). Both `as unknown as` double-casts in the
body were removed: storage goes through a new single-boundary primitive
`Transform.register(schema: object, fns: TransformFnsInterface)` (one sanctioned
type-erasure cast, identical to what `create` does) and the return uses the
`brand<>()` helper instead of `schema as unknown as …`.

**No `InputType`/`OutputType` alias helpers were added** — `CLAUDE.md` forbids
re-aliasing canonical types (`type OutputType<T> = InferSchemaType<T>` is a pure
rename). The canonical types (`InferSchemaType<…>` for output,
`LooseInputType<InferSchemaType<…>>` for input) are used directly.

**Done:**
- [x] `Transform.create` `encode` → `LooseInputType<InferSchemaType<…>>` (the wire
      InputType) and `decode` input → the same wire InputType (refined under
      designs/0006 so transforms on composed/`$ref` schemas type cleanly); both
      `as unknown as` casts deleted via `Transform.register` + `brand<>()`.

**Enables/corrects:** removes the consumer's wrapper cast **and** the two
internal `as unknown` casts; public and internal types agree on the accurate
type for each direction.

---

## Prioritized implementation checklist

**Tier 1 — one-liners that also delete casts (DONE):**
- [x] #8 `encode` → `LooseInputType` (+ both internal `as unknown` casts deleted
      via `Transform.register` + `brand`). Type test: `test/types/transform-precise-types.test.ts`.
- [x] #6 `getDecoder(schema: JsonSchemaDocumentObjectType)` — the precise schema
      type (accepts branded schemas cast-free; deletes the consumer cast and an
      internal one). Same type test.

**Tier 2 — high-leverage type architecture (DONE — designs/0006):**
- [x] #1 `RefNotFound` error brand replaces the `unknown` fallback (native `$ref`,
      `Infer.ts` bare-IRI arm; root self-`$id` refs still resolve). Native
      schema-set derivation (`SchemaReferencesMapType`, `InferType<X, Refs>`) is
      exported. No builder, no shim, no codemod. (`ref()` / design 0001 Path C:
      dropped.)
- [x] #7 lazy `TRefs` (`JsonTology<TRefs>`), loose overloads deleted, every typed
      method precise + `TRefs`-threaded, declaration-emit regression test added.

**Tier 3 — graph-semantics refinement:**
- [ ] #2 nominal-subclass-aware duplicate detection (+ optional transform-identity in hash).

**Docs / clarity track (the "implementer didn't know the lib" set):**
- [ ] Authoring-paths page (A/B/C) — closes the root of #1's workaround.
- [ ] `materialize` vs `instantiate` decision table — closes #4.
- [ ] Package-exports map + "interfaces live on the subpath, by design" — closes #5.
- [ ] Strict-graph duplicate-detection guide (escape hatches, `format` as a choice) — supports #2.
- [ ] DECISION ticket: allow type-only root re-export of interfaces? (default: no).

**Already shipped:**
- [x] #3 CURIE `$id` normalization (`feature/curie-canonicalization`).

## Compatibility note

No fix introduces `unknown`/`any`/widening/casts — each replaces a loose state
with a **precise** one:
- #6, #8 are **type-preserving / type-correcting**: they replace erased or wrong
  types with the caller's exact type, deleting consumer **and** internal casts.
- #1's `RefNotFound` brand turns a silent `unknown` into a **compile error** —
  strictly stricter. `ref()`/`GlobalSchemaRegistry` are additive (default
  unchanged).
- #2 keeps strict-graph drift detection; it only stops flagging *intentional
  nominal subclasses*, so the strict path stays strict and the permissive path
  also works.
- #7 keeps every return type precise (`ParseOutputType` per call) and only
  changes *when* it's computed; the one narrow breaking surface is the
  `JsonTology` generic arity (`<TMap, TRefs>` → `<TRefs>`) — gate behind a minor
  per the 0.x policy with a one-line migration.

No item asks the consumer to keep a workaround, and none trades type precision
for ergonomics — the precise type *is* the ergonomic path.
