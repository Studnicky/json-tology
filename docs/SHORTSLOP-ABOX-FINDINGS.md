# json-tology — ABox/OWL projection findings (from @shortslop)

Five issues surfaced while building `@shortslop/signal` (entity → `toQuads` → RDF) and a tiered
durable-write layer that replicates those quads into strict SPARQL stores (Oxigraph, Apache Jena
Fuseki). All five are **resolved in json-tology**. This document records each finding, its current
behaviour, the exact locus, and the architecture that closes them. Paths are relative to this repo.

## Status summary

| # | Finding | Status | Locus |
|---|---------|--------|-------|
| 1 | Annotation-predicate IRIs were invalid (two `#`) | **Fixed** | `SchemaGraphRelations.ts` · `Projection.ts` · `Lift.ts` |
| 2 | Annotation predicates bypassed predicate grounding | **Fixed** | `Projection.ts` · `Lift.ts` · `SchemaGraphSupport.ts` |
| 3 | Union-wrapped nested object `$ref`s were dropped | **Fixed** (v0.19.0) | `Projection.ts:549` (`unwrapSingleRef`) |
| 4 | `allOf`-optional nested node typed by shape IRI | **Fixed** (v0.19.0) | `Projection.ts:549`, `1248` |
| 5 | `format` not propagated through `$ref` | **Fixed** (v0.19.0) | `Projection.ts:788`, `1182` |

Findings 1–2 share one root cause and one fix (below). Findings 3–5 were closed in v0.19.0 by
`unwrapSingleRef`, with regression tests in `test/unit/refWrapperProjection.test.ts`.

---

## Findings 1 + 2 — root cause and fix

### Root cause

Every predicate IRI in the system is resolved **at projection / lift time** through
`PredicateResolver`, which is config-aware (`baseIRI`, `predicateFor`, `enableCanonicalPredicates`)
and applies a fixed precedence: `x-jt-predicate` → absolute `$id` → `predicateFor` callback →
canonical-flat (`baseIRI + name`) → class-scoped (`classId#name`) (`PredicateResolver.ts:153-204`).
Resolution is symmetric: projection resolves at `Projection.ts:778`, lift resolves the inverse at
`Lift.ts:666-672` — both call the same resolver, so `toQuads`/`fromQuads` agree by construction.

Annotated-edge **annotation** predicates were the lone exception. They were minted eagerly at
graph-construction time, before any predicate config existed, as a raw string `${node.id}#${prop}`.
Because `node.id` is the edge property's pointer IRI (e.g. `urn:bookstore:Review#/properties/book`),
that appended a **second** `#` — producing an IRI invalid per RFC 3987 (a fragment cannot contain
`#`; at most one fragment), which strict triplestores reject with HTTP 400 (finding 1). It also
**bypassed `PredicateResolver`**, so annotation predicates received no `x-jt-predicate` / `$id` /
`predicateFor` grounding (finding 2).

### Fix — resolve annotation predicates like every other predicate

Annotation predicates are no longer precomputed in the graph. The graph structure carries the raw
annotation sub-schema, and the predicate IRI is resolved **late** through `PredicateResolver` on
both the projection and lift sides, with the same `classId` (the edge-owning class), so round-trip
holds by construction.

- **Structure carries the schema, not a minted IRI.** `RelationStructure`'s annotatedEdge variant
  carries `{ propertyName, propertySchema, rangeRef }`, where `propertySchema` is the annotation's
  full authored sub-schema typed `JsonSchemaType` (`src/types/SchemaGraph.ts`).
- **No graph-time mint.** `pushAnnotatedEdgeRelations` stores the sub-schema; it no longer
  concatenates `${node.id}#${prop}` (`src/modules/graph/SchemaGraphRelations.ts`).
- **Binding keywords preserved.** `extractAnnotatedEdgeDescriptor` carries the whole annotation
  sub-schema (range `$ref` plus any `x-jt-predicate` / `$id`) rather than stripping it to `{ $ref }`
  (`src/modules/graph/SchemaGraphSupport.ts`). Extension keywords are read via index access on the
  loose schema, consistent with the rest of the codebase.
- **Projection resolves late.** `projectAnnotatedEdge` → `emitAnnotationQuads` resolves each
  annotation predicate via `predicateResolver({ classId, propertyName, propertySchema })`
  (`src/modules/rdf/Projection.ts`).
