# Design 0002 — Total compile-time enforcement of every json-tology constraint

**Status.** Draft for 0.4
**Authors.** Andrew Studnicky
**Date.** 2026-05-07

---

## Summary

Hoist every constraint json-tology enforces at runtime into the TypeScript type system. The runtime path stays as the trust-boundary check; the type-level path catches violations at authoring time. PR `6061b31` covered the OWL class-axiom and restriction surface (`disjointWith`, `complementOf`, six property restrictions); this design covers the remaining 26 surfaces.

The motivating principle: a json-tology consumer should never see a runtime validation error for a class of mistake the compiler could have caught. "Should remain runtime-only" is a stance about TypeScript's representational ceiling; this doc treats every gap as a research item rather than a closed door.

## Scope

26 numbered findings, batched into eight concern clusters. Each cluster is a coherent unit of work suitable for one implementation agent. Clusters are designed to land independently (no cross-cluster type dependencies that would force a single PR), so they can be dispatched in parallel.

| # | Cluster | Findings | Priority |
| - | - | - | - |
| A | Compose argument validation | 1, 2, 3, 4, 5, 6 | 1 |
| B | Schema keyword cross-checks (required, dependentRequired, if discriminator) | 7, 8, 9 | 1 |
| C | Raw `minItems` / `maxItems` tuple narrowing | 17 | 2 |
| D | Transform.pipe chain compatibility | 10, 11 | 2 |
| E | Registry `$id` collision + cross-schema `$ref` / `$anchor` resolution | 12, 13, 14, 15, 16 | 2 |
| F | `if/then/else` multi-property + non-const discriminators | 18 | 3 |
| G | Pattern / IntegerRange / format auto-application | 19, 20, 21 | 3 |
| H | Research items: regex / format / multipleOf / uniqueItems / contains | 22, 23, 24, 25, 26 | 4 |

Priority 1 = land before 0.4 release; 2 = land before 0.4 RC; 3 = stretch for 0.4; 4 = research, possibly defer to 0.5.

---

## Cluster A — Compose argument validation

### Finding 1 — `Compose.pick(schema, keys)` keys must be `keyof properties`

**Problem.** `pick<TSchema, TKeys extends string, TId extends string>(schema, keys: readonly TKeys[], newId)`. `TKeys` is inferred from the array literal with no constraint on it being a real property. Picking a non-existent key produces a schema with empty `properties` silently.

**Design.** Bound `TKeys`:

```ts
public static pick<
  TSchema extends Record<string, unknown> & { readonly '$id': string },
  TKeys extends keyof ExtractPropertiesType<TSchema> & string,
  TId extends string
>(schema: TSchema, keys: readonly TKeys[], newId: TId): PickSchemaInterface<TSchema, TKeys, TId>;
```

Two-call test fixture: `Compose.pick(UserSchema, ['nope'] as const, 'urn:Bad')` must surface as a type error pointing at `'nope'`.

**Scope.** ~5 lines per method. Same shape for `omit`. No runtime change.

---

### Finding 2 — `Compose.omit(schema, keys)` same constraint

**Design.** Identical to Finding 1, applied to `omit`'s signature.

---

### Finding 3 — `Compose.subClassOf(parent, body)` self-subclass detection

**Problem.** `Compose.subClassOf(SchemaA, { $id: 'SchemaA', ... })` produces a schema that subclasses itself. Runtime catches this as a graph cycle eventually; compile time should reject the construction.

**Design.** Conditional type guard on the body's `$id`:

```ts
type RejectSelfSubClassType<TParent, TBodyId extends string>
  = TParent extends { readonly '$id': TBodyId }
    ? never
    : TParent extends ReadonlyArray<{ readonly '$id': infer P extends string }>
      ? TBodyId extends P ? never : TParent
      : TParent;
```

Apply at the type-parameter level so the function call itself is rejected rather than the return type.

