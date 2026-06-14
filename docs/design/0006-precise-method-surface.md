# 0006 — Precise method surface (eliminate `unknown` overloads)

**Status:** implemented.
**Parent:** `docs/design/0005` §7 (this is the proper-architecture expansion of "lazy `TMap`").
**Branch:** `feature/transform-precise-types` (off `develop`), continues the in-flight #7 work.

## Shipped design

Every typed public method on `JsonTology` yields a precise type — for a registered
`$id` or a schema object — or a `RefNotFound` compile error. No `unknown` in the
public contract, no loose `(schema: Record<string, unknown> & {$id}) → unknown |
boolean` overload. Gates: `npm run type-check:all` (lib + examples + tests +
`test:decl`) clean; `npm run test:all` green (2542 tests); `npx eslint .` clean.

The implementation took the plan's **blessed two-precise-overloads** path rather
than the `ResolveOutput.ts` conditional-return helpers — it mirrors the existing
precise `instantiate`/`dump`/`fromQuads` overloads (≡ consistency), adds no new
conditional-type depth that could re-trip TS2589 on `.d.ts` emit, and avoids the
re-aliasing of canonical types that `CLAUDE.md` / docs/design/0005 §8 forbid. Each
method has an id overload (`keyof TRefs & string` → `ParseOutputType<TRefs[K],
TRefs>`) and an object overload (`<TSchema …>` → `…<TSchema, TRefs>`); the loose
overload is deleted.

Decisions that refined the original plan:
- **Root self-`$id` `$ref` resolves to the root** (`Infer.ts` bare-IRI arm), the
  same parity the fragment-ref path (`ResolveRefBaseSchemaType`) already had —
  fixes self-referential schemas (e.g. FOAF `Person.knows`) without a references
  map. External (non-self, non-mapped) refs still yield `RefNotFound`.
- **Input params stay loose at the trust boundary.** `toQuads(schema, data:
  unknown)` (`projectAbox` validates internally, like `instantiate`);
  `materialize(schema, partial?: Partial<LooseInputType<InferSchemaType<…>>>)`
  (brand-free seed input — a branded partial is unsatisfiable for plain literals;
  accepts both object partials and scalar seeds for primitive/transform schemas).
  Outputs stay precise/branded.
- **`dump`/`encode` return the wire `InputType`** (`LooseInputType<…>`),
  consistent with docs/design/0005 §8 — never `unknown`.
- **`Transform.create` `decode` input is the wire `InputType`** too (refines §8 —
  see §8 update), so transforms attached to composed/`$ref`-bearing schemas type
  cleanly instead of degrading to `RefNotFound`.
- **Declaration-emit regression test shipped**: `test/types/declaration-emit/
  deep-registry.ts` (deep + wide registry, exported instance and `Root` type) +
  `tsconfig.decl-emit.json` + `npm run test:decl` (must emit without TS2589, wired
  into `type-check:all`), plus `test/types/declaration-emit-parity.test.ts`
  (string-id `instantiate`/`materialize` return the precise branded type).

The rest of this document is the original plan, retained for the touch-point map.

## Goal

Every typed public method on `JsonTology` yields a **precise** compile-time type
— for a registered `$id` *or* a schema object — or a `RefNotFound` compile error.
There is **no `unknown` in the public contract** and **no loose
`(schema: Record<string, unknown> & {$id}) → unknown` fallback overload**. One way
in, one precise way out.

This obsoletes the per-overload `TRefs`-threading patching: example
`examples/docs/registry/16-materialize-customer-defaults.ts` (`customer.addresses`
is `unknown`) resolves as a *consequence* — with no loose overload to fall to,
`materialize(CustomerSchema, …)` must infer precisely or be a compile error.

## Locked principle (from docs/design/0005 "Guiding principle")

No `unknown`/`any`/widening/casts in the public surface (lib or consumer); never
fall back to `unknown`; strict-graph preferred, native JSON Schema is the
authoring language; **one way per capability — no overload soup, no escape
hatches.** A loosely-typed schema (not `as const`) is a caller error to fix at the
source, not an `unknown` to absorb.

