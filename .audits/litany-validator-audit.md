# Litany Validator Audit & Remediation Plan

**Source:** empirical findings from driving `json-tology` (a published TypeScript
library, NodeNext/ES2022, strict, `exactOptionalPropertyTypes`, hot-path
validation/RDF code) toward a fully-green `litany inspect`.
**Baseline observed:** 4,683 checks, ~4,635 failing across 260 files at start.
**Verdict:** "every validator at zero" is **not reachable as currently
specified** — several validators are mutually contradictory, a few are
literally unsatisfiable, and several are wrong for a *library* (vs an app).
Below is what to change, what conflicts, what's outright wrong, new validators
worth adding, and a phased remediation plan.

---

## 0. Executive summary

| Class | Validators | Action |
|---|---|---|
| **Unsatisfiable (bugs)** | `functionTypeAnnotation` (constructors), type-predicate returns | Exempt the impossible cases |
| **Mutually contradictory** | `functionReturnTypeNaming` ⊥ `canonicalDeclarations`; `functionLength`/`cyclomaticComplexity` ⊥ `parameterSignature` ⊥ `functionCohesion` | Pick one side per pair; make the other yield |
| **Library-blind** | `unusedExports`, `publicApiExports`, `deadCode` | Make entry-point / `package.json#exports` aware |
| **Over-reaching (low value)** | doc-tag completeness, `magicNumbers`, `functionReturnTypeNaming`, `codeClone` on trivial bodies | Tune thresholds / scope / allowlists |
| **Tooling conflict** | `eslint --fix` (stylistic) vs `litany format` | Make one own formatting |
| **Net-negative outcome** | doc validators forced **+10k lines** of boilerplate; refactors traded one rule for another | Severity tiers + conflict resolution |

The single most important structural fix: **introduce a conflict-resolution
layer and severity tiers** so validators can't demand contradictory states, and
so "advisory" rules don't block a green run.

---

## 1. Outright broken / unsatisfiable (these are bugs)

### 1.1 `functionTypeAnnotationValidator` fires on `constructor`
- **Problem:** It demands an explicit return-type annotation on every function,
  including `constructor()`. **TypeScript forbids return-type annotations on
  constructors** — `constructor(): void {}` is a compile error (TS2730). The
  rule is therefore **impossible to satisfy** for every class in the codebase.
- **Evidence:** every class flagged exactly once and could never be cleared
  (SchemaRegistry, GraphEngine, every error class, Materializer, …). Multiple
  independent agents hit the same wall.
- **Fix:** exempt constructor declarations from `functionTypeAnnotation`. (Also
  exempt set/get accessors where TS infers the type and annotation is awkward.)

### 1.2 Type-predicate (`x is T`) returns vs `functionReturnTypeNaming`
- **Problem:** A function `(v: unknown): v is Foo` cannot have its return type
  replaced by a "named project type" — the predicate *is* the return type.
  `functionReturnTypeNaming` flags these with no satisfiable fix.
- **Fix:** exempt type-predicate signatures from `functionReturnTypeNaming`.

### 1.3 `functionTypeAnnotation` vs primitive/`void` returns
- Minor: flags arrows whose return is trivially inferred (`() => true`). Allow a
  configurable exemption for one-expression arrows returning a primitive.

---

## 2. Mutually-contradictory validator pairs (cannot both be zero)

### 2.1 `functionReturnTypeNamingValidator` ⊥ `canonicalDeclarationsValidator`
- **The contradiction:** `functionReturnTypeNaming` *requires* you to replace an
  inline return type like `QuadInterface[]` with a **named alias**
  (`type QuadArrayType = QuadInterface[]`). `canonicalDeclarations` (and
  `noTrivialShims`) then flag that exact alias as a **trivial alias to delete**.
  You can satisfy one only by violating the other.
- **Evidence:** a wave that created ~14 single-use return aliases
  (`QuadArrayType`, `SkolemizeFnResultType`, `RootSchemaIdResultType`,
  `SchemaEntriesIteratorType`, …) drove `functionReturnTypeNaming` down but drove
  `unusedExports` **607 → 728**, `deadCode` **255 → 273**, `noTrivialShims`
  **291 → 303**. Net **worse**. We reverted all of it.
