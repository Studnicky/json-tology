# Plan: OWL-2 axiom import fidelity (lossless TBox ↔ schema round-trip)

Status: proposed
Owner: (json-tology agent)
Consumer: OWL TBox bootstrap migration — import json-tology schemas FROM an existing
hand-authored OWL TBox (e.g. the bookstore domain), then regenerate the TBox from those schemas
with no loss. Goal: the schemas are the *sole* canonical source; `fromTbox` → schemas → `toTbox`
is semantically idempotent.

## Why

A real-world bootstrap of a large OWL TBox through `JsonTology.fromTbox(quads)` round-trips
the structural backbone well (classes, `subClassOf`, properties, functional characteristics) but
DROPS four formal OWL-2 axiom categories. The **emit** path (`toTbox` / `OwlProjection`) can
already produce three of them; the **import** path cannot reconstruct them. Closing the import
gaps makes "schemas as single source of truth" fully achievable without any hand-authored supplement.

## Current state (verified, file:line)

Emit (`src/modules/rdf/OwlProjection.ts`) — already emits:
- `owl:disjointWith` (line ~529–534)
- `owl:equivalentClass` (line ~385, ~509–514)
- `owl:withRestrictions` with `xsd:minInclusive`/`xsd:maxInclusive` facets (line ~372, ~226–269)
- `owl:Restriction`, cardinality, `someValuesFrom`.

Import (`src/modules/ontology/importDispatch/`) — gaps:
- `ClassAxioms.ts` dispatches `owl:disjointWith`, `owl:disjointUnionOf`, `owl:equivalentClass`
  — but NOT `owl:AllDisjointClasses`.
- `PropertyRestrictions.ts` handles `owl:allValuesFrom` / `min|maxCardinality` — but ignores the
  `owl:withRestrictions` facet list inside a datatype range restriction.
- `owl:disjointWith` import is single-valued (last-wins); a class disjoint with N partners loses
  all but one.
- `owl:equivalentClass` to an EXTERNAL ontology IRI (e.g. `obo:BFO_*`) is reconstructed as a
  structural `$ref` to a non-existent registered schema → broken `$ref`.

Observed bootstrap loss: 0/4 `AllDisjointClasses` blocks, 27 `withRestrictions` facet shapes,
all multi-partner disjointness, and ~129 BFO `equivalentClass` mangled into bad `$ref`s.

## Required capabilities (all on the IMPORT path + round-trip tests)

### 1. `owl:AllDisjointClasses` import
Add a dispatcher (in `ClassAxioms.ts`) that detects `[ a owl:AllDisjointClasses ; owl:members ( C1 C2 … Cn ) ]`, walks the `owl:members` list (`ctx.graph.collectList`, already used for `disjointUnionOf`), and represents the group so it (a) survives in the schema graph and (b) re-emits as the SAME construct (or an equivalent pairwise `owl:disjointWith` set) via `toTbox`. Prefer preserving the group form to keep round-trip exact.

### 2. Multi-partner `owl:disjointWith`
Change the disjointness representation from a single value to a SET. A class may be `disjointWith`
multiple classes; all partners must round-trip. (Symmetric per OWL 2 — keep the existing symmetry
handling, just make the container multi-valued.) Verify `OwlProjection` emits one
`owl:disjointWith` quad per partner.

### 3. `owl:withRestrictions` datatype facets → JSON-Schema constraints
In `PropertyRestrictions.ts`, when an `owl:Restriction` has `owl:allValuesFrom [ a rdfs:Datatype ;
owl:onDatatype xsd:T ; owl:withRestrictions ( [xsd:minInclusive m] [xsd:maxInclusive n] … ) ]`,
map the facets onto the property's JSON-Schema constraints: `minInclusive→minimum`,
`maxInclusive→maximum`, `minExclusive→exclusiveMinimum`, `maxExclusive→exclusiveMaximum`,
`xsd:minLength→minLength`, `xsd:maxLength→maxLength`, `xsd:pattern→pattern`. This closes the loop
with the emit side, which already renders these facets from the same JSON-Schema constraints
(`OwlProjection.ts:226–269,372`).

### 4. External-ontology `owl:equivalentClass` (alignment, not structure)
When the `equivalentClass` target is NOT a registered/known schema IRI (e.g. `obo:BFO_*`), do NOT
emit a structural `$ref`. Represent it as an alignment annotation (e.g. `x-owl-equivalentClass:
[iri, …]`) that `toTbox` re-emits as `owl:equivalentClass <iri>`. Keep the existing structural
`$ref` behavior ONLY when the target is a registered class. Distinguish the two by registry
membership at import time.

## Canonical-graph mandate (per json-tology CLAUDE.md)
Model each of these as relations in the schema graph (`src/modules/graph/SchemaGraph.ts`) consumed
by BOTH import (lift) and emit (`OwlProjection`) and by `validate`/`materialize` — no second code
path that special-cases these outside the graph. This mirrors the constraint placed on the
triple-term plan.

## Acceptance criteria — idempotent round-trip
Add `test/` fixtures derived from bookstore domain TBox patterns:
- `owl:AllDisjointClasses ( Book EBook PrintBook )`
- a class with `owl:disjointWith` to 3+ partners (e.g. `EBook disjointWith PrintBook, RareBook, SignedFirstEdition`)
- `bk:rating` datatype range `xsd:integer [minInclusive 1; maxInclusive 5]`, `bk:pageCount`
  `[1..9999]`, a string `maxLength`/`pattern` (e.g. `bk:isbn`)
- `owl:equivalentClass schema:Book` (external — Schema.org alignment)

For each: assert `fromTbox(ttl) → schemas → toTbox().quads()` reproduces the SAME axiom set
(compare triple sets modulo bnode labels and list ordering). The 4 categories must show ZERO
loss. Add a single end-to-end test importing a multi-axiom TBox and asserting idempotence.

## Out of scope
- New emit capability (emit already handles disjointWith/equivalentClass/withRestrictions; only
  verify multi-partner + AllDisjointClasses group emission).
- SHACL changes beyond what facet round-trip needs.

## Pointers
- Import dispatchers: `src/modules/ontology/importDispatch/ClassAxioms.ts`,
  `PropertyRestrictions.ts`, `Datatypes.ts`.
- Emit: `src/modules/rdf/OwlProjection.ts`.
- Schema graph: `src/modules/graph/SchemaGraph.ts`, `GraphEngine.ts`.
- List walking: `ctx.graph.collectList` (used for `disjointUnionOf`).
- Compose helpers that already declare these from the schema side: `Compose.disjointWith`,
  `Compose.equivalent` (`src/modules/composition/Compose.ts`).
