# Plan: `$ref` Range Resolution + Branded Construction Migration

Status: Wave 0 (foundation) COMPLETE and validated. Wave 2 (construction
migration) in progress. Owner model: Opus plans/reviews, Sonnet implements.

## 0. Cross-cutting standards (apply to ALL waves)

1. **Dispatch maps over nested ternaries.** Multi-way type-level branching uses
   indexed-access on a map (`{ a: X; b: Y }[Tag]`), never a deep chain of
   nested `extends ? :`. A single binary guard inside a mapped projection is fine.
2. **No untyped anything except at genuine unknown-ingestion edges.** No
   `as any`, no masking `@ts-expect-error`, no `Record<string, unknown>` /
   `unknown` return types on schema-building helpers or fixtures. `unknown` /
   `Record<string, unknown>` are permitted ONLY where arbitrary external/invalid
   data enters a validation boundary (and there, prefer `satisfies` and assert
   on the result). Type test helpers to their real schema shapes with
   `as const` / generics so literal `$id`s are preserved.
3. **No type-assertion casts — `as X` / `as unknown as X` are forbidden.** A cast
   means the types are being used incorrectly; fix the type usage instead:
   - branded values come from the validation API (`jt.instantiate` / `coerce` /
     `materialize`), never from `'literal' as unknown as BrandedType`;
   - rdf/js term narrowing uses `termType` type-guards, not `as Quad`;
   - readonly→mutable needs a fresh built array (spread), not a cast;
   - external/parsed data (`JSON.parse`, dynamic `import`) is typed via a guard
     or validated, not asserted.
   Allowed: `as const` (a const assertion, not a cast) and `satisfies`. The only
   tolerated `as` is at a hard external interop boundary with no typed
   alternative, and it must be commented with why no typed path exists.
   Corollary: never re-add an explicit `undefined` argument that
   `unicorn/no-useless-undefined` strips — make the parameter optional or pass a
   real value so the call is correct without it.

## Wave 0 — DONE (foundation, in `src/types/Registry.ts` + `src/modules/composition/Compose.ts`)

- `SchemaReferencesMapType`, `SchemaMapFromTupleType`: mapped-over-union (O(1)
  depth in registry size; scale to large ontologies).
- Duplicate `$id` detection: **chunked fold** (`DuplicateIdsType` consumes 8
  elements/frame → depth ⌈N/8⌉, no TS2589), accumulating duplicates as a union;
  `UniqueSchemaIdsType` dispatches on the stringified `HasDuplicateIdsType` tag.
  Both `create({schemas})` (tuple) and chained `.set()` scale and stay precise
  at compile time. Validated: 53-schema bookstore registry type-checks; dedup
  still catches real duplicates (`test/types/registry-duplicate-ids.test.ts`).
- **Root cause fixed**: `Compose.equivalent` widened `$id`/`$ref` to `string`
  (its options param lacked a `const` type parameter), which poisoned both
  duplicate detection and `$ref` resolution. Now `const TOptions` + return type
  `{ '$id': TOptions['$id']; '$ref': TSource['$id']; … }` preserves literals.
- Result: `src` type-check 0, `type-check:tests` 0, bookstore registry clean,
  `$ref` ranges resolve to branded named-datatypes (e.g. `Book.title` → `Title`).

TODO (Wave 0 finalize): intelligible compile error for a tuple too large even
for chunked scanning, directing the author to chained `.set()` (backstop only —
chunking already handles realistic sizes). Must itself avoid nested ternaries.

## 1. Why

The project contract (CLAUDE.md): JSON Schema is authoring, the canonical
representation is a graph, and **domain/range are explicit graph relations**. A
property whose `$ref` points at a named datatype schema (e.g. `Book.title →
urn:bookstore:Title`) must, at the type level, resolve to that datatype's
inferred type (the branded `Title` primitive) — exactly as `authors → AuthorName`
and `customer.name → CustomerName` should. Today it resolves to `unknown`.

### Findings (measured, not assumed)

`tsc -p tsconfig.eslint.json` (the only config that covers examples + tests):