- **Recommended resolution:** **drop / heavily narrow `functionReturnTypeNaming`.**
  Naming `Foo[]`/`Foo | undefined`/`IterableIterator<…>` returns adds churn and
  single-use exports with no readability gain. Keep it (if at all) only for
  **anonymous object-literal** return shapes (`{ a: ..., b: ... }`), which is the
  one case where a named type genuinely helps — and even then prefer suggesting
  it as advisory, not error.

### 2.2 `functionLength` / `cyclomaticComplexity` ⊥ `parameterSignature` ⊥ `functionCohesion`
- **The contradiction:** To reduce a long/complex function you extract helpers.
  On hot-path code each helper must receive the same execution context
  (graph, node, options, scope, errors, value) → **`parameterSignature` fires on
  the new helpers**. Bundling those into an options object means **allocating a
  new object per call on a hot path** (perf-forbidden) and also trips
  `functionCohesion` (each helper still references the same N domain types) and
  `definitionLocation`/`noTrivialShims` (the new options interface).
- **Evidence (decisive):** `SchemaCompiler.ts` meaningful count went **1 → 63**
  *after* a behavior-identical `functionLength` refactor — the extracted helpers
  each inherited the multi-param context. Same pattern in `exec/Arrays`,
  `exec/Scalars`, `Materializer`, `RefDecoder`, `GraphEngineScalars`.
- **Recommended resolution:**
  - Treat `parameterSignature` as **advisory** on functions tagged hot-path
    (or: allow a per-file/per-function `// litany:perf` opt-out that the rule
    honors), because "many positional params" is a deliberate
    no-allocation choice.
  - Make `functionLength`/`cyclomaticComplexity` **not count extracted private
    helpers against `parameterSignature`/`functionCohesion`** — i.e. resolve the
    pair so that doing the sanctioned refactor doesn't create new errors.
  - Raise the default `parameterSignature` threshold (3 is too low for
    perf-sensitive code; 4–5 with an options-object suggestion as advisory).

### 2.3 Doc validators ⊥ `maxFileLength`
- Forcing the full tag set on every symbol **ballooned the codebase by ~10,000
  lines** (`git diff` net `+18,630 / −6,399` across 57 files, the bulk being
  TSDoc). That pushes files past `maxFileLength`, which then demands splitting —
  more churn. The doc requirement and the size limit fight each other.
- **Resolution:** see §3 — make doc completeness scale with symbol importance,
  and exclude doc-comment lines from `maxFileLength` counting.

---

## 3. Over-reaching / low-value rules (tune, don't drop)

### 3.1 Doc-tag completeness (`tsDoc`, `typedocTags`, `documentation`, `structuredDoc`)
- **Problem:** demands `@remarks`, `@example`, `@category`, `@since`, `@see`,
  `@group` (and `@typeParam`/`@defaultValue`) on **every exported symbol**,
  including one-line constants and trivial type aliases. `@example` on
  `export const HEX_RADIX = 16` is noise. This is ~55% of all findings and the
  single biggest churn source.
- **Resolution:**
  - **Tier docs by symbol kind:** require a description (1 line) on all public
    symbols; require `@param`/`@returns`/`@typeParam` only on functions/generics;
    make `@example`/`@remarks`/`@since`/`@see`/`@group`/`@category` **advisory**
    (warn) or required **only on public-API entry-point symbols** (things
    re-exported from `package.json#exports`).
  - Don't require `@example` on non-callable symbols.
  - Exclude doc-comment lines from `maxFileLength`.

### 3.2 `codeCloneValidator` on trivial bodies
- **Problem:** flags one-line getters (`get size() { return this.store.size }`,
  `length`, `count`), error-class `constructor`/`toJson` bodies, and similar
  boilerplate across **unrelated files** as "identical — extract to a shared
  module." Extracting a shared module for a `length` getter is absurd and
  creates coupling between unrelated classes.
- **Resolution:** add a **minimum token/AST-node threshold** (e.g. ignore clones
  under ~5 statements), ignore accessor bodies, ignore class-member boilerplate
  (`toJson`, constructors that only assign fields), and only report clones
  **within a cohesive boundary** (same package/module), not globally.

