# Plan: Canonical (shared-vocabulary) predicate projection — DEFAULT (opt-out)

Status: accepted — strict-by-default. BREAKING CHANGE, no backwards-compat, no shims.
Owner: (json-tology agent)
Consumer: Pokemontology migration — emit a PUBLISHED OWL knowledge graph (shared `pkm:`
predicates) from json-tology schemas, not class-scoped per-type predicates.

## Decision (Opus review 2026-05-28): canonical is the DEFAULT, class-scoped is opt-out

Per the project's strict-by-default convention (`feedback_strict_by_default`; precedent
`enableStrictGraph`, which is default-`true` and relaxed via `false`), this strictness rule is
**opt-out, not opt-in**:

- **Canonical/shared predicates are the DEFAULT.** The class-scoped `{ClassIRI}#{name}` derivation
  was semantically WRONG (it fragments relation identity, defeats `rdfs:domain` entailment, and
  breaks inference/alignment) and is REMOVED as the default. No backwards-compat layer, no shim,
  no version of the old behavior preserved by default. This is a deliberate breaking change
  (major version bump + migration note).
- **Opt-out flag** (`enable___` family, mirroring `enableStrictGraph` on `Config.ts`):
  `enableCanonicalPredicates?: boolean` defaulting **`true`**. A consumer that genuinely needs
  collision-free per-type predicates (the DTO case) sets `enableCanonicalPredicates: false` to
  restore class-scoped `{ClassIRI}#{name}`. The opt-out exists ONLY for that case and must be
  documented as such — see "Predicate-collision semantics" below for when it is appropriate.

### Default flat-predicate derivation (when no explicit binding/resolver is supplied)
Precedence (first match wins):
1. property-level explicit `x-jt-predicate: '<IRI>'` (or property `$id`);
2. `predicateFor({ classId, propertyName })` resolver returning an IRI;
3. **default**: `` `${baseIRI}${propertyName}` `` — the property name under the registry's
   `baseIRI`, NOT scoped by the class IRI. (e.g. `baseIRI` `https://pokemontology.dev/` +
   `mayHaveAbility` → `https://pokemontology.dev/mayHaveAbility`.)
`SchemaIri.propertyIri` is repurposed/replaced accordingly; the class IRI no longer scopes the
predicate in the default path.

This is the deepest of the three Pokemontology hand-offs (the others:
`rdf12-triple-term-emission.md`, `owl-axiom-import-fidelity.md`). It is foundational — every
converter's output depends on it.

## Problem

json-tology derives every property's RDF predicate as
`SchemaIri.propertyIri(classId, propertyName)` = `{ClassIRI}#{propertyName}`
(`src/modules/graph/SchemaIri.ts:38`, used in `src/modules/graph/SchemaGraphRelations.ts:155`;
consumed by ABox `Projection` at `src/modules/rdf/Projection.ts:~450` and by the TBox
`OwlProjection`). So an instance of `pkm:Species` emits
`<bulbasaur> pkm:Species#mayHaveAbility <overgrow>`, and the regenerated TBox declares
class-scoped properties.

A published ontology uses **flat, shared** predicates: `<bulbasaur> pkm:mayHaveAbility <overgrow>`,
with `pkm:mayHaveAbility a owl:ObjectProperty ; rdfs:domain pkm:Species ; rdfs:range pkm:Ability`.
The two models are semantically different artifacts.

## Why flat/shared is required here (semantic rationale)

RDF properties are first-class, class-independent resources; `rdfs:domain` is a monotonic
**entailment**, not ownership. Shared predicates are what enables: one relation identity across
classes/games (a Fire `pkm:hasType` on a Species and a Move is the *same* property),
cross-generation/cross-game diffing (the product goal), property hierarchies
(`rdfs:subPropertyOf`) and characteristics (functional/transitive/inverse), OWL RL/DL inference,
and `owl:equivalentProperty` alignment to Schema.org/Wikidata/OBO. Class-scoping fragments all of
these and degrades `rdfs:label` into per-class variants.

The class-scoped derivation only ever helped collision-free DTO serialization, and even there it
is the wrong *default* for an ontology-native system. It is demoted to an explicit opt-out
(`enableCanonicalPredicates: false`) for the DTO case; canonical is the default everywhere else.