| State | Errors |
|-------|-------:|
| HEAD (no changes) | 657 |
| Original uncommitted work (13 files) | 618 |
| + Wave 0 scalability & ref-threading (this branch) | 504 |

Key discovery: **examples and tests are not type-checked by any gate.**
- `npm run type-check` is `tsconfig.json` → `src/**` only (src **is** clean: 0 errors).
- `npm run test:*` runs under `tsx`, which strips types (no compile-time check).
- `npm run lint` uses `tsconfig.eslint.json` only as eslint's *parser project*;
  eslint fails on rule violations, never on raw `tsc` errors. So the 2
  `restrict-template-expressions` errors in `composition/05-discriminated-union.ts`
  are the only gate-visible symptom of ~500 latent type errors.

Therefore this is **long-standing latent debt**, not a regression in the
uncommitted work (which is sound and src-clean). "Doing it right" means: make the
type machinery scale, resolve `$ref` ranges to their branded datatypes, migrate
the corpus to construct branded values through the validation API, and **add a
gate** so examples + tests stay type-clean.

### Root causes

1. **Reference maps don't scale.** Every helper in `src/types/Registry.ts`
   (`SchemaReferencesMapType`, `SchemaMapFromTupleType`, `HasDuplicateIdsType`,
   `DuplicateIdsType`, `UniqueSchemaIdsType`) is head/tail recursive — ~53 deep
   for the bookstore. Deferred as `JsonTology<TMap>`'s arg it stays lazy; forcing
   it (to resolve refs) trips TS2589.
2. **`$ref` ranges aren't resolved.** Exported types use single-arg `InferType`
   with no references map, so `InferRefType` (Infer.ts:742) falls to `unknown`.
