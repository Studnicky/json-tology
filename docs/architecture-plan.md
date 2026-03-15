# Architecture And Implementation Plan

This is the single live plan document for the repository.

All still-incomplete workstreams are tracked here. Older sidecar plan documents have been removed so there is one source of truth for architecture, remediation, and expansion work.

## Contract

json-tology has one authored source and three first-class consumers:

1. TypeScript compile-time inference from `as const` JSON Schema.
2. Runtime validation and materialization over the canonical graph.
3. JSON-LD serialization of both schema structure (TBox) and validated instances (ABox).

JSON Schema is the authored form. The canonical graph is the runtime artifact. JSON-LD output is projected from that graph. The implementation must not drift into separate semantic engines for typing, validation, ontology, or instance projection.

## Non-Negotiable Invariants

These rules govern every remaining workstream:

1. JSON Schema remains the authored source language.
2. `@types/json-schema` remains the intentional standards dependency for authoring types.
3. The graph remains the shared runtime artifact.
4. Validation semantics come from graph semantics, not serializer-specific logic.
5. RDF semantics are emitted as JSON-LD only in-core.
6. `materialize()`, `parse()`, `create()`, and `abox()` remain views over one runtime execution model.
7. Schema round-trip must stay lossless for the supported keyword surface.
8. Type inference must either model behavior correctly or fall back explicitly. Silent misresolution is not acceptable.
9. Versioning happens in git and releases, not in production runtime code.
10. Do not preserve backward compatibility via dual implementations, legacy loaders, or version branches inside active codepaths.
11. Completion claims must reflect the code that exists now, not the intended direction.

## Verified Current State

The architectural migration, production-readiness hardening, and current
expansion slice are complete.

Completed and verified:

1. Legacy compatibility paths were removed from graph artifacts. There is one canonical artifact shape, one load path, and legacy artifacts fail loudly with regeneration guidance.
2. The publish surface is controlled. Builds clean `dist`, `package.json` uses an explicit `files` allowlist, and a committed pack-surface regression script validates the tarball.
3. Schema registration is atomic. Failed registration is a no-op and failed overwrite attempts preserve the prior valid entry and caches.
4. Transform contracts are aligned. `parse()` is decoded, while `materialize()` and `encode()` are typed and implemented as wire-form.
5. Public docs and exported surfaces were aligned. README examples use supported APIs, stale `json-schema-to-ts` claims were removed, and public API smoke coverage exists in `test/types`.
6. The shipped CLI is the CLI that is tested. Integration coverage runs the built `dist/cli.js`, verifies the published bin path, and locks the supported schema-path behavior in place.
7. Logger and loader posture is intentional. Routine trace logging no longer emits stack traces, and `SchemaLoader` is explicitly documented and tested as a lightweight filesystem loader rather than a standards validator.
8. Compile-time inference was expanded where the improvement is materially useful. External `$ref` resolution now supports explicit references maps, and `if/then/else` uses a documented sound branch-union approximation instead of collapsing to `unknown`.
9. SHACL JSON-LD coverage was expanded for graph semantics that SHACL Core cannot express directly. The serializer now emits explicit `jt:*` annotations for `multipleOf`, `minItems`, `maxItems`, and `uniqueItems`.
10. Artifact hardening expanded beyond the original corpus. Round-trip coverage now includes richer graphs with anchors, dynamic anchors, `contains`, `patternProperties`, and conditionals.
11. Benchmark reproducibility is verified. `npm run bench` completes cleanly, and the compiled-vs-interpreted benchmark path is locked down by a smoke test so nested-ref regressions fail in CI.

Latest verified commands:

- `npm run build`
- `npm run type-check`
- `npm run test`
- `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.test-types.json`
- `npm run pack:check`
- `npm run bench`

Latest verified result:

- runtime suite: 631 passing tests
- compile-time type suite: clean
- publish-surface check: clean
- benchmark command: clean

## Current Status

There is no open migration or hardening workstream in the repository right now.

Future work should be opened as new scoped efforts when the project chooses to
expand standards coverage, DX evidence, or interoperability beyond the current
surface. Those future efforts must keep the same invariants and TDD discipline
defined below.

## Compatibility Policy

This repository does not preserve backwards compatibility inside the codebase through versioned interfaces, fallback loaders, or dual implementations.

When a representation changes:

1. keep one current implementation in code
2. reject old representations loudly
3. document the break
4. rely on git history and release versioning for historical access

## Required TDD Workflow

Every workstream in this plan must follow strict TDD:

1. Write or update the failing test first.
2. Run the focused test and confirm the failure is the intended one.
3. Implement the smallest change that makes the test pass.
4. Rerun the focused suite.
5. Run the full verification set.
6. Update docs only after code and tests match the new claim.

## Required Verification Commands

These are mandatory before claiming any future workstream is complete:

- `npm run build`
- `npm run type-check`
- `npm run test`
- `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.test-types.json`
- `npm run pack:check`
- `npm run bench` for any work that touches benchmarked paths or introduces
  performance / ergonomics claims

## Completion Rule

Do not mark any new workstream “done” because the current suite is green.

It is only acceptable to claim completion for a workstream when:

- the code change exists
- the focused regression tests exist
- the full verification commands pass
- the docs describe the implemented state accurately