---

## What is already done (do not redo)

- **#1 (docs/design/0005 §1)** — `src/types/Infer.ts` `InferRefType`: the unresolved
  cross-schema `$ref` arm (~line 753) yields `RefNotFoundInterface<TRef>`
  unconditionally (no `: unknown` fallback). Committed conceptually; lives in the
  working tree. `SchemaMapFromTupleType` / `SchemaReferencesMapType` are exported
  from `json-tology/types`.
- **#7 partial** — `src/JsonTology.ts`:
  - Class collapsed to `export class JsonTology<TRefs = Record<never, never>>`
    (`~line 257`); `TMap` removed.
  - `create()` returns `JsonTology<SchemaReferencesMapType<TSchemas>>` (`~346`).
  - String-id overloads key off `keyof TRefs & string` and return
    `ParseOutputType<TRefs[K], TRefs>`.
  - `instantiate` object overload threads `TRefs`
    (`ParseOutputType<TSchema, TRefs>`, `~1268`).
  - `materialize` object overload threads `TRefs`
    (`MaterializedSchemaType<TSchema, TSchema, TRefs>`, `~1325`).
  - `addComputed` augments the schema's `TRefs` entry with
    `ComputedExtensionBrandInterface<…>` (phantom brand, key `~jt:computedFields`,
    `src/interfaces/ComputedExtension.ts`); `ParseOutputType` reads it
    (`src/types/Transform.ts:29`).
- **Still broken / open** (this plan): the loose `unknown` overloads remain
  (`is`, `materialize`, `dump`); `dump` returns `unknown`; `encode` doesn't thread
  `TRefs`; the **declaration-emit regression test is missing**; example 16 fails
  eslint (`no-unsafe-member-access`).

---

## Core mechanism — conditional-return helpers (the "no overloads" shape)

Add to `src/types/` (one file, e.g. `src/types/ResolveOutput.ts`; export from
`src/types/index.ts`). These map a `ref` that is **either** a registered `$id`
**or** a schema object to the precise output, so each method becomes a **single
generic signature**, not an overload set:

```ts
import type { JsonSchemaDocumentType } from './Schema.js';
import type { ParseOutputType } from './Transform.js';
import type { InferSchemaType, LooseInputType, MaterializedSchemaType } from './Infer.js';

/** Decoded, branded OUTPUT for instantiate/is — `$id` resolves via TRefs, schema object resolves directly. */
export type ResolveOutputType<TRef, TRefs>
  = TRef extends keyof TRefs & string ? ParseOutputType<TRefs[TRef], TRefs>
  : TRef extends JsonSchemaDocumentType & { readonly '$id': string } ? ParseOutputType<TRef, TRefs>
  : never;   // never `unknown` — a non-id, non-schema arg is a compile error

/** Defaults-synthesised OUTPUT for materialize (no transforms). */
export type ResolveMaterializedType<TRef, TRefs>
  = TRef extends keyof TRefs & string ? MaterializedSchemaType<TRefs[TRef], TRefs[TRef], TRefs>
  : TRef extends JsonSchemaDocumentType & { readonly '$id': string } ? MaterializedSchemaType<TRef, TRef, TRefs>
  : never;

/** Brand-free wire INPUT for dump/encode (the InputType of docs/design/0005 §8). */
export type ResolveInputType<TRef, TRefs>
  = LooseInputType<ResolveOutputType<TRef, TRefs>>;
```

`SchemaRefType<TRefs>` (the existing impl-signature param type) stays as the
**runtime implementation signature's** parameter; the conditional helpers are the
**public** return mapping. `never` (not `unknown`) is the unreachable arm, so a
bad argument is a type error.

> Note: if a single generic signature with a conditional return proves to bind
> inference worse than two precise overloads (id-overload + object-overload — both
> precise, both threading `TRefs`, **no loose `unknown` overload**), that two-precise-
> overload form is an acceptable fallback. The non-negotiable is: **delete the
> `unknown`/`boolean`-degraded loose overload; both remaining forms are precise.**

