---
title: Benchmarks
description: Performance comparisons between json-tology and AJV, Zod, TypeBox, Valibot, io-ts, ArkType, Runtypes, and Node built-ins. Every scenario runs in your browser; canonical Node numbers are appended below.
---

# Benchmarks

json-tology's performance against comparators: **AJV**, **Zod**, **TypeBox** (compiled `TypeCompiler`), **Valibot**, **io-ts**, **ArkType**, **Runtypes**, plus `JSON.stringify` and `structuredClone` for serialization and clone scenarios.

> **Every scenario below has a `▶ Run in browser` button.** Each loads only the libraries it needs from their `esm.sh` CDN entries on demand — nothing is bundled into the docs site. Browser timing is coarser than Node — variance is high, other tabs steal CPU, and engine differences move the absolute numbers. Use the in-browser runs for directional comparison; the **Latest run (Node)** section at the bottom is the canonical reference. Source: [`examples/docs/benchmarks/`](https://github.com/Studnicky/json-tology/tree/main/examples/docs/benchmarks).

## How to read the tables

- **ops/s** — operations per second after warmup. Higher is better.
- **ns/op** — nanoseconds per operation. Lower is better.
- **vs json-tology** — ratio against the json-tology row in the same table.
- **— (dash)** — library does not run this scenario, or hit a load/setup error (hover the row for detail).

---

## Validation

`registry.validate` against AJV `validate`, TypeBox `TypeCompiler.Check`, Zod `safeParse`, Valibot `safeParse`, ArkType, io-ts `decode`. Source: [`validate.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/validate.bench.ts).

### simple valid

Flat 3-property object that satisfies the schema.

<BenchmarkScenario id="validation-simple-valid" />

### simple invalid

Flat 3-property object that fails every constraint — measures error-collection cost.

<BenchmarkScenario id="validation-simple-invalid" />

### nested valid

Nested object with `$ref` sub-schemas; the cross-schema reference case.

<BenchmarkScenario id="validation-nested-valid" />

---

## Instantiation

`registry.instantiate` (no coercion) against TypeBox `Value.Parse`, Zod `parse`, Valibot `parse`, ArkType, io-ts `decode`. Source: [`instantiate.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/instantiate.bench.ts).

### instantiate simple

Parse + normalize a flat object; no coercion.

<BenchmarkScenario id="instantiate-simple" />

### instantiate nested

Parse + normalize a nested object.

<BenchmarkScenario id="instantiate-nested" />

---

## Coerce

`registry.instantiate` with `castTypes: true` against Zod's `z.coerce.*`. Source: [`coerce.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/coerce.bench.ts).

### coerce valid

Already-valid data through the coerce path.

<BenchmarkScenario id="coerce-valid" />

### coerce defaults

Apply default values during instantiate.

<BenchmarkScenario id="coerce-defaults" />

---

## Value operations

`Value.clone`, `Value.diff`, `registry.clean`, `registry.convert` against `structuredClone`. Source: [`valueOps.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/valueOps.bench.ts).

### clean simple

Strip unknown keys from a flat object.

<BenchmarkScenario id="clean-simple" />

### clean nested

Strip unknown keys from a nested object.

<BenchmarkScenario id="clean-nested" />

### convert simple

String → number / boolean coercion only.

<BenchmarkScenario id="convert-simple" />

### clone nested

Deep-clone a nested object.

<BenchmarkScenario id="clone-nested" />

### diff nested

Compute a changeset between two nested objects.

<BenchmarkScenario id="diff-nested" />

---

## Serialization

`dump`, `dumpJson` against `JSON.stringify` and `structuredClone`. Source: [`serialize.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/serialize.bench.ts).

### dump nested

Serialize a nested object via the json-tology dump pipeline.

<BenchmarkScenario id="dump-nested" />

### dumpJson nested

Serialize a nested object to a JSON string.

<BenchmarkScenario id="dumpJson-nested" />

---

## Registry

`warm validate` measures the hot path after the registry has been primed. Source: [`registry.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/registry.bench.ts).

### warm validate

Validate after registration; hot path. Equivalent to the validation scenarios above but presented in the registry family for symmetry with the Node bench report.

<BenchmarkScenario id="registry-warm-validate" />

---

---

## Node-only scenarios

The scenarios below appear in the **Latest run (Node)** report at the bottom of this page but are deliberately not exposed as browser runners. Each has a specific reason — measuring them in-browser would mislead more than it informs.

### Composition (`extend + validate`, `intersection`, `discriminated union`) — cold/warm

**Why Node-only:** composition timing is setup-dominated. The cold path includes graph construction + subschema linking + JIT compilation; the warm path measures one compiled validator. The mix of cold/warm in a hot loop is library-specific and produces noisy in-browser numbers that misrepresent the steady-state cost. The Node bench [`compose.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/compose.bench.ts) measures each phase deterministically.

### Transforms (`decode date`, `encode date`, `encode event`)

**Why Node-only:** the Transform encoder/decoder takes a schema with a registered codec (`decoders` + `encoders` keyword set) and the timing depends on how the canonical graph caches the codec dispatch table. A one-button click can't faithfully reproduce the registry-warmed state that the Node suite measures in [`transform.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/transform.bench.ts) and [`serialize.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/serialize.bench.ts).

### `cold first validate`

**Why Node-only:** measures the cost of *registering and JIT-compiling* a schema for the very first time, before any caches are warm. Browsers don't expose a way to fully discard module-level state between iterations — the second iteration in the loop is already warm even if the per-call API is reset. The Node bench [`registry.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/registry.bench.ts) constructs a fresh registry per iteration.

### Compiled vs Interpreted (`compiled simple valid`, `compiled simple invalid`, `compiled nested valid`)

**Why Node-only:** this is a json-tology-internal A/B between `SchemaCompiler` and `GraphEngine.execute` on the same registered schema. No peer library has an equivalent surface — there's nothing to compare against in-browser, only against itself. Source: [`compiled.bench.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/compiled.bench.ts).

---

## What's unique to json-tology

Operations no comparator implements. These appear in the Node bench report as single-library rows and are included for completeness, not as head-to-head wins.

- `toTbox` — OWL TBox projection from the canonical graph.
- `toShacl` — SHACL shape projection.
- `toQuads` / `fromQuads` — RDF round-trip via projection.
- ABox projection through `Materializer.projectAbox`.
- `findDuplicates` over the registry.
- The `jt:` keyword set (computed properties, invariants, decoders, brands).
- OWL / SHACL emission through `OntologyBuilder`.

## Known gaps

Scenarios where json-tology is more than 5× slower than the median comparator. Each is tracked.

- `simple valid` validation (~6× slower than median) — the per-validate graph traversal cost dominates a 5-property flat schema. *Tracked: rework hot path so flat schemas skip subgraph dispatch when no `$ref`s are present.*
- `nested valid` validation (~7× slower than median) — amplified by per-property subschema lookup.
- `convert simple` (~32× slower than TypeBox) — `castTypes: true` runs a separate normalize pass over the value before validate.
- `extend + validate` cold path (~12× slower than TypeBox) — registering a derived schema rebuilds the canonical graph from scratch per call.
- `intersection` cold path (~12× slower than Zod) — same root cause as `extend + validate`.
- `dumpJson nested` (~8× slower than `JSON.stringify`) — `dump` walks the schema graph for every property.
- `discriminated union` warm (~74× slower than TypeBox compiled).
- `cold first validate` (~156× slower than Valibot).

## Reproduce locally

The benchmark suite is identical to what the in-browser runner uses for setup — every comparator loaded from its real npm package, no mocks. Clone, install, run:

```bash
git clone https://github.com/Studnicky/json-tology.git
cd json-tology
npm install
npm run bench:report
```

The runner prints to console and writes `examples/docs/benchmarks/results/latest.md` (auto-included as **Latest run (Node)** below).

```bash
npm run bench         # human-readable console output, no markdown
npm run bench:flame   # 0x flame graph profiling under .flame/
```

The harness ([`harness.ts`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/harness.ts)) is intentionally minimal: `performance.now()` timing, fixed warmup + iteration count per scenario, no third-party bench framework.

## Latest run (Node)

Auto-generated by `npm run bench:report`. Source: [`examples/docs/benchmarks/results/latest.md`](https://github.com/Studnicky/json-tology/blob/main/examples/docs/benchmarks/results/latest.md). This is the canonical reference — the in-browser runs above are directional.

<!--@include: ../examples/docs/benchmarks/results/latest.md-->

## See also

- [Library comparisons](/comparisons) — feature matrix across 11 validators / codecs / ontology tools.
- [References](/references) — outbound links to every comparator's documentation.
