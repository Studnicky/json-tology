# Plan: Canonical (shared-vocabulary) predicate projection — DEFAULT (opt-out)

Status: accepted — strict-by-default. BREAKING CHANGE, no backwards-compat, no shims.
Owner: (json-tology agent)
Consumer: Published OWL knowledge graph migration — emit shared-vocabulary predicates
(e.g. `bk:reviews`, `bk:title`) from json-tology schemas, not class-scoped per-type predicates.

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
   `baseIRI`, NOT scoped by the class IRI. (e.g. `baseIRI` `https://bookstore.example/` +
   `reviews` → `https://bookstore.example/reviews`.)
`SchemaIri.propertyIri` is repurposed/replaced accordingly; the class IRI no longer scopes the
predicate in the default path.

This is the foundational change across the three related plans (the others:
`rdf12-triple-term-emission.md`, `owl-axiom-import-fidelity.md`). It is foundational — every
converter's output depends on it.

## Problem

json-tology derives every property's RDF predicate as
`SchemaIri.propertyIri(classId, propertyName)` = `{ClassIRI}#{propertyName}`
(`src/modules/graph/SchemaIri.ts:38`, used in `src/modules/graph/SchemaGraphRelations.ts:155`;
consumed by ABox `Projection` at `src/modules/rdf/Projection.ts:~450` and by the TBox
`OwlProjection`). So an instance of `bk:Review` emits
`<urn:bookstore:instances/review/rev-001> bk:Review#reviews <urn:bookstore:instances/book/978-0-06-112008-4>`,
and the regenerated TBox declares class-scoped properties.

A published ontology uses **flat, shared** predicates:
`<urn:bookstore:instances/review/rev-001> bk:reviews <urn:bookstore:instances/book/978-0-06-112008-4>`,
with `bk:reviews a owl:ObjectProperty ; rdfs:domain bk:Review ; rdfs:range bk:Book`.
The two models are semantically different artifacts.

## Why flat/shared is required here (semantic rationale)

RDF properties are first-class, class-independent resources; `rdfs:domain` is a monotonic
**entailment**, not ownership. Shared predicates are what enables: one relation identity across
classes (a `bk:title` on a Book and a Review is the *same* property),
cross-catalog diffing (the product goal), property hierarchies
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
`Book.title` and `Review.title` both default to `bk:title`:
```turtle
<urn:bookstore:instances/book/978-0-06-112008-4> bk:title "To Kill a Mockingbird" .  # a Book instance
<urn:bookstore:instances/review/rev-001>          bk:title "A timeless classic" .    # a Review instance
# TBox: ONE property, domain is the union (monotonic entailment), not ownership
bk:title a owl:DatatypeProperty ; rdfs:domain bk:Book, bk:Review ; rdfs:range xsd:string .
```
Meaning: `?x bk:title ?t` retrieves Books AND Reviews — one relation identity across classes.
This is what enables `rdfs:subPropertyOf`, functional/inverse characteristics,
`owl:equivalentProperty` alignment (Schema.org/Wikidata), and cross-catalog diffing. Class-scoping
(`Book#title` ≠ `Review#title`) destroys all of it.

**This N-classes-share-one-predicate case is the PRIMARY pattern, not an edge.** Within a single
coordinated vocabulary, MANY classes intentionally bind the same predicate — `bk:title` is the
same property on `bk:Book`, `bk:Review`, `bk:Order`, etc. That is correct and desired, NOT the
conflation hazard. CURIE namespacing (below) separates genuinely *different vocabularies*; it must
NOT be used to force apart classes that *should* share a predicate. The design must therefore treat
"K classes → 1 predicate" as the normal case: ONE `owl:ObjectProperty`/`DatatypeProperty`
declaration whose `rdfs:domain` is the union of all binding classes (domain is a monotonic
entailment, so a union domain is correct — it does NOT mean "must be all of them"). The
schema-graph relation model must allow many class nodes to reference one predicate identity.