### 3.3 `magicNumbersValidator`
- **Problem:** flags `0`, `1`, `2`, array indices, and numbers already in a
  named context. Useful for real magic constants; noisy for the rest.
- **Resolution:** ignore `0`/`1`/`-1`/`2`, ignore array index positions, ignore
  numbers inside an already-named `const`/enum, ignore numbers in test files.

### 3.4 `functionReturnTypeNaming` — see §2.1 (drop or narrow to object literals).

---

## 4. Library-awareness gaps (wrong for libraries)

These validators assume an **application** (everything must be used internally).
For a **published library the public API is the product** and is "unused"
internally by definition.

### 4.1 `unusedExportsValidator`
- **Problem:** 600+ findings, almost all **intentional public API** re-exported
  from `package.json#exports` (`.`, `./schema`, `./value`, `./ontology`,
  `./types`, `./interfaces`, `./viz`). Deleting them to satisfy the rule would
  **break consumers**.
- **Resolution:** make it **entry-point aware** — treat any symbol reachable
  from a `package.json#exports` entry (transitively) as "used." Only flag
  exports that are reachable from **no** public entry AND unused internally.

### 4.2 `publicApiExportsValidator`, `deadCodeValidator`, `noReExportsValidator`
- Same root cause. `deadCode` must not count public-API surface as dead.
  `noReExports` conflicts with the deliberate barrel/subpath-export design that
  `package.json#exports` requires — reconcile with the project's documented
  export strategy (e.g. allow re-exports that back a declared subpath).

### 4.3 `singleExportRuleValidator` / `fileNamingPolicyValidator`
- Defensible as a *style*, but should be **opt-in per project**: many libraries
  intentionally co-locate a small cluster (e.g. an interfaces barrel exporting 8
  related contracts). When on, they require large mechanical splits with
  import-graph ripple. Recommend: project-level toggle + an allowlist for
  designated barrel files.

---

## 5. Tooling conflict: `eslint --fix` vs `litany format`

- **Problem:** the project's eslint **stylistic** rules (`@stylistic/indent`,
  `function-call-argument-newline`, etc.) and `litany format` **disagree**.
  Running `eslint --fix` after `litany format` (or vice versa) does **not
  converge** — observed oscillation **28 → 467 → 961** `@stylistic/indent`
  errors across passes; `litany format` then collapsed it back to **28**.
- **Resolution (pick one):**
  - **(a)** `litany format` is the single source of truth for formatting; ship a
    generated eslint stylistic config that is provably consistent with it (or
    disable overlapping `@stylistic/*` rules in projects that use `litany
    format`).
  - **(b)** Have `litany` detect an eslint stylistic config and **defer**
    formatting to eslint.
- Either way, **document that the two must not both own formatting**, and have
  `litany inspect` warn when it detects conflicting formatters.

---

## 6. Proposed new validators (additive value)

1. **`publicApiDocCoverage`** — *replace* blanket doc-tag rules: require docs
   **only** on symbols exported from `package.json#exports`, with depth scaled to
   visibility. High signal, low noise.
2. **`exactOptionalPropertySpread`** — flag `{ ...x, key: maybeUndefined }`
   spreads that violate `exactOptionalPropertyTypes` (a real latent-bug class we
   hit; TS only catches it at the use site). Suggest the
   `...(v === undefined ? {} : { key: v })` idiom.
3. **`noUnknownWidening`** — flag widening a *meaningfully-typed* parameter
   (e.g. `Record<string, unknown>`) to bare `unknown` purely to silence
   `no-unnecessary-condition`. (Encodes a real review rule: keep the honest
   type; fix the guard with a type predicate instead.)
4. **`hotPathAllocation`** — in functions annotated hot-path, flag per-call
   object/array literal allocations introduced by refactors. Pairs with §2.2 so
   the complexity/param trade-off is governed by an explicit perf rule rather
   than two rules silently fighting.
5. **`deadGuardVsRuntime`** — smarter `no-unnecessary-condition`: distinguish a
   guard that is dead given *sound* types from one that protects against
   `unknown`/JS/`exactOptionalPropertyTypes` reality, so it doesn't push authors
   to delete real runtime guards (the `setOne` failure mode).
