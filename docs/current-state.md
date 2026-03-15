# Current State

This file is a high-level snapshot, not the active implementation plan.

Verification status should be taken from the latest implementation run, not from this document.

## Status

The graph-native implementation is operational.

As of 2026-03-14, the latest full verification pass is clean:

- `npm run build`
- `npm run type-check`
- `npm run test` -> 631 passing
- `node ./node_modules/typescript/bin/tsc --noEmit --project tsconfig.test-types.json`
- `npm run pack:check`
- `npm run bench`

What is implemented:

- JSON Schema as the authored source language
- project-owned compile-time type inference over schema literals
- external `$ref` compile-time inference through explicit references maps
- sound branch-union approximation for compile-time `if/then/else`
- canonical graph construction with semantics, relations, anchors, and NormIR
- graph-native validation with compiled and interpreted execution paths
- materialization plus quad-based ABox projection
- OWL JSON-LD and SHACL JSON-LD output via quad-backed adapters
- SHACL JSON-LD annotations for graph semantics not expressible in SHACL Core
- schema round-trip and graph artifact rehydration
- broader artifact round-trip coverage for anchors, conditionals, `contains`, and pattern properties
- production-hardened package surface, CLI path coverage, and registration rollback integrity
- reproducible benchmark command with smoke coverage for the compiled benchmark path

## Source of Truth

- Architecture, remediation, and active implementation plan: [`architecture-plan.md`](./architecture-plan.md)

## What Is Next

There is no open migration or hardening workstream at the moment.

Future changes should be opened as new scoped efforts and must follow the TDD
and verification rules in [`architecture-plan.md`](/Users/studs/Workspace/json-tology/docs/architecture-plan.md).