### Hazard — coincidental conflation (why DTOs opt out)
Two structurally-unrelated DTO classes each happen to have a `title`:
```turtle
# canonical default → both collapse onto ${baseIRI}title:
<…/book/42>   ns:title "Clean Code" .          # Book.title   : string (maxLength 500)
<…/order/99>  ns:title "Order #99" .           # Order.title  : string (pattern ^Order #\d+$)
# TBox: ONE ns:title with a union domain (Book, Order) and CONFLICTING range facets —
# a reasoner now treats Book and Order titles as the same property. Semantically muddy.
```
Meaning: `?x ns:title ?t` conflates books and orders, and the merged `ns:title` carries both the
`maxLength 500` and the `pattern` constraints. For a *published ontology* with a coordinated
vocabulary this is correct and intended (you WANT one `title`); for a DTO bundle where the two
`title`s are coincidental and independent, it is wrong. That DTO case — and only that case — is what
`enableCanonicalPredicates: false` is for, restoring distinct `Book#title` / `Order#title`.

### Resolution — the hazard is a NAMESPACING problem; use the existing CURIE utils
Coincidental conflation is the classic CURIE/namespace problem, and json-tology already has the
tool: `Curie` (`src/modules/rdf/Curie.ts`, `CurieInterface` — `expand`/`compact` over a prefix
map), already threaded through `Projection` as `curie?: CurieInterface`. The correct fix for
"unrelated classes share a field name" is to put them in **distinct vocabularies/prefixes**, not to
class-scope:
```turtle
@prefix bk:    <https://bookstore.example/> .
@prefix order: <https://bookstore.example/order/> .
<urn:bookstore:instances/book/42>  bk:title    "Clean Code" .    # distinct property
<urn:bookstore:instances/order/99> order:title "Order #99"  .    # distinct property — no conflation, no class-scoping
```
This is achieved with the canonical path — NOT the opt-out — by giving each module its own
namespace: either distinct `baseIRI`s per registry, or a `predicateFor({ classId, propertyName })`
that returns a per-vocabulary prefixed IRI (e.g. `${prefixForClass(classId)}${propertyName}`). The
bound predicate then flows through `Curie.compact`/`expand` on emit/lift like every other IRI.

Consequences for the design:
- The predicate binding MUST route through the active `CurieInterface` (compact on `toQuads`/TBox
  emit, expand on `fromQuads` lift) — same as subject/object IRIs already do.
- `predicateFor` composes with CURIEs: returning `'bk:reviews'` (a CURIE) is valid and is
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
  'bk:reviews'` (or honor a property-level `$id`). Strict-graph-compatible.
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
IRI like `urn:bookstore:instances/book/978-0-06-112008-4`) rather than a nested object: a
`format: 'iri'` / `x-jt-iriRef: true` on the property. `Projection` already distinguishes IRI vs
literal predicates (`IRI_PREDICATES`/`SIMPLE_LITERAL_PREDICATES`,
`src/modules/rdf/Projection.ts:199,205`) — route iri-ref properties through the NamedNode path.

### 3. `rdfs:label` and language-tagged literals
Support binding a property to `rdfs:label` (predicate `http://www.w3.org/2000/01/rdf-schema#label`)
emitted as a language-tagged literal. Generalize: a property may declare a language tag so its
value serializes as `"…"@<lang>` (e.g. a Book `title` → `"Clean Code"@en`; use the existing
literal factory in `src/modules/rdf/Terms.ts`; carry the lang tag through `QuadFactory.literal`).

### 4. TBox emission must follow the binding
When a property is canonically bound, `toTbox` (`OwlProjection`) MUST declare it as a flat
`owl:ObjectProperty`/`owl:DatatypeProperty` with `rdfs:domain` = the owning class and
`rdfs:range` = the target — NOT a class-scoped restriction. Multiple classes binding the same
predicate yield ONE property declaration with a union/multiple domain (or per-class domain
entailment) — verify reasoners see one shared property. Example: `bk:reviews` bound on both
`Review` and a future `CuratedList` class → ONE `owl:ObjectProperty bk:reviews` declaration
with `rdfs:domain bk:Review, bk:CuratedList`.