**Scope.** ~15 lines (one helper type + signature change in `interfaces/Compose.ts` and `Compose.subClassOf` overloads). Tests: `subClassOf(A, { $id: A.$id })` is `never`-typed.

---

### Finding 4 — `Compose.discriminatedUnion(prop, variants)` discriminator presence

**Problem.** `discriminatedUnion('kind', [A, B])` doesn't enforce that A and B each have `properties.kind` as a const. Today a missing discriminator produces a broken schema that fails at runtime instantiate.

**Design.** Constrain `TVariants`:

```ts
type RequireDiscriminatorType<TVariants, TProp extends string>
  = TVariants extends readonly [infer THead, ...infer TTail]
    ? THead extends {
        readonly 'properties': Record<TProp, { readonly 'const': string | number }>;
        readonly 'required': ReadonlyArray<TProp>;
      }
      ? readonly [THead, ...RequireDiscriminatorType<TTail, TProp>]
      : never
    : readonly [];
```

The variant array param becomes `RequireDiscriminatorType<TVariants, TProp>`; missing discriminators reduce to `never`.

**Scope.** ~25 lines. Tests: a variant without `kind: { const: '...' }` triggers a type error.

---

### Finding 5 — `Compose.equivalent(source, options)` `$id` collision

**Problem.** `Compose.equivalent(IsbnSchema, { $id: IsbnSchema.$id })` is a self-equivalent (identity) schema — should be a type error.

**Design.** `options['$id'] extends source['$id'] ? never : ...`. Same pattern as Finding 3 but on a single $id pair.

**Scope.** ~5 lines.

---

### Finding 6 — `Compose.intersection(schemas, newId)` `$id` collision

**Problem.** `Compose.intersection([A, B], A['$id'])` reuses `A`'s `$id`. Should be a type error.

**Design.** `newId extends ExtractIdsType<TSchemas>[number] ? never : ...` where `ExtractIdsType` walks the tuple.

**Scope.** ~10 lines.

---

## Cluster B — Schema-keyword cross-checks

### Finding 7 — `required: ['key']` entries must be `keyof properties`

**Problem.** Authoring `{ properties: { name }, required: ['nme'] }` (typo) is silently a vacuous required entry. JSON Schema permits it; the typed authoring layer should not.

**Design.** This is harder than the Compose checks because it sits on the raw schema literal. Approaches:

1. **Author-time validator type** — `ValidateSchemaType<T>` that maps over `required` entries and produces `T` if every entry is in `keyof properties`, else a structured error type with a hint.
2. **Make `required` array param a constrained generic** wherever Compose builds it: ensure produced schemas can never violate. Catches Compose-built schemas; raw author-written `as const` schemas still slip through unless the consumer pipes through `ValidateSchemaType`.

Recommended path: ship both. `Compose.*` produces only valid schemas (Compose handles its own input checks); a public `ValidateSchemaType<T>` lets authors opt their hand-written schemas into compile-time checking.

**Scope.** ~30 lines for the validator + ~10 lines per Compose method that builds `required`. Tests: a bad `required` entry surfaces a `RequiredKeyNotInProperties<'nme', 'name'>` brand error type.

---

### Finding 8 — `dependentRequired: { x: ['y', 'z'] }` keys + deps must be in properties

**Design.** Same `ValidateSchemaType` extension. Walk `dependentRequired` map: every key and every entry of every value array must be in `keyof properties`.

**Scope.** ~20 lines added to the validator from Finding 7.

---

### Finding 9 — `if: { properties: { kind: { const: 'X' } } }` `kind` must be `keyof properties`

**Design.** Extend the validator to descend into `if`'s structure. A bad discriminator key surfaces as a `IfDiscriminatorNotInProperties<'kind'>` brand error.

**Scope.** ~20 lines.

---

## Cluster C — Raw `minItems` / `maxItems` tuple narrowing

### Finding 17 — Raw JSON Schema `minItems` / `maxItems` should narrow to tuple types

