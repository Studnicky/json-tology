# Resume handoff — `docs/example-suite-bookstore` branch

This document is the single source of truth for continuing the
example-suite reorganisation in a new session. Read it top-to-bottom
before issuing any commits.

> Branch: `docs/example-suite-bookstore` (16 commits ahead of `main`).
> Tests: 1704/1704 pass (test:all). Lint: 0 errors, 50 pre-existing
> warnings. Docs build clean. Bench runs end-to-end.

---

## Context

The work delivers ONE canonical example domain (a bookstore) that
every docs page, every example file, every benchmark, and every test
fixture draws from. The user's directive is hard:

- **No standalone synthetic schemas anywhere.** Every example imports
  `bookstoreEntities` from `examples/docs/bookstore/index.js`.
- **Every inline `\`\`\`ts` block in `docs/**/*.md` must be moved to a
  runnable file in `examples/docs/` and the docs include it via
  `<<<` directive.** First-block-only is not enough; ALL blocks must
  move.
- **Bench comparator code must mirror the same canonical schemas**
  across zod / valibot / typebox / ajv / io-ts. Node bench:
  comparison libs as peerDeps (already done). Browser bench: CDN
  imports (NOT YET DONE — see Open Workstreams below).
- **Naming**: every fixture name is either a real author (Michael
  Ende, Cornelia Funke, Walter Moers, Hermann Hesse, Patrick
  Süskind) or a Neverending Story character with a realistic name
  (Bastian Balthazar Bux, Carl Conrad Coreander). NO "Alice",
  "Bob", "Charlie", etc.
- **Gender-neutral pronouns** throughout for fixture personas.
- **Library bugs surfaced during this work are fixed at the root,
  never worked around with `eslint-disable` or `as any`.**

These rules are codified in `ARCHITECTURE.md` as invariant #13.

---

## What's done (commits already landed)

```
3518b50 checkpoint: phase 3 expansion + sonnet lint cleanup + n3 types
548cc3c checkpoint after sonnet lint cleanup
5bf8b3a docs(phase-3): batch 4 — constraint-brands + advanced + transforms-recipes
6ce7a4b feat(phase-4+seo+phase-3): benchmarks on bookstore, iridis SEO port, more <<< conversions
3122b03 chore(phase-5): docs inline-ts ratchet via check-docs-includes.mjs
a70d92f docs(phase-5): codify the example-suite contract in ARCHITECTURE + CHANGELOG
90fda4e docs(phase-3): convert errors/views + value/create to <<< includes
d64501f docs(phase-2): Wave 2E + composition extras backed by canonical bookstore
c5cc015 docs(phase-2/3): types+schemas+usage-examples backed by canonical bookstore
10f8431 docs(prose): gender-neutral pronouns throughout the canonical narrative
d37b0ff docs: rename prose throughout to canonical Bastian-Neverending narrative
8307187 refactor(examples): canonical-bookstore-only + Neverending Story naming
9b1dfd1 feat(types): Draft-2020-12 schema type + registry-aware addTransform
f1cb88b fix(compiler,materializer): preserve allOf-inherited properties on instantiate
ece64d9 feat(bookstore): Phase 1 — restructure the canonical domain
6ab7a12 chore(bookstore): checkpoint — coherent ABox fixtures + invariant + sameAs + plan
```

### Bookstore canonical domain
`examples/docs/bookstore/` is the single source of truth:
- `entities/` — 40 schema files (primitives + entities + taxonomy).
- `index.ts` — registers everything as `bookstoreEntities`; declares
  the two `sameAs` ABox pairs; exports `aboxFixtures`.
- `aboxFixtures.ts` — Bastian Balthazar Bux orders a 1979 Thienemann
  first edition of Michael Ende's *Die unendliche Geschichte*
  (ISBN-13 `9783522128001`).

Phase-1 decisions enshrined:
- `PrintStatus` primitive (`'inPrint' | 'outOfPrint' | 'limitedRun'`).
  `Book.printStatus` is required.