---

## Method-by-method touch points (`src/JsonTology.ts`)

For each: delete the loose `(schema: Record<string, unknown> & {$id}, …) → unknown|boolean`
overload; make the surviving public form(s) precise + `TRefs`-threaded. Line
numbers are approximate (re-inventory on resume with
`grep -nE "^  public (instantiate|materialize|is|validate|dump|dumpJson|encode|toQuads|subschemaAt|fromQuads)" src/JsonTology.ts`).

| Method | Current (problem) | Target |
|---|---|---|
| `instantiate` (~1262–1289) | id + object overloads already precise+threaded; impl sig `(SchemaRefType): unknown` (internal). | Optionally collapse id+object to one `ResolveOutputType` signature. Impl `unknown` is internal (acceptable) — confirm no public `unknown` overload. **Reference shape.** |
| `is` (~1291–1293) | **loose** `is(schema: Record<string, unknown> & {$id}, data): boolean` (1292) degrades the type guard. | Delete the loose overload. Object form is a **precise type guard**: `is<T …>(ref: T, data): data is ResolveOutputType<T, TRefs>`. |
| `materialize` (~1321–1335) | **loose** `materialize(schema: Record<string, unknown> & {$id}, …): unknown` (1326–1330); **no string-id form**. | Delete loose overload. Add string-id + object via `ResolveMaterializedType<T, TRefs>`; `partial?: Partial<ResolveMaterializedType<T, TRefs>>`. Fixes example 16. |
| `dump` (~1022–1032) | **both** overloads return `unknown`. | Return the wire `ResolveInputType<T, TRefs>` (docs/design/0005 §8 InputType); `value` param typed `ResolveOutputType<T, TRefs>`. |
| `dumpJson` (~1055–1065) | returns `string` (OK); `value` keyed off `ParseOutputType`. | Keep `string` return; unify id+object value param via `ResolveOutputType`. No loose overload. |
| `encode` (~1086–1098) | single object form, `InferSchemaType<TSchema>` (no `TRefs`); returns branded (should be input). | Thread `TRefs`; return `ResolveInputType<TSchema, TRefs>` (consistent with §8). Internal `getDecoder` call already precise. |
| `validate` (~1652–1654) | **loose** `validate(schema: Record<string, unknown> & {$id}, data): ValidationErrors` (1653). | Delete loose; object form `validate<T …>(ref: T, data): ValidationErrors` (return is errors, no schema-derived type, but no loose-Record overload). |
| `toQuads` (~1557) | object form, returns `QuadInterface[]`. | `value`/`data` param threads `TRefs` via `ResolveOutputType`; return `QuadInterface[]` stays. |
| `subschemaAt` (~1495–1503) | id + object + impl. | Unify precise; sub-schema return type keyed off the resolved schema. No loose overload. |
| `fromQuads` (~1154–1168) | id + object + impl `(): unknown[]`. | Array element type via `ResolveOutputType`; impl `unknown[]` internal. |
| `set` (~1449–1463) | returns `JsonTology<SchemaReferencesMapType<[T]> & TRefs>` (already lazy-correct). | No change beyond verifying it still composes after the helpers land. |
| `addComputed` (~869–) | augments `TRefs[K]` with `ComputedExtensionBrandInterface`. | No change; verify `ResolveOutputType`/`ParseOutputType` still surfaces computed fields. |

**Implementation signatures** (the `(…): unknown {` bodies at ~1269, ~1335, etc.)
are internal and not part of the public contract once the public overloads are
precise; their `unknown` return + the single runtime cast are the type-erasure
boundary (acceptable). Do **not** add public `unknown`.

---

## Statics policy (`JsonTology.instantiate/is/materialize/validate/toQuads/fromQuads`, ~411–700)