**Problem.** OWL `cardinality` / `minCardinality` / `maxCardinality` (PR `6061b31`) narrow the inferred property type to a tuple shape. Raw JSON Schema's `minItems` / `maxItems` should do the same; today they only set nominal brands (`MinItemsBrandInterface`).

**Design.** Reuse the tuple builders from `src/types/RestrictionInfer.ts` (`BuildExactTupleType`, `BuildAtLeastTupleType`, `BuildAtMostTupleType`). When `InferType` encounters an array property with `minItems` and/or `maxItems`:

- `minItems === maxItems` → `BuildExactTupleType<T, N>`
- `minItems > 0`, no `maxItems` → `BuildAtLeastTupleType<T, minItems>`
- `maxItems`, no `minItems` → `BuildAtMostTupleType<T, maxItems>`
- Both with `minItems < maxItems` → bounded variadic `[T, T, ..., T, ...T[]]` capped at `maxItems`

Cap at `TupleCapType = 16` (already established). Above the cap, fall through to `readonly T[]`.

**Scope.** ~50 lines in `Infer.ts` at the array-inference site. Tests: a schema with `minItems: 2, maxItems: 4` produces a property type union of length-2/3/4 tuples.

---

## Cluster D — Transform.pipe chain compatibility

### Finding 10 — `Transform.pipe(a, b, c)` must enforce `encode<a> = decode<b>`

**Problem.** Today `pipe` accepts arbitrary transform tuples. Type drift (mismatched stages) compiles silently and fails at runtime as `decode` produces a value the next stage can't read.

**Design.** Variadic generic with pairwise compatibility:

```ts
type ValidatePipeChainType<TStages extends ReadonlyArray<TransformBrandInterface<unknown, unknown>>>
  = TStages extends readonly [infer THead, infer TNext, ...infer TRest]
    ? THead extends TransformBrandInterface<infer TInA, infer TOutA>
      ? TNext extends TransformBrandInterface<infer TInB, unknown>
        ? TInB extends TOutA
          ? readonly [THead, ...ValidatePipeChainType<readonly [TNext, ...TRest]>]
          : never
        : never
      : never
    : TStages;
```

Apply at the `pipe(...stages: ValidatePipeChainType<TStages>)` parameter. Mismatch resolves to `never`, which surfaces as a tuple-arity / type error pointing at the first bad stage.

**Scope.** ~40 lines + tests. Audit `TransformBrandInterface` to confirm it carries decode + encode types.

---

### Finding 11 — `Transform.encode(schema, value)` value must match decoded form

**Problem.** Audit needed — likely already enforced via the schema's inferred type.

**Design.** Add a type-level test that exercises `encode` with a value of the wrong type and asserts the error fires. If it doesn't, tighten the signature.

**Scope.** Audit-first; ~10 lines if a fix is needed.

---

## Cluster E — Registry `$id` collision + cross-schema `$ref` / `$anchor`

### Finding 12 — `JsonTology.create({ schemas: [A, B, C] })` duplicate `$id` detection

**Problem.** Two schemas with the same `$id` in the schemas tuple is a runtime error today. Compile-time check is feasible since the tuple is `as const` and ids are literal strings.

**Design.**

```ts
type DetectDuplicateIdsType<TSchemas extends readonly { readonly '$id': string }[]>
  = TSchemas extends readonly [infer THead, ...infer TTail]
    ? THead extends { readonly '$id': infer TId extends string }
      ? TTail extends ReadonlyArray<{ readonly '$id': infer TRest extends string }>
        ? TId extends TRest
          ? `Duplicate \$id: ${TId}`
          : DetectDuplicateIdsType<Extract<TTail, ReadonlyArray<{ readonly '$id': string }>>>
        : TTail
      : TTail
    : TSchemas;
```

`JsonTology.create({ schemas: TSchemas extends DetectDuplicateIdsType<TSchemas> ? TSchemas : never })`.

**Scope.** ~25 lines + tests.

---

### Finding 13 — `registry.addComputed(schemaId, ...)` / `addInvariant` must accept registered IDs only