- `InPrintBookSchema` / `OutOfPrintBookSchema` discriminate on
  `printStatus` (publisher state), NOT `inStock` (inventory state).
- `SoloAuthoredBookSchema` / `AnthologyBookSchema` deleted —
  cardinality predicates don't earn OWL class identity. The
  registered invariant `signedFirstEditionIsSoloAuthored` on
  `SignedFirstEditionSchema` carries the rule.
- `SignedFirstEditionSchema` is single-parent `subClassOf(RareBook)`
  plus the registered invariant.

### Library improvements
- `JsonSchemaDocumentType` (Draft-2020-12 + json-tology jt:* / OWL
  extensions) replaces `JSONSchema7Definition` in every public-API
  generic constraint. Draft-2020-12 keywords (`prefixItems`,
  `unevaluatedProperties`, etc.) now satisfy the constraint.
- `jt.addTransform<TSchema, TOut>(schema, fns)` instance method
  resolves cross-registry `$ref`s through `TMap` (registry-aware
  variant of static `Transform.create`).
- Compiler + Materializer preserve allOf-inherited properties on
  `instantiate` (was silently dropping parent fields).
- `@types/n3` is installed; surfaced + fixed a latent bug in
  `test/e2e/dcat-ap.test.ts`.

### SEO port from iridis
Live in `docs/.vitepress/config.ts`:
- `manifest.webmanifest`, RSS `feed.xml` (built from CHANGELOG).
- `hreflang` (en-US, x-default).
- `bingbot`, `referrer` meta.
- Conditional Google / Bing site verification.
- Conditional `twitter:site` / `twitter:creator`.
- Organization + BreadcrumbList JSON-LD.
- `article:modified_time`, `article:author`.
- `package.json` `json-tology.seo` config block for tokens.

### Phase 4 — benchmarks
`examples/docs/benchmarks/fixtures.ts` re-exports bookstore schemas
under bench-historic names:

| Bench role | Bookstore schema |
|---|---|
| `SimpleSchema` (flat object) | `ReviewSchema` |
| `NestedSchema` (deep $ref) | `OrderSchema` |
| `OrderItemSchema` | `OrderLineSchema` |
| `CustomerSchema`, `AddressSchema` | unchanged |
| `DefaultsSchema` | `CustomerSchema` (addresses default `[]`) |

Comparator schemas (zod / valibot / typebox / ajv / io-ts) re-declared
to match each bookstore wire shape exactly. AJV gets two inline
`$id`-prefixed schemas.

### Example file build-out
~159 files in `examples/docs/` excluding bookstore entities. Every
example imports `bookstoreEntities`. Numbering convention:
`NN-kebab-case-purpose.ts`, monotonic per directory. Number-collisions
from concurrent agents have been resolved by renumbering.

### Architecture lock-in
- `ARCHITECTURE.md` invariant #13 codifies the contract.
- `CHANGELOG.md` `[Unreleased]` documents the whole reorg.
- `scripts/check-docs-includes.mjs` + `npm run docs:check-includes`:
  a ratcheting CI gate that counts inline `\`\`\`ts` blocks in docs
  outside comparator code-groups and fails when over the ceiling.
  Current ceiling: **427**. Current count: **337**. Lower the
  ceiling intentionally as the count drops; never raise it.

---

## What's NOT done (the remaining scope)

### 1. Inline-ts blocks still in docs — 337 to convert

Top contributors (sorted desc):

| Page | Inline blocks |
|---|---:|
| `docs/types/utility.md` | 27 |
| `docs/usage-examples/transforms-recipes.md` | 13 |
| `docs/types/ranges.md` | 10 |
| `docs/usage-examples/class-hydration.md` | 9 |
| `docs/constraint-brands/keywords.md` | 9 |
| `docs/usage-examples/bookstore-owl-taxonomy.md` | 8 |
| `docs/types/infer.md` | 8 |
| `docs/errors/classes.md` | 8 |
| `docs/advanced/owl-property-characteristics.md` | 8 |
| `docs/advanced/quads.md` | 8 |
| `docs/advanced/sameas.md` | 8 |
| `docs/advanced/skolemization.md` | 8 |
| `docs/migration-0.4.0.md` | 7 |
| `docs/composition/equivalent.md` | 7 |
| `docs/composition/pick-omit.md` | 7 |