## Predicate-collision semantics (what shared predicates mean, with examples)

Canonical projection makes a property's predicate a **first-class, class-independent resource**.
Two properties that resolve to the same predicate IRI ARE the same RDF property. This is the
feature for ontologies and the hazard for unrelated DTOs — the examples below show both, and are
why the opt-out exists.

### Feature — intended shared identity (ontology)
`Species.hasType` and `Move.hasType` both default to `pkm:hasType`:
```turtle
<…/bulbasaur> pkm:hasType <…/type/grass> .     # a Species instance
<…/ember>     pkm:hasType <…/type/fire>  .     # a Move instance
# TBox: ONE property, domain is the union (monotonic entailment), not ownership
pkm:hasType a owl:ObjectProperty ; rdfs:domain pkm:Species, pkm:Move ; rdfs:range pkm:Type .
```
Meaning: `?x pkm:hasType ?t` retrieves Species AND Moves — one relation identity across classes.
This is what enables `rdfs:subPropertyOf`, functional/inverse characteristics,
`owl:equivalentProperty` alignment (Schema.org/Wikidata), and cross-game/cross-generation diffing
(the product goal). Class-scoping (`Species#hasType` ≠ `Move#hasType`) destroys all of it.

**This N-classes-share-one-predicate case is the PRIMARY pattern, not an edge.** Within a single
coordinated vocabulary, MANY classes intentionally bind the same predicate — `pkm:name` is the
same property on `pkm:Species`, `pkm:Move`, `pkm:Item`, etc. That is correct and desired, NOT the
conflation hazard. CURIE namespacing (below) separates genuinely *different vocabularies*; it must
NOT be used to force apart classes that *should* share a predicate. The design must therefore treat
"K classes → 1 predicate" as the normal case: ONE `owl:ObjectProperty`/`DatatypeProperty`
declaration whose `rdfs:domain` is the union of all binding classes (domain is a monotonic
entailment, so a union domain is correct — it does NOT mean "must be all of them"). The
schema-graph relation model must allow many class nodes to reference one predicate identity.

### Hazard — coincidental conflation (why DTOs opt out)
Two structurally-unrelated DTO classes each happen to have a `name`:
```turtle
# canonical default → both collapse onto ${baseIRI}name:
<…/invoice/42> ns:name "ACME Q1" .             # Invoice.name : string (maxLength 80)
<…/color/red>  ns:name "Crimson" .             # Color.name   : string (pattern ^#?[A-Za-z]+$)
# TBox: ONE ns:name with a union domain (Invoice, Color) and CONFLICTING range facets —
# a reasoner now treats Invoice and Color names as the same property. Semantically muddy.
```
Meaning: `?x ns:name ?n` conflates invoices and colours, and the merged `ns:name` carries both the
`maxLength 80` and the `pattern` constraints. For a *published ontology* with a coordinated
vocabulary this is correct and intended (you WANT one `name`); for a DTO bundle where the two
`name`s are coincidental and independent, it is wrong. That DTO case — and only that case — is what
`enableCanonicalPredicates: false` is for, restoring distinct `Invoice#name` / `Color#name`.

### Resolution — the hazard is a NAMESPACING problem; use the existing CURIE utils
Coincidental conflation is the classic CURIE/namespace problem, and json-tology already has the
tool: `Curie` (`src/modules/rdf/Curie.ts`, `CurieInterface` — `expand`/`compact` over a prefix
map), already threaded through `Projection` as `curie?: CurieInterface`. The correct fix for
"unrelated classes share a field name" is to put them in **distinct vocabularies/prefixes**, not to
class-scope:
```turtle
@prefix invoice: <https://app.example/invoice/> .
@prefix color:   <https://app.example/color/> .
<…/invoice/42> invoice:name "ACME Q1" .        # distinct property
<…/color/red>  color:name   "Crimson"  .        # distinct property — no conflation, no class-scoping
```
This is achieved with the canonical path — NOT the opt-out — by giving each module its own
namespace: either distinct `baseIRI`s per registry, or a `predicateFor({ classId, propertyName })`
that returns a per-vocabulary prefixed IRI (e.g. `${prefixForClass(classId)}${propertyName}`). The
bound predicate then flows through `Curie.compact`/`expand` on emit/lift like every other IRI.