**Problem.** Likely already enforced via the `JsonTology<TMap>` type-state. Audit needed.

**Design.** If not enforced: `schemaId: keyof TMap & string`. Add tests proving an unregistered ID is rejected.

**Scope.** Audit-first.

---

### Finding 14 — `findDuplicates()` result `equivalentTo` should be literal IRI

**Problem.** Today returns `string`. Could be the literal union of registered IDs.

**Design.** `findDuplicates(): readonly DuplicateReportEntry<keyof TMap & string>[]` where the brand-typed `equivalentTo` field carries the literal union.

**Scope.** ~10 lines + tests.

---

### Finding 15 — `$ref` to unregistered schema → compile-time error

**Problem.** Cross-schema `$ref` falls back to `unknown` if the referenced schema isn't in `TReferences`. A typed registry already knows every `$id`; a `$ref` to an unknown one should be a type error rather than a silent `unknown`.

**Design.** When `InferType` sees `{ $ref: 'urn:...' }` and a `TReferences` map is in scope, look up the IRI. Miss → emit a `RefNotFound<'urn:...'>` brand error type rather than `unknown`.

**Scope.** ~20 lines in the cross-ref branch of `Infer.ts`. Tests: a registry of `[A]` with a schema referencing `B.$id` is rejected at compile time.

---

### Finding 16 — `$anchor` cross-schema resolution

**Problem.** Same as Finding 15 for `$anchor`-named references.

**Design.** Mirror Finding 15's solution against the anchor map.

**Scope.** ~15 lines.

---

## Cluster F — `if/then/else` multi-property + non-const discriminators

### Finding 18 — Generalize `if/then/else` discriminator inference

**Problem.** `Infer.ts` handles `if: { properties: { kind: { const: 'X' } }, required: ['kind'] }` (single const-discriminated property). Multi-property discriminators or non-const discriminator schemas fall back to a sound over-approximation (union of branches).

**Design.** Extend the `if` matcher:

1. Multi-property const discriminator — every property in `if.properties` is a `const`. Narrow `then` with the conjunction of all those literals.
2. Enum discriminator — `if: { properties: { kind: { enum: ['X', 'Y'] } } }` narrows `then` to the union of literal branches.
3. Type-only discriminator (no const) — narrowing a property by type rather than literal. Pass through structurally.

**Scope.** ~80 lines in `Infer.ts`. Tests: each new discriminator pattern produces the expected narrowed type.

---

## Cluster G — Pattern / IntegerRange / format auto-application

### Finding 19 — `patternProperties` template-literal expansion for more patterns

**Problem.** Currently handles `^prefix`, `suffix$`, `^exact$`. Missing: character classes (`^[a-z]+$`), alternation (`^(foo|bar)$`), bounded length (`^.{1,5}$`).

**Design.** Add pattern parsers in `Infer.ts`:

- `^(a|b|c)$` → `'a' | 'b' | 'c'`
- `^[a-z]+_id$` → `` `${string}_id` `` (with character-class hint preserved as a brand if expressible)
- `^.{N}$` exact length — for small N, a tuple-of-character template literal `\`${string}${string}...\``

**Scope.** ~120 lines (parser + several pattern handlers) + tests for each pattern shape. Largest item in this cluster.

---

### Finding 20 — `minLength` / `maxLength` for tiny bounds

**Problem.** TS `string` type doesn't carry length. For small N (≤ 16), narrow to a union of length-N character template literals.

**Design.** When a string property has `minLength === maxLength === N` and N ≤ 8, build:

```ts
type FixedLengthStringType<N extends number, TAcc extends string = ''>
  = TAcc['length'] extends N ? TAcc : FixedLengthStringType<N, `${TAcc}${string}`>;
```

For ranges, union over the range.

**Scope.** ~40 lines + tests. Honestly low value; TypeScript struggles with template literals at length 8+. Keep as opt-in via `IsEnabledType<'tightStringLengths'>`.

---

### Finding 21 — `IntegerRangeType` auto-application