The statics build an **ephemeral** single-schema registry — they have **no
references map**. Keep them single-arg (`InferSchemaType<TSchema>` /
`MaterializedSchemaType<TSchema>`). After #1 a cross-`$ref` in a static call
yields `RefNotFound` — **correct**: use an instance with the schema set for
cross-refs. Do not thread a fake `TRefs` into statics; do not add an `unknown`
fallback. (Optionally document this in the materialize-vs-instantiate doc.)

---

## Declaration-emit regression test (MISSING — add)

The reason #7 exists. Add a fixture + a build that would have caught TS2589:
- `test/types/declaration-emit/` (new): a registry with a **deep root** (≥6
  `$ref`/nesting levels) and ~20 sibling schemas, `export const reg =
  JsonTology.create({ schemas: […] })`, plus `export type Root = ResolveOutputType<…>`.
- A dedicated tsconfig (`tsconfig.decl-emit.json`, `extends ./tsconfig.json`,
  `compilerOptions: { declaration: true, emitDeclarationOnly: true, noEmit: false,
  outDir: <temp> }`, `include` only the fixture) — must emit **without TS2589**.
- Wire it into the test scripts (a `test:decl` npm script that runs
  `tsc -p tsconfig.decl-emit.json`), and into CI/`litany` if applicable.
- Add a `test/types/` assertion that `instantiate(id, data)` / `materialize(id, …)`
  for a string `$id` still return the precise branded entity type (parity with the
  old `TMap[K]`).

---

## Cascade strategy (measure-first, fix precisely)

1. Land the conditional-return helpers + the method changes **incrementally**,
   `npm run type-check` after each method.
2. After deleting the loose overloads, run `npm run type-check`,
   `npx tsc --noEmit --project tsconfig.test-types.json`, and `npx eslint .` and
   **inventory the cascade by file**. Expect breakage wherever a loosely-typed
   schema rode the `unknown` overload (some `examples/**`, possibly a few
   `test/**`).
3. Fix each precisely — the schema must be `as const` (so it infers), or the
   caller threads the schema set, or it self-contains via `$defs`. **Never**
   silence with `any`/`unknown`/`as`/`@ts-ignore`/eslint-disable, and never
   reinstate a loose overload. If a fixture asserted `unknown`, update it to assert
   the precise type or the `RefNotFound` brand.
4. Likely concrete fixes: `examples/docs/bookstore/entities/*.ts` schemas must be
   `as const`; example 16 then types `customer.addresses` precisely.

---

## Order of operations (resume here)

1. Add `src/types/ResolveOutput.ts` (the three helpers) + export from
   `src/types/index.ts`.
2. `materialize` — delete loose overload, add string-id form, use
   `ResolveMaterializedType`. Verify example 16 + `npm run type-check`.
3. `is` — delete loose overload, precise type guard via `ResolveOutputType`.
4. `dump` / `encode` — return `ResolveInputType` (wire/InputType, docs/design/0005 §8).
5. `validate` / `dumpJson` / `toQuads` / `subschemaAt` / `fromQuads` — drop loose
   overloads, unify precise.
6. Sweep: `grep -nE "\): unknown;|Record<string, unknown> & \{ '\\$id'" src/JsonTology.ts`
   — confirm no public `unknown`/loose overload remains.
7. Add the declaration-emit regression test (above).
8. Fix the cascade (measure-first).
9. Update `docs/design/0005` §7 to "DONE — single precise signatures, no `unknown`
   overloads"; update the summary table row.

## Gates / done-means

- `npm run type-check` clean; `npx tsc -p tsconfig.test-types.json` clean;
  `npm run test:decl` emits without TS2589; `npm run test:all` pass;
  `npx eslint .` clean (format with `npx litany format`, **not** `eslint --fix`).
- `grep` confirms **zero** public `unknown` overloads and **zero**
  `(schema: Record<string, unknown> & {$id}) → unknown|boolean` overloads on the
  typed methods.
- example 16 and all `examples/**` type-check + lint with precise types (no
  `unknown`), no schema rides a loose overload.
- A consumer calling `instantiate`/`materialize`/`is` by `$id` or schema gets the
  precise branded type or a `RefNotFound` compile error — never `unknown`.
