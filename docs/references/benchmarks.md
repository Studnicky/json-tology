# Benchmarks

> **json-tology is not yet uniformly faster than its comparators. Where we win, where we lose, and where we have work to do.**

This page is the honest read on json-tology's performance against five comparators: AJV, Zod, TypeBox (interpreted `Value` and compiled `TypeCompiler`), Valibot, and io-ts. The numbers below come from the bench suite under `bench/`. Run `npm run bench:report` to regenerate.

The headline: today, json-tology loses most warm validation scenarios to TypeBox compiled, and loses some warm scenarios to AJV / Valibot / io-ts. It wins at structural diff, transform encode, schema authoring (extend build), and validating invalid simple data with full error collection. Most of the loss surface comes from the canonical-graph-first execution model: every validate goes through the graph, which buys downstream features (ABox projection, OWL/SHACL emission, semantic round-trip) but pays a per-call cost a code-gen-only validator does not.

We're publishing the full picture rather than cherry-picking. Where we are slow, we say so.

## How to read this page

- `WIN` — json-tology is at least 1.05x faster than the comparator on the listed scenario.
- `LOSS` — json-tology is at least 1.05x slower.
- `EVEN` — within 5% either way.
- `ops/s` — operations per second after warmup. Higher is better.
- `ns/op` — nanoseconds per operation. Lower is better.
- `json-tology vs this` — the multiplier between json-tology and the listed library. "2.39x faster" means json-tology runs 2.39 ops for every 1 op of the comparator on this scenario.

The latest run is auto-generated from `bench/results/latest.md` and is included in full at the end of this page.

## What's in scope

The bench suite covers the operations json-tology actually exposes:

| Suite | json-tology surface | Comparators |
| - | - | - |
| Validation | `registry.validate` | AJV `validate`, TypeBox `TypeCompiler.Check`, Zod `safeParse`, Valibot `safeParse`, io-ts `decode` |
| Instantiation | `registry.instantiate` (no coercion) | TypeBox `Value.Parse`, Zod `parse`, Valibot `parse`, io-ts `decode` |
| Coerce | `registry.instantiate` with `castTypes: true`, defaults | TypeBox `Value.Parse`, Zod `parse`, Valibot `parse`, io-ts `decode` |
| Value operations | `Value.clone`, `Value.diff`, `registry.clean`, `registry.convert` | TypeBox `Value.Clean / Convert / Diff`, `structuredClone` |
| Transforms | `Transform.create` decode + facade `encode` | TypeBox `Value.Decode / Value.Encode`, Zod `.transform`, io-ts custom codec `decode`/`encode` |
| Composition | `Compose.extend / intersection / discriminatedUnion` | TypeBox `Type.Composite / Intersect / Union`, Zod `.extend / intersection / discriminatedUnion`, Valibot `variant` |
| Serialization | `dump`, `dumpJson`, facade `encode` | `JSON.stringify`, `structuredClone`, TypeBox `Value.Encode` |
| Registry | cold register + first validate, warm validate | TypeBox `TypeCompiler.Compile + Check`, Zod, Valibot |
| Compiled vs Interpreted | `SchemaCompiler` vs `GraphEngine.execute` | internal — measures the speedup of the compile path |

## What's unique

These are operations no comparator implements, so they appear only as a single-library row in the report. They are included for completeness, not as head-to-head wins.

- `toTbox` — OWL TBox projection from the canonical graph.
- `toShacl` — SHACL shape projection.
- `toQuads` / `fromQuads` — RDF round-trip via projection.
- ABox projection through `Materializer.projectAbox`.
- `findDuplicates` over the registry.
- The `jt:` keyword set (computed properties, invariants, decoders, brands).
- OWL / SHACL emission through `OntologyBuilder`.

These are surface area that competitors do not expose. They are not wins; they are work the competitors do not do.

## Where we have work to do

Pulled directly from `bench/results/latest.md`. These are scenarios where json-tology is more than 5x slower than the median comparator. Each is a known issue.

- `simple valid` validation (~6x slower than median) — the per-validate graph traversal cost dominates a 5-property flat schema. Tracked: rework hot path so flat schemas skip subgraph dispatch when no $refs are present.
- `nested valid` validation (~7x slower than median) — same root cause as `simple valid`, amplified by per-property subschema lookup. Tracked: precompile a flattened property dispatch table per schema graph.
- `convert simple` (~32x slower than TypeBox) — `castTypes: true` runs a separate normalize pass over the value before validate. Tracked: fold normalize into the compiled validator.
- `extend + validate` cold path (~12x slower than TypeBox) — registering a derived schema rebuilds the canonical graph from scratch per call. Tracked: cache subgraph fragments at register time.
- `intersection` cold path (~12x slower than Zod) — same root cause as `extend + validate`.
- `dumpJson nested` (~8x slower than `JSON.stringify`) — `dump` walks the schema graph for every property. Tracked: short-circuit when no Transform encoders are attached anywhere in the subgraph.
- `discriminated union` warm (~74x slower than TypeBox compiled) — every variant is currently re-resolved through `oneOf` semantics. Tracked: discriminator-aware fast path that switches directly on the discriminator key.
- `cold first validate` (~156x slower than Valibot) — Valibot has no compile step at all; the cold path is the warm path. Our cold path includes graph construction, subschema linking, and JIT compilation. Acceptable cost because subsequent calls are fast, but the gap is honest. Tracked: lazy subgraph build for unreachable parts of the schema.

If we are slower on a scenario by more than 5x, you can expect a corresponding tracked item above. None of these are blockers for using the library — but they are real, and we are working on them.

## Reproduce

```bash
npm install
npm run bench:report
```

The runner prints to console and writes `bench/results/latest.md`. Bench numbers move with hardware. The values embedded below came from the developer machine listed in the Environment section. CI runs are uploaded as workflow artifacts (see `.github/workflows/bench.yml`); use those as the canonical reference once bench-in-CI is established.

For deeper investigation:

```bash
npm run bench         # human-readable console output, no markdown
npm run bench:flame   # 0x flame graph profiling under .flame/
```

## Latest run

The block below is auto-generated. To refresh it, run `npm run bench:report`.

<!--@include: ../../bench/results/latest.md-->