### 5. Round-trip (subject-type-aware reverse resolution)
`fromQuads` must lift flat-predicate quads back onto the correct property using the active
predicate bindings (reverse of #1). Because a shared predicate is bound by K classes, the predicate
IRI alone is AMBIGUOUS — `bk:title` maps to `Book.title` OR `Review.title` depending on the subject.
Reverse resolution therefore keys on (subject's `rdf:type` / resolved schema, predicate IRI) → the
owning property, not on the predicate alone. The reverse index must be (class, predicate)→property,
and the lift must first determine the subject's class (from its `rdf:type` quad or the target
schema passed to `fromQuads`). Idempotent for the bound vocabulary.

## Acceptance criteria
Add `test/` fixtures using bookstore-domain bindings:
1. A `Review` schema with `book` bound to `bk:reviews` (object, `$ref` Book) and `rating` bound to
   `bk:rating` (datatype) emits, for an instance:
   `<urn:bookstore:instances/review/rev-001> bk:reviews <urn:bookstore:instances/book/978-0-06-112008-4> ; bk:rating 5 .`
   — flat predicates, NamedNode object, NO `Review#…` predicates.
2. An iri-ref string property (`coverImage` → `urn:bookstore:instances/cover/978-0-06-112008-4`)
   emits a NamedNode, not a string literal.
3. An `rdfs:label`-bound property emits `rdfs:label "To Kill a Mockingbird"@en`.
4. `toTbox` for that schema declares `bk:reviews a owl:ObjectProperty ; rdfs:domain bk:Review ;
   rdfs:range bk:Book` (flat), and two classes binding `bk:title` produce one shared property
   declaration.
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

Central fact: the property predicate IRI is NOT stored on the canonical graph — it is independently
re-derived as `{classId}#{propertyName}` in FOUR projection consumers:
- ABox: `${node.id}#${propertyName}` inline at `src/modules/rdf/Projection.ts:477`.
- TBox: `canonicalPropertyIri(subject)` → `SchemaIri.propertyIri(...)` at `src/modules/rdf/OwlProjection.ts:47-65`.
- SHACL: `SchemaIri.propertyIri(pathClassId, propName)` at `src/modules/rdf/ShaclProjection.ts:461`.
- Lift: `${classId}#${propName}` in `findPropertyQuads` at `src/modules/rdf/Lift.ts`.

That four-way duplication is the defect. The structural `SchemaGraph` is deliberately `baseIRI`-agnostic
(`new SchemaGraph(rootSchema)` — no `baseIRI`/vocabulary options in construction), so the binding does
NOT belong in graph construction (that would conflate the structural-graph layer with the
projection/vocabulary layer). The fix is ONE derivation authority: a single
`PredicateResolver.resolve(...)` pure function that all four consumers call instead of inlining. One
function owns the rule; four call sites delegate. Threading precedents for the new options: `iriFor` /
`enableStrictGraph` on `Config.ts` → `normalizeToQuadsOptions` in `JsonTology.ts`.

**Phase 0 — Config + keyword surface (sprout; no behavior change).** Single agent.
- `src/interfaces/Config.ts`: add `enableCanonicalPredicates?: boolean` (doc it as default-`true`,
  opt-out via `false`, mirroring `enableStrictGraph`) and `predicateFor?: (ctx: { classId: string;
  propertyName: string }) => string | undefined`.
- `src/constants/SCHEMA_KEYWORDS.ts`: register `x-jt-predicate` and `x-jt-iriRef`.
- Thread both options from `create()` through to the graph build + projection options (follow
  `iriFor`'s path). Not yet consumed.
- Accept: `npm run type-check` 0; options accepted; existing behavior unchanged.

**Phase 1 — `PredicateResolver` as the single derivation authority (THE core).** Single agent (shared core).
- Add `PredicateResolver.resolve({ classId, propertyName, propertySchema, baseIRI, enableCanonicalPredicates, predicateFor })`
  (new `src/modules/graph/PredicateResolver.ts`) with precedence (first match wins): explicit
  `x-jt-predicate` / property `$id` → `predicateFor(ctx)` → default `${baseIRI}${propertyName}` when
  `enableCanonicalPredicates !== false`, else `${classId}#${propertyName}` (the legacy opt-out, which
  delegates to `SchemaIri.propertyIri`). Pure function; dispatch-style precedence, no nested ternaries.
- This is the ONLY place a property predicate is derived. Phases 2/3/4 each replace ONE inlined
  derivation with a call to it (ABox `Projection.ts:477`, TBox `OwlProjection.canonicalPropertyIri`,
  SHACL `ShaclProjection.ts:461`, Lift `findPropertyQuads`). `SchemaIri.propertyIri` survives only as
  the opt-out branch inside the resolver.
- K-classes→1-predicate falls out naturally: the resolver is a pure function of
  (classId, propertyName, schema, options), so two classes whose property resolves to the same IRI
  ARE the same predicate.
- Accept: a `test/unit` + `test/types` asserting the resolver returns the flat IRI by default and
  `{classId}#{name}` under `enableCanonicalPredicates: false`, and honors `x-jt-predicate`/`predicateFor`
  precedence. `type-check` 0.

**Phase 2 — ABox call-site swap (+ iri-ref + lang).** Single agent (`Projection.ts`, `Terms.ts`, `QuadFactory.ts`).
- Replace the inline `${node.id}#${propertyName}` at `Projection.ts:477` with `PredicateResolver.resolve(...)`
  (ABox is a call site to swap, NOT a free rider — it does not read `relation.predicate`). Thread
  `baseIRI` + the two options into the `projectInstance` path.
- Route `x-jt-iriRef`/`format: 'iri'` string properties through the NamedNode path
  (`IRI_PREDICATES`, `Projection.ts:199`) instead of a string literal.
- Language tags: bind a property to `rdfs:label` and emit `"…"@<lang>` via the existing
  `Terms`/`QuadFactory.literal` lang-tag path (already present from the annotated-edge baseline).
- Accept: fixtures #1 (flat predicate + NamedNode object), #2 (iri-ref → NamedNode), #3 (`rdfs:label
  "…"@en`).

**Phase 3 — TBox flat property declarations.** Single agent (`OwlProjection.ts`).
- Replace `canonicalPropertyIri(...)` (the `SchemaIri.propertyIri` derivation at `OwlProjection.ts:47-65`)
  with a `PredicateResolver.resolve(...)` call, emitting flat `owl:ObjectProperty`/`owl:DatatypeProperty`
  + `rdfs:domain` (owning class) + `rdfs:range` (target), keyed on the bound predicate. K classes binding
  one predicate → ONE declaration with a UNION `rdfs:domain`.
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
- Restructuring `SchemaGraph` construction to carry `baseIRI`/vocabulary options (the structural graph
  stays `baseIRI`-agnostic; predicate binding lives in `PredicateResolver`, not graph construction).
- The triple-term and import-fidelity work (separate plans) — though canonical predicates should
  compose cleanly with both.

## Pointers
- Predicate derivation (the single authority): `src/modules/graph/PredicateResolver.ts` (new);
  legacy opt-out delegates to `src/modules/graph/SchemaIri.ts:38`.
- Four inlined derivations being swapped: `Projection.ts:477` (ABox),
  `OwlProjection.ts:47-65` (TBox), `ShaclProjection.ts:461` (SHACL), `Lift.ts` `findPropertyQuads`.
- ABox emit: `src/modules/rdf/Projection.ts` (IRI vs literal at :199/:205; property loop ~:450).
- TBox emit: `src/modules/rdf/OwlProjection.ts`. SHACL: `src/modules/rdf/ShaclProjection.ts`.
- Subject IRI precedent (mirror its option shape): `iriFor` on `JsonTology.create` / `Config.ts`.
- Literal/lang + IRI term factories: `src/modules/rdf/Terms.ts`, `QuadFactory.ts`.
- CURIE namespacing (resolves the conflation hazard): `src/modules/rdf/Curie.ts`,
  `src/interfaces/Curie.ts` (`expand`/`compact`); already threaded through `Projection` as
  `curie?: CurieInterface` — the bound predicate must compact on emit / expand on lift through it.
- Canonical-graph relations: `src/modules/graph/SchemaGraph.ts`, `GraphEngine.ts`.