Consequences for the design:
- The predicate binding MUST route through the active `CurieInterface` (compact on `toQuads`/TBox
  emit, expand on `fromQuads` lift) — same as subject/object IRIs already do.
- `predicateFor` composes with CURIEs: returning `'pkm:mayHaveAbility'` (a CURIE) is valid and is
  expanded via the registry's prefix map; the default `${baseIRI}${propertyName}` is itself
  CURIE-compactable.
- This shrinks the class-scoped opt-out to a genuinely narrow last resort. **Rule of thumb:**
  coordinated vocabulary → default (one shared predicate); independent modules that merely share
  field names → give them distinct CURIE prefixes/`baseIRI`s (still canonical, still flat, just
  namespaced); only a hard requirement for per-type predicate identity → `enableCanonicalPredicates:
  false`.

## Required capabilities

### 1. Canonical predicate binding (opt-in)
Let a property bind to a shared predicate IRI instead of the `{ClassIRI}#{name}` default. Two
composable mechanisms (provide both; explicit wins over resolver):
- **Per-property explicit predicate** — an annotation on the property, e.g. `x-jt-predicate:
  'pkm:mayHaveAbility'` (or honor a property-level `$id`). Strict-graph-compatible.
- **Vocabulary resolver option** on `JsonTology.create` — `predicateFor?: (ctx: { classId,
  propertyName }) => string | undefined`, analogous to the existing subject `iriFor`
  (`src/contracts/...`/`Config.ts`). Returning a flat IRI (e.g. `${ns}${propertyName}`) overrides
  the default; `undefined` falls through to `{ClassIRI}#{name}`.

The binding must be a **relation in the schema graph** (per json-tology `CLAUDE.md`: representable
in the canonical graph; no projection bypass). `Projection` (ABox), `OwlProjection` (TBox),
`ShaclProjection`, and `fromQuads` (lift) all read the bound predicate from the graph — not from a
side path.

### 2. IRI-valued (object) properties → NamedNode, not string literal
A property whose value is an IRI must serialize as a NamedNode. `$ref` to a class already does
this; add an explicit marker for the case where the value is an IRI **string** (e.g. an instance
IRI like `pkm:stat/defense`) rather than a nested object: a `format: 'iri'` / `x-jt-iriRef: true`
on the property. `Projection` already distinguishes IRI vs literal predicates
(`IRI_PREDICATES`/`SIMPLE_LITERAL_PREDICATES`, `src/modules/rdf/Projection.ts:199,205`) — route
iri-ref properties through the NamedNode path.

### 3. `rdfs:label` and language-tagged literals
Support binding a property to `rdfs:label` (predicate `http://www.w3.org/2000/01/rdf-schema#label`)
emitted as a language-tagged literal. Generalize: a property may declare a language tag so its
value serializes as `"…"@<lang>` (use the existing literal factory in
`src/modules/rdf/Terms.ts`; carry the lang tag through `QuadFactory.literal`).

### 4. TBox emission must follow the binding
When a property is canonically bound, `toTbox` (`OwlProjection`) MUST declare it as a flat
`owl:ObjectProperty`/`owl:DatatypeProperty` with `rdfs:domain` = the owning class and
`rdfs:range` = the target — NOT a class-scoped restriction. Multiple classes binding the same
predicate yield ONE property declaration with a union/multiple domain (or per-class domain
entailment) — verify reasoners see one shared property.