**Problem.** `IntegerRangeType<min, max>` exists as a helper but isn't applied automatically when a schema has `type: 'integer', minimum: ..., maximum: ...`.

**Design.** In `Infer.ts`, when `type: 'integer'` and both `minimum` and `maximum` are present and `maximum - minimum <= IntegerRangeCap` (50), emit `IntegerRangeType<min, max>` (a literal union) instead of `number`.

**Scope.** ~20 lines in the integer-inference branch. Tests: `{ type: 'integer', minimum: 1, maximum: 5 }` produces `1 | 2 | 3 | 4 | 5`.

---

## Cluster H — Research items (currently flagged "runtime-only")

The user's directive overrules the prior stance that these should remain runtime-only. Each below has a research note and a partial design; expect each to need scoping refinement before implementation.

### Finding 22 — `pattern` for arbitrary regex

**Research.** TypeScript template literals can express a meaningful subset of regex; full regex requires a parser + AST → template-literal type compiler. Existing community work: `ts-regex-parser` (no canonical lib).

**Partial design.**

1. Build a regex AST parser at the type level (recursive type that consumes the regex string).
2. Walk the AST, emitting template literal types for each node:
   - Literal char → that char
   - `.` → `string`
   - `[a-z]` → branded char class type (see (19))
   - `(a|b)` → union
   - `a+` / `a*` → `\`${a}${string}\``
   - Anchors `^` / `$` → control template-literal closure
3. Bound recursion at AST depth 12; above that fall through to `string`.

**Scope.** Massive. Probably 400–600 lines of pure type code + a parser test suite. Defer to its own design doc (`0003-typed-regex.md`) before implementation.

---

### Finding 23 — `format` keywords (email, uri, uuid, date-time, etc.)

**Research.** TS can't represent semantic formats directly. Branded types are the conventional solution: `Email = string & { __brand: 'email' }`. Promotion happens via a validator-blessed cast.

**Partial design.**

1. For each registered format, define a `<Format>BrandInterface` (`EmailBrand`, `UriBrand`, `UuidBrand`, etc.) — many already exist in `ConstraintBrands.ts` as nominal tags.
2. `InferType` reads `format: 'email'` and intersects with `EmailBrand`.
3. The `instantiate` / `validate` path returns the branded type post-validation; raw string assignment to a branded field is rejected.

**Scope.** ~100 lines for the brand wiring + ~10 lines per format (15 standard formats). Tests per format.

**Risk.** Branded fields can break ergonomics — assigning `"hi@x.com"` to an `Email` field requires a cast or a validator call. Need a `Compose.brand` or `Transform.brand` ergonomic that legitimizes the promotion.

---

### Finding 24 — `multipleOf` for non-trivial divisors

**Research.** TS doesn't have integer arithmetic at type level beyond literals up to `999999999999999`-ish. Sub-cases tractable: `multipleOf: 1` (integers), `multipleOf: 2` (even literals), small multiples up to a bounded literal range.

**Partial design.** When `multipleOf: K` and `minimum`/`maximum` both present and `(max - min) / K <= 50`, expand to a literal union of `K`-multiples. Otherwise fall through to `number`.

**Scope.** ~30 lines + tests. Limited applicability.

---

### Finding 25 — `uniqueItems: true`

**Research.** TS can't express "this array has no duplicate elements". Closest representations:

1. Brand the array type as `UniqueArray<T>` — a phantom marker that doesn't actually constrain element distinctness but lets downstream APIs assume it.
2. For tuples of literal-typed elements, enforce uniqueness by a recursive type that checks `T[0] extends T[1] ? never : ...` over each pair. Quadratic cost; cap at length 8.

**Partial design.** Apply (2) for small tuples; emit (1) brand for arrays. Tests cover both.

**Scope.** ~50 lines + tests.

---

### Finding 26 — `contains` with type constraint

**Research.** "At least one element of type X" requires either:

1. Tuple shape `[..., X, ...]` — but TS variadic tuples don't bind to "at least one of type X"; they bind to fixed positions.
2. Branding the array type as `ContainsArray<X>` — see existing `ContainsBrandInterface` in `ConstraintBrands.ts`.

**Partial design.** Pin to (2). When `InferType` sees `contains: { ... }`, brand the array with the contained type. Authors get nominal distinction; runtime check still enforces the actual presence.

**Scope.** ~20 lines + tests.

---

## Cross-cutting concerns

### Recursion budgets

Every type-level addition must stay within the existing `TupleRecursionCap = 10`, `SchemaPointerDepthCap = 5`, `DeepPropertyDepthCap = 4`, `IntegerRangeCap = 50`. Cluster H items (22–26) probably need a new cap (`RegexAstDepthCap`, etc.); they get their own constants.

### Type-level error surfacing

Current pattern uses `never` for unrecoverable type-level errors. For multi-finding clusters that produce richer diagnostics (e.g. `RequiredKeyNotInProperties<...>`), prefer named brand types so IDE hovers communicate the fix. Add to `src/types/TypeErrors.ts` (new file) and re-export from `src/types/index.ts`.

### Performance

Each cluster ships its own `test/types/` file with at least one large-schema fixture (~30 properties, ~10 nested allOf entries) to bound the type-checking cost. Reject any change that pushes `tsc --noEmit` over a 20% wall-clock regression on the existing fixture suite.

### Migration

All changes are additive to existing inferred types via brand intersection. Existing user code that assigns plain values continues to compile. Tighter signatures on `Compose.pick` / `omit` / `subClassOf` etc. (Cluster A, Cluster B) are technically breaking — code that passed bad keys silently now fails. Mitigate via a 0.4-major release note and a `ValidateSchemaType<T>` opt-out for pre-existing schemas that haven't been audited.

---

## Implementation plan

Eight implementation agents, dispatched in two parallel waves.

**Wave 1 (Priority 1, ~independent)** — dispatch concurrently:

- Agent A: Cluster A (Findings 1–6) — Compose argument validation
- Agent B: Cluster B (Findings 7–9) — Schema keyword cross-checks
- Agent C: Cluster C (Finding 17) — `minItems` / `maxItems` tuple narrowing

**Wave 2 (Priority 2)** — dispatch after Wave 1 lands:

- Agent D: Cluster D (Findings 10–11) — Transform.pipe
- Agent E: Cluster E (Findings 12–16) — Registry / cross-schema $ref

**Wave 3 (Priority 3)** — dispatch after Wave 2:

- Agent F: Cluster F (Finding 18) — if/then/else
- Agent G: Cluster G (Findings 19–21) — Pattern / IntegerRange / minLength

**Wave 4 (Priority 4, research)** — sequential, each with its own design refinement:

- Agent H1: Finding 23 — format brands (most tractable of cluster H)
- Agent H2: Finding 25 — uniqueItems (next most tractable)
- Agent H3: Finding 26 — contains
- Agent H4: Finding 24 — multipleOf
- Agent H5: Finding 22 — typed regex (largest; may spawn sub-design `0003-typed-regex.md`)

Each agent gets a self-contained briefing referencing its cluster section. Briefing template:

> You are implementing Cluster X (Findings A–B) from `designs/0002-total-compile-time-enforcement.md`. Read the cluster section. Implement the type-level changes. Add tests in `test/types/<cluster>.test.ts` proving each finding's compile-time error surfaces. Run `npm run type-check`, `npm run test:types`, `npm run test`, and `npm run lint` to green before reporting done.

## Acceptance criteria

For each finding:

1. A type-level test asserts the constraint fires (the bad case is `never` or a named error type).
2. A type-level test asserts the constraint admits the correct case (the good case is the expected narrowed type).
3. The unit test suite remains green; no runtime regression.
4. Lint and type-check remain clean.
5. CHANGELOG entry under `[Unreleased]` describing the new compile-time check.

A finding is closed only when all five hold and the change is merged into `main`.
