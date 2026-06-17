# Proposal: Specialized per-schema validators

**Status: Deferred — not planned.** Recorded for reference. json-tology is at a
stable state (v0.24.1) after recovering the validation throughput regression
(#159); this proposal is intentionally not on the roadmap. Revisit only if
closing the pure-validation gap to ajv/typebox becomes a product requirement.

## Context

json-tology executes validation against the canonical semantic graph (a lossless
representation supporting TBox/ABox reasoning), not a specialized boolean
validator. On pure validation it therefore trails libraries that compile to
straight-line monomorphic code — typebox is ~4.7× faster on `review valid`,
~11.8× on `order valid` (nested `$ref`). json-tology leads on graph-native
operations the comparators do not model (diff, extend/compose, encode, ontology
export).

The v0.24.1 work established that the executor is already a per-schema **tree of
closures** (`typePredicate`, `formatValidator`, `propValidators` map,
`refValidator`, composition validators). The remaining cost is the generic
per-value dispatch that re-checks every optional plan field and threads context
and Maps per node. Specialization targets that dispatch, not the absence of
closures.

## Approaches

**A. Closure fusion (no `eval`).** Compose a minimal closure per schema that
includes only the operations the schema needs — a flat object with N typed
properties becomes one closure of N inlined predicate checks against literal
keys, no per-node dispatch, no Maps. Hand-written fast templates for common
shapes (flat scalar object, scalar leaf, array-of-scalar, single `$ref`); fall
back to the generic executor for exotic schemas. Safe, debuggable, incremental;
recovers much but not all of the gap.

**B. Source codegen (`new Function`).** Emit specialized JS source from the plan
(the ajv/typebox model), compiled once per schema. Fastest; breaks under strict
CSP, larger correctness surface, harder to debug.

Recommended ordering if ever pursued: ship A first, add B behind an explicit,
feature-detected opt-in.

## Integration

- Returns the existing `CompiledValidatorType` — no public API change.
- New lazy cache slot `specializedCompiled?` on the registry entry, mirroring
  `compiled`/`graph`.
- Opt-in via `CompiledValidateOptionsType` (`specialized?`); generic path stays
  the default until a shape is differentially proven equivalent.
- Reads only from `graph.semantics(node)` / the existing plan — **no second
  semantic model, no schema re-parse** (honors the canonical-graph contract).

## Scope boundaries

- Phase 1 is pure validate only (`doCoerce`/`applyDefaults`/`synthesizeDefaults`/
  `stripUnknown` all false); any mutating option dispatches to the generic path.
- `$ref`/`$dynamicRef`/recursive schemas reuse the existing
  `refValidator`/`dynamicRefValidator` closures at boundaries (they already cache
  and break cycles).
- Composition (`allOf`/`anyOf`/`oneOf`/`if`/`unevaluated*`) dispatches to generic
  initially; specialized later.

## Correctness strategy

- **Differential oracle:** the generic executor is the spec. A harness runs every
  fixture plus the conformance suite through both paths and asserts byte-identical
  `ValidationErrors` (same `keyword`/`message`/`params`/`path`, same order),
  sourced from the same `VALIDATION_MESSAGES` constants.
- **Property/fuzz testing:** random schemas × random instances asserting
  specialized ≡ generic. This gates flipping any default.

## Risks

- Error divergence → differential harness blocks merge; reuse the exact message
  constants.
- CSP/`eval` (B) → A needs no eval; B is opt-in and feature-detected.
- Two-executor maintenance drift → A reuses the same leaf predicates; only
  dispatch is specialized.
- Combinatorial shapes → specialize profitable shapes, fall back otherwise, report
  fallback rate.

## Phasing (if revived)

0. Differential + fuzz harness (gate for everything).
1. Closure fusion for flat scalar objects + scalar leaves.
2. Arrays and single-`$ref` chains.
3. Composition + unevaluated.
4. Optional source-codegen backend behind its own flag.
5. Per-shape decision to default to specialized where proven; document on the
   benchmarks page.

## Success metrics (if revived)

`review valid` and `order valid` within ~1.5–2× of typebox; zero differential
failures; reported fallback rate; no regression on generic/coerce/materialize
paths.