### 5. Round-trip (subject-type-aware reverse resolution)
`fromQuads` must lift flat-predicate quads back onto the correct property using the active
predicate bindings (reverse of #1). Because a shared predicate is bound by K classes, the predicate
IRI alone is AMBIGUOUS — `pkm:name` maps to `Species.name` OR `Move.name` depending on the subject.
Reverse resolution therefore keys on (subject's `rdf:type` / resolved schema, predicate IRI) → the
owning property, not on the predicate alone. The reverse index must be (class, predicate)→property,
and the lift must first determine the subject's class (from its `rdf:type` quad or the target
schema passed to `fromQuads`). Idempotent for the bound vocabulary.

## Acceptance criteria
Add `test/` fixtures using `pkm:`-style bindings:
1. A `Species` schema with `mayHaveAbility` bound to `pkm:mayHaveAbility` (object, `$ref` Ability)
   and `nationalDexNumber` bound to `pkm:nationalDexNumber` (datatype) emits, for an instance:
   `<…/bulbasaur> pkm:mayHaveAbility <…/overgrow> ; pkm:nationalDexNumber 1 .` — flat predicates,
   NamedNode object, NO `Species#…` predicates.
2. An iri-ref string property (`raisedStat` → `pkm:stat/defense`) emits a NamedNode, not a string
   literal.
3. An `rdfs:label`-bound property emits `rdfs:label "Bulbasaur"@en`.
4. `toTbox` for that schema declares `pkm:mayHaveAbility a owl:ObjectProperty ; rdfs:domain
   pkm:Species ; rdfs:range pkm:Ability` (flat), and two classes binding `pkm:hasType` produce one
   shared property declaration.
5. `fromQuads` round-trips #1–#3 back to the instance shape; `validate` passes.
6. Default behavior (inverted from the original draft): with NO binding/resolver supplied, the
   default emits the FLAT canonical predicate `${baseIRI}${propertyName}` (NOT `{ClassIRI}#{name}`).
   Add a test asserting the new default is flat. Separately, assert that
   `enableCanonicalPredicates: false` restores class-scoped `{ClassIRI}#{name}` (the DTO opt-out).
7. Two classes whose same-named property resolves to the same predicate produce ONE shared property
   declaration with a union `rdfs:domain` (the shared-identity feature); a `test/` fixture asserts
   the single shared property + union domain.

## Type inference
Canonical binding is an RDF-projection concern; it MUST NOT change `InferType` (the TS shape is the
same record regardless of predicate IRI). Add a `test/types` assertion that a bound property infers
identically to an unbound one.

## Implementation task plan (sprout-then-swap; sequence AFTER the current branded-resolution work merges)

Central fact: the predicate is derived in ONE place — `SchemaIri.propertyIri(classId, propertyName)` →
`{classId}#{propertyName}` — consumed by graph-relation building (`SchemaGraphRelations.ts`) and
TBox (`OwlProjection.ts`). ABox `Projection` already emits from `relation.predicate`, so binding at
the graph-relation layer propagates to ABox for free. Threading precedents: `iriFor` /
`enableStrictGraph` on `Config.ts` → `normalizeToQuadsOptions` in `JsonTology.ts`.

**Phase 0 — Config + keyword surface (sprout; no behavior change).** Single agent.
- `src/interfaces/Config.ts`: add `enableCanonicalPredicates?: boolean` (doc it as default-`true`,
  opt-out via `false`, mirroring `enableStrictGraph`) and `predicateFor?: (ctx: { classId: string;
  propertyName: string }) => string | undefined`.
- `src/constants/SCHEMA_KEYWORDS.ts`: register `x-jt-predicate` and `x-jt-iriRef`.
- Thread both options from `create()` through to the graph build + projection options (follow
  `iriFor`'s path). Not yet consumed.
- Accept: `npm run type-check` 0; options accepted; existing behavior unchanged.

**Phase 1 — Predicate resolver as a canonical-graph relation (THE core swap).** Single agent (shared core).
- Add `resolvePredicateIri({ classId, propertyName, baseIRI, schema, options })` (new
  `src/modules/graph/PredicateResolver.ts`) with precedence: explicit `x-jt-predicate` / property
  `$id` → `predicateFor(ctx)` → default `${baseIRI}${propertyName}` when
  `enableCanonicalPredicates !== false`, else `${classId}#${propertyName}` (the legacy opt-out).
- Swap every predicate-derivation call site (`SchemaGraphRelations.ts:155` and siblings) from
  `SchemaIri.propertyIri(...)` to `resolvePredicateIri(...)`, so each property relation's
  `predicate` field carries the BOUND IRI. Keep `SchemaIri.propertyIri` only for the opt-out path.
- The binding lives in the graph relation (canonical-graph mandate) — model K-classes→1-predicate
  by allowing many class nodes to reference one predicate identity (relation predicate equality).
- Accept: a `test/unit` + `test/types` asserting a bound property's graph-relation predicate is the
  flat IRI by default and `{classId}#{name}` under `enableCanonicalPredicates: false`. `type-check` 0.

**Phase 2 — ABox emit follows the binding (+ iri-ref + lang).** Single agent (`Projection.ts`, `Terms.ts`, `QuadFactory.ts`).
- ABox already emits `relation.predicate` → flat predicates appear automatically once Phase 1 lands.
- Route `x-jt-iriRef`/`format: 'iri'` string properties through the NamedNode path
  (`IRI_PREDICATES`, `Projection.ts:199`) instead of a string literal.
- Language tags: bind a property to `rdfs:label` and emit `"…"@<lang>` via the existing
  `Terms`/`QuadFactory.literal` lang-tag path.
- Accept: fixtures #1 (flat predicate + NamedNode object), #2 (iri-ref → NamedNode), #3 (`rdfs:label
  "…"@en`).

**Phase 3 — TBox flat property declarations.** Single agent (`OwlProjection.ts`).
- Replace class-scoped property emission (the `propertyIri` derivation at `OwlProjection.ts:~59,65`)
  with flat `owl:ObjectProperty`/`owl:DatatypeProperty` + `rdfs:domain` (owning class) + `rdfs:range`
  (target), keyed on the bound predicate. K classes binding one predicate → ONE declaration with a
  UNION `rdfs:domain`.
- Accept: fixture #4 (flat property; two classes → one shared property + union domain). Verify a
  reasoner sees one property.

**Phase 4 — fromQuads reverse (subject-type-aware).** Single agent (`Lift.ts`).
- Build a `(subjectClass, predicateIri) → property` reverse index from the active bindings; lift
  determines the subject's class via its `rdf:type` quad / the target schema and maps the bound
  predicate back to the owning property (predicate alone is ambiguous across K classes).
- Accept: fixtures #1–#3 round-trip; `validate` passes; shared-predicate disambiguation test.

**Phase 5 — CURIE threading + default-flip tests + InferType identity.** Single agent.
- Route the bound predicate through `CurieInterface.compact` (emit) / `expand` (lift), like
  subject/object IRIs.
- Acceptance tests #6 (default is flat; `enableCanonicalPredicates: false` restores class-scoped)
  and #7 (shared property/union domain); `test/types` asserting `InferType` is byte-identical for a
  bound vs unbound property.

**Phase 6 — Gate + breaking-change note.** Full suite (incl. `tsconfig.eslint.json`), `eslint .`,
major-version bump, CHANGELOG migration note ("default RDF predicates are now flat/shared; pass
`enableCanonicalPredicates: false` for legacy class-scoped output"). No shims.

Dispatch shape: Phase 0 → 1 are strictly sequential (shared core). Phases 2/3/4 touch disjoint files
(`Projection`/`OwlProjection`/`Lift`) and may run in parallel once Phase 1's relation shape is fixed;
Phase 5/6 sequential at the end. Standards apply throughout: dispatch maps over nested ternaries,
no casts, no `as any`.

## Out of scope
- Changing the default projection (stays class-scoped for DTOs).
- The triple-term and import-fidelity work (separate plans) — though canonical predicates should
  compose cleanly with both.

## Pointers
- Predicate derivation: `src/modules/graph/SchemaIri.ts:38`, `SchemaGraphRelations.ts:155`.
- ABox emit: `src/modules/rdf/Projection.ts` (IRI vs literal at :199/:205; property loop ~:450).
- TBox emit: `src/modules/rdf/OwlProjection.ts`. SHACL: `src/modules/rdf/ShaclProjection.ts`.
- Subject IRI precedent (mirror its option shape): `iriFor` on `JsonTology.create` / `Config.ts`.
- Literal/lang + IRI term factories: `src/modules/rdf/Terms.ts`, `QuadFactory.ts`.
- CURIE namespacing (resolves the conflation hazard): `src/modules/rdf/Curie.ts`,
  `src/interfaces/Curie.ts` (`expand`/`compact`); already threaded through `Projection` as
  `curie?: CurieInterface` — the bound predicate must compact on emit / expand on lift through it.
- Canonical-graph relations: `src/modules/graph/SchemaGraph.ts`, `GraphEngine.ts`.