- **Lift resolves symmetrically.** `liftAnnotatedEdge` resolves the same way and applies the shared
  `expandPredicateCurie`, so `fromQuads` matches the quads `toQuads` emitted
  (`src/modules/rdf/Lift.ts`).
- **Defensive guard.** `PredicateResolver.resolve` validates every resolved predicate IRI with
  `assertSingleFragment`, throwing `GraphError('INVALID_PREDICATE_IRI')` if more than one `#` is
  present (`src/modules/graph/PredicateResolver.ts`). This catches the class of bug at the choke
  point for all predicates, not just annotations.

The annotation authoring surface (`Compose.annotatedEdge`) is unchanged: the existing
`Record<string, { $ref }>` constraint already accepts an annotation that also carries
`x-jt-predicate` / `$id` (structural assignability), so a binding key can be authored without a type
change.

### Resolved IRI shapes

For `ratingGiven` on edge-owning class `urn:bookstore:Review` with `baseIRI`
`https://bookstore.example`:

- canonical-flat (default): `https://bookstore.example/ratingGiven` — valid, fragment-free.
- class-scoped (`enableCanonicalPredicates: false`): `urn:bookstore:Review#ratingGiven` — one `#`.
- grounded (`x-jt-predicate` on the annotation): e.g. `https://schema.org/ratingValue`.

All three load into Oxigraph / Fuseki.

### 1. [HIGH] Annotation-predicate IRIs are valid single-fragment IRIs

Annotation predicates resolve to valid IRIs (at most one `#`). `test/unit/annotatedEdge.test.ts`
asserts the resolved predicates (`https://bookstore.example/ratingGiven`,
`…/verifiedPurchase`) and walks every emitted quad asserting each predicate IRI has at most one `#`.

### 2. [MED] Annotation predicates honor predicate grounding

An annotation may bind its predicate IRI to a shared vocabulary term via `x-jt-predicate` (or `$id`,
or a `predicateFor` callback), exactly like a regular property. `test/unit/annotatedEdge.test.ts`
authors an annotation with `'x-jt-predicate': 'https://schema.org/ratingValue'`, asserts the emitted
annotation predicate is that IRI, and round-trips the value through `fromQuads`.
`test/types/annotated-edge.test.ts` adds a compile-time assertion that the binding key is accepted
and does not disturb annotation-range inference.

> Enhancement (not implemented): emitting an `owl:equivalentProperty` TBox triple when an annotation
> declares an `equivalentTo`-style vocabulary equivalence (mirroring the class
> `equivalentTo` → `owl:equivalentClass` path at `SchemaGraphRelations.ts:524`). Grounding the
> predicate IRI directly via `x-jt-predicate` / `$id` covers the interoperability need today.

---

## 3. Union-wrapped nested object `$ref`s are projected

A property typed `anyOf` / `oneOf [{ $ref: Obj }, { type: 'null' }]` projects and types the nested
object correctly. `unwrapSingleRef` (`Projection.ts:549-600`) follows a transparent wrapper — a
single non-null `$ref` member of `anyOf`/`oneOf`, or a sole `$ref` member of `allOf` — to the
referenced target before the value is projected. Covered by `test/unit/refWrapperProjection.test.ts`.

## 4. `allOf`-optional nested node is typed by the referenced class

`allOf: [{ $ref: Class }]` projects the nested node as `a <Class>` (the referenced class `$id`), not
a `#/properties/<prop>` shape IRI, because `unwrapSingleRef` resolves to the class node and
`projectInstance` mints `rdf:type` from the resolved node's `$id` (`Projection.ts:828-830`). The
test asserts no quad carries a `#/properties/` IRI as an `rdf:type` object.

## 5. `format` is propagated through a `$ref`

A leaf `$ref`-ing a `{ type: string, format: date-time }` primitive projects `xsd:dateTime`.
`unwrapSingleRef` resolves the wrapper to the referenced primitive, so `propertySemantics` carries
its `format`, and `projectStringValue` routes it through `XsdTypes.resolveSingle` (`Projection.ts:1182`).

---

## Verification

type-check clean · lint clean · build emits `dist/` · `test:types` 36 · `test:unit` 1328 ·
`test:integration` 499 · `test:e2e` 132 — all green, including the annotated-edge round-trip
(`test/e2e/aboxBidirectionality.test.ts`) and the new grounding and single-fragment tests.