…and ~60 more pages with smaller counts.

**Convention for each conversion:**
1. Read the inline block's intent in the surrounding prose.
2. Create a focused example file at
   `examples/docs/<section>/<NN>-<kebab>.ts`. Number sequentially
   from the highest existing slot in that directory.
3. Import `bookstoreEntities` (never `JsonTology.create({...})`).
4. End with at least one `console.assert(...)` (or `void 0 as
   unknown as T` for compile-time-only type demos).
5. Replace the inline block in the docs page with a single
   `<<< ../../examples/docs/<rel-path>.ts` line.
6. Migration pages (`migration-0.x.y.md`) are special — they
   document old behaviour. Either leave their inline blocks alone
   and update the ratchet's "comparator code-group" detection to
   exclude them, OR move the historic snippets into example files
   under `examples/docs/migration/`.

**Estimate**: 337 blocks ≈ 200 new example files + 337 docs edits.
Dispatching parallel haiku/sonnet agents at ~50 blocks each is the
established pattern.

After every batch:
```
npm run lint            # must be 0 errors
npm run type-check      # must be clean
npm run test            # must be 1700+ passing
npm run docs:build      # must succeed
npm run docs:check-includes   # lower ceiling to (count + 10)
```

### 2. RDF/JS spec compliance (Task #62) — library-wide refactor

The user flagged that `QuadInterface` deviates from the rdf/js
industry standard. Current shape (`src/interfaces/Quad.ts`):

```ts
interface QuadInterface {
  graph?: string;
  object: QuadObjectType;     // already an rdf/js-shaped term union
  predicate: string;
  subject: string;
}
```

The standard requires `subject` / `predicate` / `graph` to be Term
objects (NamedNode | BlankNode | DefaultGraph) with an
`.equals()` method, not bare strings. ~30 files touch
`QuadInterface`. Plan:

1. Replace string positions in `QuadInterface` with Term objects
   from `@rdfjs/types` (already a devDependency).
2. Add `equals()` on `QuadInterface` per the rdf/js contract.
3. Use `@rdfjs/data-model` for term construction.
4. Eliminate the `Lift.fromQuad` bridge — external rdf/js quads
   now work without conversion.
5. Update every consumer (`src/modules/rdf/*`, `Lift`, `Projection`,
   `OwlProjection`, `ShaclProjection`, `Materializer`,
   `OntologyBuilder`, `JsonLdFormatter`, tests, examples).
6. Keep the `List` extension (RDF list shorthand) isolated as a
   project-specific addition.

This is its own focused branch / PR. Don't bundle with docs work.

**The user asked for an (a/b/c) preference on scheduling — pause docs
to do this first, run in parallel, or queue after Phase 3 finishes.
They haven't answered. Ask before starting.**

### 3. Bench browser CDN imports

Per the user clarification: "For tests and nodejs benchmarks,
comparison libs are used as peerdeps, for in-browser they are used
from CDN."

Node side is done (devDependencies). Browser side: when a docs page
runs a bench in the browser (e.g. via the docs-site's interactive
bench), comparator libs (zod, valibot, typebox, ajv, io-ts) need to
load from a CDN, not be bundled. Typical implementation:

- Add an `importmap` to `docs/.vitepress/theme/index.ts` or to the
  VitePress head, mapping each comparator to `https://esm.sh/<pkg>`.
- Have the in-browser bench harness import from the bare specifier;
  Vite externalisation plus the importmap handles the rest.
- Verify each comparator at the same version pinned in
  `package.json` is loadable from esm.sh and produces equivalent
  results.

