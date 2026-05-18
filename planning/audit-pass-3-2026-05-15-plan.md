# Audit Pass 3 — 2026-05-15

Branch: `chore/audit-pass-3` → PR to `main`. Fail-forward only.

Pass 1 (PR #95) and Pass 2 (PR #96) shipped. v0.7.0 tagged + GPR-published. Remaining gaps surfaced by the pass-3 audit:

## Phase A — Decode-date regression recovery

`Predicates.satisfiesFormat` is a static method with try/catch that exits V8 JIT optimization on the surrounding function. The validator is also at a megamorphic call site. Pass-2 made this worse by inlining the typeof guard into closures with widened signatures.

**Fix.** At `src/modules/graph/GraphEngineScalars.ts:107` (or current line for the equivalent call): call `validator(value)` directly. Remove the try/catch wrapper. Built-in validators never throw.

**Files.** `src/modules/graph/GraphEngineScalars.ts`, `src/modules/validation/Predicates.ts` (delete or repurpose `satisfiesFormat`).

**Acceptance.** Tests green; `decode date` recovers ~25-35%.

---

## Phase B — Dump fast path + dump nested Set guard

**B.1** `Dumper.dumpJson` walks the graph fully and allocates an object tree before `JSON.stringify`. For the no-transform case this is wasted work. Add a fast path: when the schema has no registered transform decoders and the options have no active filters, return `JSON.stringify(value)` directly.

**B.2** `Dumper.dumpObject:148` constructs `new Set<string>(semantics.properties.keys())` unconditionally on every call. The Set is only used when `options.excludeDefaults === true`. Guard behind the flag.

**Files.** `src/modules/data/Dumper.ts`, possibly `src/JsonTology.ts` for the dumpJson facade.

**Acceptance.** Tests green; `dumpJson nested` improves materially (target: at least closes half the gap to JSON.stringify); `dump nested` improves.

---

## Phase C — VisitComposition allocation reduction

**C.1** Replace 6 `{ ...options, 'collectErrors': true }` spreads in `VisitComposition.ts` with a pre-allocated `collectErrorsOptions` sentinel. The two known variants (with vs without collectErrors) can be constructed once per `visit` entry and reused down the branch tree.

**C.2** `VisitComposition.oneOf:207-212` calls `.map()` per invocation to build `variantCache`. Cache via WeakMap keyed on the oneOf node array.

**C.3** `VisitComposition.anyOf:62-64` allocates `successfulResults: InternalExecutionResultInterface[]` unconditionally. Lazy-init on first match.

**C.4** `Compose.extend:310-316` allocates `SKIP_KEYS = new Set([...])` per call. Hoist to module scope alongside the existing `CLASS_AXIOM_BODY_SKIP_KEYS`.

**Files.** `src/modules/graph/visit/VisitComposition.ts`, `src/modules/composition/Compose.ts`.

**Acceptance.** Tests green; discriminated-union improves; warm composition paths reduce allocations.

---

## Phase D — RDF / Lift / Skolemize hot loops

**D.1** `Lift.findPropertyQuads:269` does two `.filter()` per property. Build a per-subject predicate index once per `liftSubject` call; replace filters with Map lookups.

**D.2** `JsonLdFormatter.ts:171` uses `{ ...inlined }` + `delete @id`. Replace with a targeted-copy that skips `@id` during construction.

**D.3** `Skolemize.ts:61` uses `hex.push(...)` 16 times then `join`. Replace with direct string assembly via index arithmetic on the Uint8Array. Only the fallback path (no `crypto.randomUUID`) is affected.

**D.4** `JsonTology.dumpJson` does `{ ...options, mode: 'json' }` per call. Guard: when `options === undefined`, allocate a fixed sentinel.

**Files.** `src/modules/rdf/Lift.ts`, `src/modules/rdf/JsonLdFormatter.ts`, `src/modules/rdf/Skolemize.ts`, `src/JsonTology.ts`.

**Acceptance.** Tests green; RDF subsystem allocates less per call.

---

## Phase E — Benchmark correctness

**E.1** The `intersection` (24×) and `extend + validate` (7.93×) bench scenarios construct `new SchemaRegistry()` and register schemas inside the inner loop. They measure registry construction + graph lowering + compile + validate per iteration. Production callers warm the registry once.

**Fix.** Update `examples/docs/benchmarks/compose.bench.ts` (and any other affected bench file) to construct the registry and register schemas once outside the bench loop. The bench loop should call only `reg.validate(...)`. Add a comment noting why.

**Files.** `examples/docs/benchmarks/compose.bench.ts`, plus any other bench file with the same anti-pattern.

**Acceptance.** Tests still pass; bench re-runs and the corrected numbers match the discriminated-union scenario shape (~6× behind typebox, not 24× behind zod).

---

## Phase F — Standards sweep (pass-3)

**F.1** Move 2 inline interfaces:
- `src/modules/graph/RefDecoder.ts:14` `RefDecoderRegistryInterface` → `src/interfaces/RefDecoderRegistry.ts`
- `src/modules/loaders/Loaders.ts:15` `FetchLoaderOptionsInterface` → `src/interfaces/FetchLoaderOptions.ts`

**F.2** Move 10 module-scope constants:
- `Compose.ts:39` `CLASS_AXIOM_BODY_SKIP_KEYS` → `src/constants/COMPOSITION.ts` (file exists from pass-2)
- `StructuralHash.ts:10` `METADATA_KEYS` → `src/constants/STRUCTURAL_HASH.ts` (new)
- `SchemaGraphSupport.ts:252` `PRIMITIVE_CONSTRAINT_KEYWORDS` → `src/constants/SCHEMA_KEYWORDS.ts` (append)
- `SchemaGraphSupport.ts:266` `PRIMITIVE_TYPES` → `src/constants/SCHEMA_KEYWORDS.ts` (append)
- `Lift.ts:94` `XSD_COERCERS` → `src/constants/XSD_MAPS.ts` (append)
- `OwlProjection.ts:250` `CARDINALITY_KINDS` → `src/constants/ONTOLOGY_PREDICATES.ts` (append)
- `Projection.ts:81` `SIMPLE_LITERAL_PREDICATES` → `src/constants/ONTOLOGY_PREDICATES.ts` (append)
- `Projection.ts:207` `IRI_PREDICATES` → `src/constants/ONTOLOGY_PREDICATES.ts` (append)
- `Projection.ts:295` `SPECIAL_HANDLERS` → `src/constants/ONTOLOGY_PREDICATES.ts` (append)
- `SchemaRegistry.ts:63` `EMPTY_VALIDATION_ERRORS` — frozen singleton, OK as module-scope; SKIP this one

**F.3** Magic-string sweep in `JsonTology.ts`. The literals `'$id'`, `'$ref'`, `'$defs'`, `'$schema'` appear 100+ times. Reference `src/constants/SCHEMA_KEYWORDS.ts` constants instead. Where the constant doesn't exist yet, add it.

**F.4** Delete orphan file `src/modules/data/Result.ts`. It only re-exports from `src/interfaces/Result.ts`. No callers (verify with grep).

**Files.** Many; this is the standards sweep.

**Acceptance.** Tests green; lint/type-check green; greppable for `'\$id'` and `'\$ref'` shows hits only in constants, tests, examples, and docs.

---

## Phase G — ARCHITECTURE.md refresh

`ARCHITECTURE.md` is stale after pass-1 and pass-2:
- Pass-1 deleted 4 SchemaCompiler files; pass-1 added SchemaCompilerPlan, SchemaEntryStore, SchemaRefWalker, RefResolutionLoader.
- Pass-2 added 8 files in `src/constants/` and 3 in `src/interfaces/`.

Rebuild the file-inventory section to match current state. Update the module-direction diagrams if any.

**Files.** `ARCHITECTURE.md`.

**Acceptance.** Inventory reflects current `src/` tree.

---

## Phase H — Wrap-up

**H.1** Re-run `npm run bench:report`. Commit results.

**H.2** Update `CHANGELOG.md` `[Unreleased]` with pass-3 sections.

**H.3** Open PR to main; wait for green CI; squash-merge.

---

## Execution order

1. **Wave 1 (parallel, disjoint files):** A, B, C, D, E
2. **Wave 2 (parallel):** F, G
3. **Wave 3:** H (bench + changelog + PR)

Each phase ends with `npm run test:all` + `npm run type-check` + `npm run lint` green and one conventional commit.