3. **Brands are nominal by design** (ConstraintBrands.ts: "Plain primitives are
   not assignable to branded types... obtained only through the validation API").
   So resolving ranges to branded datatypes (correct) makes every hand-written
   literal (`{ title: 'Momo' }` as `Book`) fail — the corpus must construct
   through `jt.instantiate` / `coerce`.

## 2. Goal state

- `src/types/Registry.ts` helpers are non-recursive (mapped over the element
  union), scaling to large ontologies/registries without TS2589.
- `$ref` ranges resolve to branded named-datatype types via a threaded
  references map; resolution cost is bounded by ref-chain depth, not registry size.
- Bookstore exported types (`Book`, `Customer`, `Order`, `OrderLine`, `Review`,
  `Address`) and example/test consumers resolve ranges to branded primitives.
- All branded values are constructed via the validation API; no raw-literal
  assignment to branded types.
- A new gate type-checks examples + tests; CI runs it.
- `InferSchemaTypeCoreType`'s nested-conditional dispatcher is restructured.
- Green: `type-check`, `type-check:tests`, the new examples gate, `test:*`, `lint`.

## 3. Design

### 3.1 Scalable helpers — `src/types/Registry.ts` (Wave 0)

`SchemaReferencesMapType` and `SchemaMapFromTupleType` are **done and validated**
(line-159 registry TS2589 cleared; src stays at 0 errors; `Book.title` resolves
to the branded `Title`). Final forms:

```ts
// Raw-schema map: { [$id]: schema }. Single mapped type over the element union
// — O(1) instantiation depth in registry size. Used as InferType's TReferences.
export type SchemaReferencesMapType<T extends readonly unknown[]>
  = { [K in T[number] as K extends { readonly '$id': infer Id extends string } ? Id : never]: K };

// Pre-inferred output map: { [$id]: ParseOutputType<schema> }. Non-recursive;
// per-key inference stays lazy under indexed access (TMap[K]).
export type SchemaMapFromTupleType<
  T extends readonly unknown[],
  TRefs = SchemaReferencesMapType<T>
> = {
  [K in T[number] as K extends { readonly '$id': infer Id extends string } ? Id : never]:
    ParseOutputType<K, TRefs>
};
```

Remaining (not yet done): the duplicate-id helpers still recurse 53-deep and
make `create()` emit 2 TS2322 ("reduced to never") at the bookstore registry.
Rewrite them as mapped-over-index (depth O(1); the N×N comparison is *breadth*,
which TS tolerates — TS2589 is a depth ceiling):

```ts
/** Union of `$id`s appearing more than once (depth O(1); N×N breadth). */
export type DuplicateIdsType<T extends readonly { readonly '$id': string }[]>
  = {
      [I in keyof T]: T[I] extends { readonly '$id': infer Id extends string }
        ? { [J in keyof T]: J extends I ? never
              : T[J] extends { readonly '$id': Id } ? Id : never }[number]
        : never
    }[number];

type HasDuplicateIdsType<T extends readonly { readonly '$id': string }[]>
  = [DuplicateIdsType<T>] extends [never] ? false : true;
```

`UniqueSchemaIdsType` keeps its current shape but consumes the non-recursive
`HasDuplicateIdsType`/`DuplicateIdsType`. **Acceptance:** `tsc -p
tsconfig.json` = 0; the 2 bookstore-registry TS2322 at `index.ts(161/181)` gone;
a deliberate duplicate-`$id` tuple still brands `DuplicateSchemaIdInterface`
(add a `test/types` assertion).

### 3.2 Reference threading (Wave 1)

In `examples/docs/bookstore/index.ts` (done — keep):

```ts
type BookstoreRefs = SchemaReferencesMapType<typeof bookstoreSchemas>;
export type Book = InferType<typeof BookSchema, BookstoreRefs>;
// …Address, Customer, Order, OrderLine, Review identically
```

Add `export type BookstoreRefs = …;` (promote to public) so example/test sites
that build their own derived types thread the same map:
`InferType<typeof SomeSchema, BookstoreRefs>`.

**Acceptance:** the 6 exports' `$ref` properties resolve to branded primitives
(`Book['title']` ≡ `InferType<typeof TitleSchema>`); confirm with a `test/types`
assertion (`title` extends `string`, not `unknown`).

### 3.3 Branded-construction migration — pattern catalog (Wave 2)

Apply per file. The validation API returns branded `InferType`; raw literals do not.

**P1 — literal assigned to a branded entity type**
```ts
// before
const rare: Book = { title: 'Momo', isbn: '…', /* … */ };
// after — instantiate returns the branded Book
const rare = jt.instantiate('urn:bookstore:Book', { title: 'Momo', isbn: '…' });
```

**P2 — template/operation on a resolved branded property** (the 05 symptom)
```ts
// branded Title IS a string → template literal is legal once title resolves
const label = rare.printStatus === 'inPrint' ? `In print: ${rare.title}` : `Rare: ${rare.title}`;
// fix is upstream (rare obtained via instantiate); no cast needed.
```

**P3 — API call expecting a branded value, given raw input** (TS2345/2769)
```ts
// before: dump expects TMap[K] (branded)
jt.dumpJson('urn:bookstore:Book', rawBookLiteral);
// after: dump the instantiated value
jt.dumpJson('urn:bookstore:Book', jt.instantiate('urn:bookstore:Book', rawBookLiteral));
```

**P4 — test feeding intentionally-raw/invalid data** (validation/coercion tests)
Keep the input raw; annotate the *input* as the loose shape, assert on the
*result*. Use `satisfies` for shape-checking raw fixtures without demanding brands:
```ts
const input = { title: 'x' } satisfies Record<string, unknown>;
const errs = jt.validate('urn:bookstore:Book', input); // raw input is correct here
```
Do **not** cast away real failures; if a test genuinely needs a branded value,
get it from `instantiate`/`coerce`.

**P5 — `as Book` casts on raw data**
Replace with `instantiate`. Only when a test deliberately fabricates an invalid
value should it use `as unknown as Book`, with a comment stating why.

**P6 — `test/types` compile-time assertions**
Update expected types to the branded/resolved forms. These assertions are the
regression guard — make them assert the *new* correct types, never weakened.

Forbidden (per `feedback_no_shortcuts_proper_fix`): blanket `as any`,
`@ts-expect-error` to hide real errors, disabling brands, or excluding files.

### 3.4 New gate (Wave 3)

Add `npm run type-check:all` → `tsc --noEmit -p tsconfig.eslint.json` (covers
examples + tests). Wire into CI and the pre-push quality gate. This is what makes
the migration durable. Until Wave 2 reaches zero, the gate is added but allowed
to run informational; flip to blocking in the same PR that hits zero.

### 3.5 Dispatcher cleanup (Wave 4)

Restructure `InferSchemaTypeCoreType` (Infer.ts:903–931). Honest constraint
(already analysed): a type-level "dispatch map" separates handler bindings from
priority resolution but the ordered, multi-key priority cascade necessarily
moves into a `SchemaDispatchTagType<T>` resolver. Implement tag + indexed map
with a distribution-preserving wrapper:

```ts
type SchemaDispatchTagType<T> = /* ordered priority → 'const'|'enum'|'ref'|…|'allOfObject'|…|'primitive' */;
interface SchemaDispatchMapInterface<T, TRoot, TRefs> {
  ref: InferRefType<T, TRoot, TRefs>;
  allOfObject: InferAllOfType<T, TRoot, TRefs> & InferObjectType<T, TRoot, TRefs>;
  /* …one binding per tag… */
}
type InferSchemaTypeCoreType<T, TRoot = T, TRefs = Record<never, never>>
  = T extends unknown ? SchemaDispatchMapInterface<T, TRoot, TRefs>[SchemaDispatchTagType<T>] : never;
```
**Acceptance:** all 28 `test:types` pass unchanged; full suite unchanged; no new
`tsc` errors. Keep the `allOf + type:'object'` arm (load-bearing — proven).

## 4. Wave plan & dispatch (WELC: sprout-then-swap, partition by file ownership)

Review at every wave boundary: Opus runs the whole-tree checks before the next wave.

- **Wave 0 — shared core, 1 agent (sequential).** `src/types/Registry.ts` only.
  Finish §3.1 duplicate-id rewrite. Gate: `type-check` = 0; bookstore registry
  TS2322 gone; duplicate-detection `test/types` assertion added.
- **Wave 1 — shared core, 1 agent.** `examples/docs/bookstore/index.ts` only.
  §3.2. Gate: `test/types` range-resolution assertions pass.
- **Wave 2 — parallel, disjoint file sets.** Migrate construction (§3.3). Agents
  own non-overlapping files; no two agents touch the same file. Suggested split
  (504 errors / 169 files):
  - 2a `test/unit/*` group A (validation.test.ts, instantiate.test.ts) — ~124 errors
  - 2b `test/unit/*` group B (compose, graph, schemaEntryStore, registry, transform, errorHandling, owlImport*) — ~55
  - 2c `test/integration/*` + `test/e2e/*` + `test/smoke/*` — ~56
  - 2d `test/types/*` — ~63 (assertions → branded; coordinate w/ Wave 1 output)
  - 2e `examples/docs/{advanced,composition,validation,value}/*` — ~100
  - 2f `examples/docs/{getting-started,schemas,types,usage-examples,bookstore-domain,argument-conventions,picking-a-method,invariants,landing,serialization,benchmarks}/*` + `examples/*.ts` — ~104
  Shared fixtures (`examples/docs/bookstore/aboxFixtures.ts`, shared test utils)
  stay raw — do not rebrand them; consumers route through the API. If a shared
  fixture must change, lift it into a pre-step (single agent) before 2a–2f.
- **Wave 3 — 1 agent.** Add `type-check:all` gate + CI wiring (§3.4); flip to
  blocking once Wave 2 is at zero.
- **Wave 4 — 1 agent.** Dispatcher restructure (§3.5).

### Ready-to-use dispatch prompts

Each prompt is self-contained (subagents have no prior context). Use
`subagent_type: "typescript"`, `model: "sonnet"`. Worktree isolation only if
agents in the same wave might race; Wave 2 agents own disjoint files so no
worktree needed, but they must NOT run `git` index ops (a hook recreates
`.git/index.lock`; clear it inline if ever needed).

**Wave 0 prompt**
> Repo: /Users/studs/Workspace/json-tology. Edit ONLY `src/types/Registry.ts`.
> Rewrite `HasDuplicateIdsType` and `DuplicateIdsType` from head/tail recursion
> to mapped-over-tuple-index form (see plan §3.1) so they do not recurse ~53
> deep. `UniqueSchemaIdsType` keeps its shape but consumes the new helpers.
> Acceptance, all must hold: (1) `npm run type-check` → 0 errors. (2)
> `npx tsc --noEmit -p tsconfig.eslint.json` no longer reports errors at
> `examples/docs/bookstore/index.ts(161)` or `(181)`. (3) Add a `test/types`
> assertion that a tuple with a duplicated `$id` is branded
> `DuplicateSchemaIdInterface` and a unique tuple is not. Do not change runtime
> code or other files. Report before/after error counts from both tsc configs.

**Wave 1 prompt**
> Repo: /Users/studs/Workspace/json-tology. Edit ONLY
> `examples/docs/bookstore/index.ts`. The 6 entity type exports already thread
> `BookstoreRefs = SchemaReferencesMapType<typeof bookstoreSchemas>`. Promote
> `BookstoreRefs` to an exported type. Add a `test/types/bookstore-refs.test.ts`
> asserting `Book['title']` resolves to `InferType<typeof TitleSchema>` (i.e.
> extends `string`, is not `unknown`) and `Customer`/`Order` ref properties
> resolve to their datatypes. Acceptance: `npm run type-check` = 0;
> `npm run test:types` passes; the new assertions compile. Report the
> `tsconfig.eslint.json` error delta.

**Wave 2 prompt template** (instantiate per file group)
> Repo: /Users/studs/Workspace/json-tology. You own EXACTLY these files: <LIST>.
> Do not edit any file outside the list. Goal: eliminate all `tsc` errors in your
> files under `tsconfig.eslint.json`, which now come from `$ref` ranges resolving
> to branded datatypes (raw literals are no longer assignable to branded types).
> Apply the migration pattern catalog (paste §3.3 P1–P6). Construct branded
> values via `jt.instantiate(schemaId, data)` / `coerce`; keep intentionally-raw
> test inputs raw (annotate loosely / `satisfies`), asserting on results.
> FORBIDDEN: `as any`, `@ts-expect-error` to mask real errors, disabling brands,
> editing files outside your list, weakening assertions. Acceptance: `npx tsc
> --noEmit -p tsconfig.eslint.json` reports ZERO errors in your owned files; the
> behavior the file demonstrates/tests is unchanged; `tsx --test <your test
> files>` still passes. Report per-file before/after error counts.

**Wave 4 prompt**
> Repo: /Users/studs/Workspace/json-tology. Edit ONLY `src/types/Infer.ts`.
> Restructure `InferSchemaTypeCoreType` (lines ~903–931) into tag + indexed
> dispatch map (plan §3.5), preserving union distribution and the load-bearing
> `allOf + type:'object'` arm. Acceptance: `npm run type-check` = 0; `npm run
> test:types` = 28/28 unchanged; full `npm run test:all` unchanged; no new
> `tsconfig.eslint.json` errors. No behavior change — pure refactor.

## 5. Review checkpoints (Opus)

After each wave: read the diff (don't trust the summary), run the wave's gate
plus `npm run type-check` (src must stay 0) and the relevant `test:*`. A wave
that widened its blast radius beyond its file list is rejected. Final gate before
merge: `type-check`, `type-check:tests`, `type-check:all` (new), `test:all`,
`lint` — all green. Then a single squashed feature branch → PR to `develop`.

## 6. Risks

- **N×N breadth in duplicate detection** could be slow on very large registries;
  if compile time regresses materially, fall back to chunked detection. Validate
  on the 53-schema bookstore (worst case in-repo).
- **Deep ref chains / recursive schemas** ($ref to self) — `InferRefType` self/
  anchor branches already guard; confirm no new TS2589 (3 pre-existing TS2589 in
  `argument-conventions/02`, `benchmarks/serialize.bench`, `e2e/ontologyRoundTrip`
  must be driven to zero, not ignored).
- **Brand ergonomics**: if instantiate-everywhere proves too noisy in a given
  example whose point is authoring (not validation), prefer a `satisfies` raw
  input + a single `instantiate` for the typed handle — never a blanket cast.
- **Gate flip timing**: keep `type-check:all` informational until Wave 2 hits
  zero, then flip to blocking in the same change so CI never goes red on merge.