The existing iridis project externalises Vue / PrimeVue / mermaid
via CDN — pattern to follow lives in
`/Users/studs/Workspace/iridis/docs/.vitepress/config.ts`.

### 4. Migration pages

`docs/migration-0.4.0.md`, `docs/migration-0.4.3.md`,
`docs/migration-0.6.0.md` document old behaviour for past readers.
Their inline blocks are historical context, not live API demos. Two
options:

- Move them under `examples/docs/migration/<version>/` if the user
  wants strict ratchet uniformity.
- Or update `scripts/check-docs-includes.mjs` to exclude
  `docs/migration-*.md` from the count.

Pick one explicitly with the user before doing it; this affects the
invariant in ARCHITECTURE.md.

### 5. Bench scenarios for in-docs runnable bench

The bench files are runnable via `npm run bench`. The docs reference
them via `<<<` includes (Phase 3 batch 1 landed `validate.bench`,
`coerce.bench`, etc.). To make the docs *interactive* (the user's
implied goal for in-browser bench): wire each bench into a docs
component that the reader can press Run on. Separate workstream.

---

## How to verify state at session start

```
cd /Users/studs/Workspace/json-tology
git status                       # working tree clean (only this handoff doc maybe)
git log --oneline main..HEAD     # 16 commits since main; the list at the top
npm run test                     # 1178/1178 smoke + unit pass
npm run test:all                 # 1704/1704 full suite pass
npm run lint                     # 0 errors, 50 warnings (all pre-existing)
npm run type-check               # clean
npm run docs:build               # build complete
npm run docs:check-includes      # ✓ 337 <= 427
npm run bench                    # runs to completion
```

If any of those is red, fix it before starting new work.

---

## Working agreement reminders (from CLAUDE.md + this session)

- **No `eslint-disable` without rationale.** Some `unicorn/no-thenable`
  disables are legitimately scoped to JSON Schema's `then` keyword
  with a one-line comment explaining the conflict — that pattern is
  acceptable.
- **No `as any`, no double-cast `as unknown as X`** unless the type
  system genuinely can't express the structure (and even then a
  branded type is preferred).
- **No `Alice`, no generic names** — every name must be either a
  real author or a Neverending Story character with a realistic
  name.
- **Gender-neutral pronouns** for fixture personas.
- **Tests verify behaviour, not exports.** Each example file lives
  or dies by `console.assert`. Tests that only check imports are
  smoke; assertions inside the file are the contract.
- **Commit only on explicit request.** Pre-commit hook honours
  `npm run lint && npm run type-check && npm run test`; never
  `--no-verify`.
- **Update memories** in `/Users/studs/.claude/projects/-Users-studs-Workspace-json-tology/memory/`
  when the user states a new persistent preference or correction.
- The user dispatches parallel agents; favour that pattern for any
  batch >10 files. Sonnet > haiku when the work needs real
  reasoning (lint cleanup, ambiguous edge cases). Haiku is fine for
  mechanical conversions (move inline block → include).

---

## Open tasks in the tracker

| ID | Subject | Status |
|---:|---|---|
| 61 | Phase 3 expansion: ALL inline ts blocks → examples/ | completed (337 still remain — see scope #1 above) |
| 62 | Refactor QuadInterface to follow rdf/js spec | pending — needs user (a/b/c) decision |

(Tasks 53-60 already completed; do not re-open.)

---

## First action when resuming

1. Verify the green state with the commands in the "How to verify"
   section.
2. Ask the user whether to:
   - (a) Continue the inline-ts conversion sweep until the ratchet
     hits 0.
   - (b) Start the rdf/js refactor (Task #62) as its own focused
     workstream.
   - (c) Wire the in-browser bench CDN imports (Scope #3).
   - (d) Tackle the migration-pages question (Scope #4).
3. Whatever the answer, dispatch agents in parallel for any
   batch >10 files, keep the ratchet monotonic, run the verification
   suite before every commit, and commit on the user's explicit
   "commit" / "/loop" trigger.
