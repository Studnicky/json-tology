# Expansion and Hardening Plan

## Purpose

This document turns the high-level expansion and hardening tracks into executable work.

It does not reopen completed graph-native migration work. It assumes the current architecture is in place and focuses on:

1. expanding standards coverage
2. hardening exports and artifacts
3. improving performance and developer experience confidence

## Execution Order

Work should be executed in this order unless a later item is blocking a user-facing regression fix.

### Phase 1: Export Surface Hardening

Goal: make the public build/export surface match the architecture contract and remain reproducible.

Tasks:

1. Keep the CLI export surface JSON-LD-only for ontology and SHACL output.
2. Keep schema/artifact/ontology/SHACL export file naming stable and test-covered.
3. Document format support and compatibility expectations.

Acceptance criteria:

- CLI supports JSON artifact, JSON Schema, ontology JSON-LD, and SHACL JSON-LD.
- CLI tests cover all supported formats.
- Export outputs are deterministic for the same schema set and format.

Required tests:

- CLI tests for each format.
- Focused ontology/shacl builder tests if formatter behavior changes.

### Phase 2: Artifact Compatibility Hardening

Goal: make graph artifacts safer to store, compare, and rehydrate across versions.

Tasks:

1. Add explicit artifact compatibility metadata beyond the raw version number where needed.
2. Strengthen stale-artifact detection coverage across more schema corpora.
3. Document the v1/v2 compatibility contract and forward-change policy.

Acceptance criteria:

- artifact compatibility rules are encoded in tests
- rehydration behavior is deterministic and documented
- stale artifacts fail loudly with actionable errors

Required tests:

- graph artifact compatibility tests
- round-trip and rehydration regression tests

### Phase 3: Standards Coverage Expansion

Goal: close more of the shared capability envelope across JSON Schema, TypeScript inference, OWL, SHACL, and AJV-like validation behavior.

Tasks:

1. Audit current type inference fallbacks and prioritize the highest-value precision gaps.
2. Expand SHACL and OWL projection coverage for supported graph semantics.
3. Add parity-oriented runtime tests for undercovered JSON Schema features.
4. Keep unsupported compile-time cases explicit and documented.

Acceptance criteria:

- newly claimed features are backed by runtime tests and type tests
- compile-time fallbacks are intentional and documented
- projection coverage grows without introducing serializer-local semantics

Required tests:

- type tests in `test/types`
- runtime behavior tests in `test/unit`
- projection tests for OWL/SHACL output

### Phase 4: Performance and DX Hardening

Goal: make the implementation more trustworthy at scale and easier to use.

Tasks:

1. Expand benchmark coverage for compiled vs interpreted execution.
2. Add larger-schema and larger-registry benchmarks or regression tests.
3. Tighten public DX coverage for compose/materialize/registry flows.

Acceptance criteria:

- performance claims are benchmark-backed
- DX claims are covered by public API tests, not just internals
- no benchmark claim lands in docs without a reproducible command path

Required tests:

- benchmark harness updates
- public API regression tests where DX claims are made

## Current Implementation Slice

Completed in this pass:

- Phase 1, task 1: JSON-LD-only ontology export support in the CLI
- Phase 1, task 2: JSON-LD-only SHACL export support in the CLI
- consumer-configurable `--base-iri` for CLI ontology exports
- consumer-configurable `--output-file` override for single-file CLI exports
- test coverage for the supported export formats

Next recommended slice:

- Phase 2, task 1: enrich graph artifact compatibility metadata and document the contract precisely

## TDD Rules

Every item in this plan must follow the same workflow:

1. write the failing test first
2. run the focused test and confirm the failure
3. implement the smallest fix
4. rerun the focused suite
5. rerun:
   - `npm run type-check`
   - `npm run test`
   - `npx tsc --noEmit --project tsconfig.test-types.json`
6. only then update documentation or claim completion