6. **`typePredicateReturn`** — positively recognize `x is T` returns as
   well-typed (so `functionReturnTypeNaming` et al. don't mis-flag them).
7. **`barrelExportIntegrity`** — verify every `package.json#exports` subpath has
   a backing barrel and that internal imports bypass barrels (the *real*
   architectural intent), instead of the blunt `noReExports`.

---

## 7. Proposed severity / config model

The core structural change. Today every validator is effectively a blocking
error; that's why contradictory rules make "green" impossible.

- **Three tiers:** `error` (must fix — correctness/safety), `warn` (advisory —
  style/preference, never blocks a green run), `off`.
- **Per-category and per-validator overrides** in a `litany.config` (the project
  already groups by `architecture | exports | policy | signatures | quality |
  docs | type-safety | interfaces`).
- **Conflict registry:** declare known mutually-exclusive pairs (§2). `litany`
  refuses to run both as `error` and prints which one is yielding.
- **Per-file / per-symbol directives:** `// litany:perf`, `// litany:public-api`,
  `// litany:allow <rule> <reason>` (audited, like a justified eslint-disable —
  with the reason required), so legitimate exceptions are explicit and reviewable
  rather than impossible.
- **Library vs application profile:** a top-level `projectKind: library | app`
  that flips the entry-point-awareness defaults in §4.

---

## 8. Phased remediation plan (for the litany project)

**Phase 1 — Stop the bleeding (correctness bugs).** Highest priority; unblocks
real adoption.
- Exempt constructors and type-predicate returns from
  `functionTypeAnnotation` / `functionReturnTypeNaming` (§1).
- Add the conflict registry + severity tiers (§7) so a green run is *possible*.
- Reclassify `parameterSignature`, `codeClone`, `functionCohesion`,
  `functionReturnTypeNaming` to **warn** by default.

**Phase 2 — Library awareness.** Make the `exports` family correct for libraries.
- `package.json#exports` reachability for `unusedExports` / `publicApiExports` /
  `deadCode` (§4).
- `projectKind` profile.

**Phase 3 — Tune the noisy-but-valuable rules.**
- Tier the doc validators; exclude doc lines from `maxFileLength` (§3.1, §2.3).
- `codeClone` token threshold + cohesive-boundary scoping + accessor/boilerplate
  exemptions (§3.2).
- `magicNumbers` allowlist (§3.3).

**Phase 4 — Resolve the refactor trade-off pair.**
- Make sanctioned `functionLength`/`cyclomaticComplexity` refactors not create
  `parameterSignature`/`functionCohesion` errors (§2.2); add `hotPathAllocation`
  (§6.4) to govern the real concern.

**Phase 5 — Formatter reconciliation.**
- Decide formatter ownership; ship consistent config or deferral; warn on
  conflict (§5).

**Phase 6 — New high-signal validators.**
- `exactOptionalPropertySpread`, `noUnknownWidening`, `deadGuardVsRuntime`,
  `barrelExportIntegrity`, `publicApiDocCoverage` (§6).

---

## 9. Appendix — concrete evidence captured this session

- `functionReturnTypeNaming` aliases pushed `unusedExports` 607→728,
  `deadCode` 255→273, `noTrivialShims` 291→303 (reverted).
- `SchemaCompiler.ts` meaningful count 1→63 after a behavior-identical
  `functionLength` extraction (helpers inherited the multi-param context).
- `eslint --fix` ⊥ `litany format`: `@stylistic/indent` oscillated 28→467→961;
  `litany format` restored it to 28.
- Doc requirements drove a net ~+10k LOC of formulaic TSDoc.
- `codeClone` flagged `length`/`size`/`count` getters and error-class
  `constructor`/`toJson` across unrelated files.
- `functionTypeAnnotation` on `constructor` — unsatisfiable for every class.
- `noUnknownWidening` / `deadGuardVsRuntime` motivated by a real near-miss: a
  fix proposed widening `setOne(schema: Record<string, unknown>)` to
  `setOne(raw: unknown)` purely to make a runtime guard "necessary" — the honest
  fix is a type predicate (`isRecord`), not `unknown`.
