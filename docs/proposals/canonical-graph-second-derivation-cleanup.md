# Plan: Eliminate second-derivation violations of the canonical-graph mandate (Group B)

Status: implemented on `feature/canonical-predicate-projection` (F5/F9, F6, F7, F8 all resolved).
Owner: (json-tology agent)

## Mandate
CLAUDE.md canonical-graph contract: the graph is the single semantic model; ontology/ABox output
must be a *serialization of the graph*, not a separate derivation path; domain/range and datatype are
graph facts produced during translation. A semantic fact must be derived ONCE and read everywhere.

## Scope
A read-only audit (`rdf/`, `ontology/`, `materialization/`, `graph/`, `validation/`) found nine
violations. Four (the property-predicate IRI re-derivation, F1–F4) are resolved by the
`canonical-predicate-projection` branch and are NOT repeated here. This plan covers the remaining
independent violations (Group B).

## Findings

### F5 / F9 — ABox XSD datatype re-derived from JS runtime type, not the graph `SH.datatype` relation (HIGH)
`src/modules/rdf/Projection.ts:704-724` chooses the literal datatype by branching on the JavaScript
runtime type of the value: `Number.isInteger(value) ? XSD.integer : XSD.double`, hardcoded
`XSD.boolean`, and `XsdTypes.resolveSingle('string', { format })`. TBox/SHACL instead read the
declared `SH.datatype` relation from the graph index (`entry.byPredicate.get(SH.datatype)`, set in
`SchemaGraphRelations.ts:803-812`).

Consequence: a schema declaring `type: number, format: float` emits `xsd:float` in TBox but
`xsd:double` in ABox; `type: integer, format: int32` → `xsd:int` (TBox) vs `xsd:integer` (ABox). The
graph's declared precision is discarded at the ABox layer; ABox and TBox disagree on the same property.

Fix: in `projectSingleValue`, resolve the property's `SH.datatype` relation from the graph and use it
as the literal datatype; fall back to runtime inference ONLY when no `SH.datatype` relation exists
(e.g. untyped/free-form values). Single source = the graph relation.

### F6 — XSD→JSON-Schema reverse mapping in three independent tables (HIGH)
The fact "XSD type X → JSON-Schema `{type, format?}`" is encoded three times, already divergent:
- `src/modules/ontology/importDispatch/Properties.ts:47-172` — `XSD_TO_JSON_SCHEMA`.
- `src/modules/ontology/importDispatch/Datatypes.ts:266-398` — `XSD_TO_SCHEMA_TYPE`.
- `src/modules/ontology/OwlImporter.ts:206-245` — `SUPPORTED_DATATYPES` membership set.
(`Properties.ts` lacks `xsd:byte`/`xsd:short` that `Datatypes.ts` has; none agree on all forms.)

Fix: one `XsdReverseMaps` module in `src/constants/` (parallel to the forward `XsdTypes`/`XSD_MAPS`)
covering both full and prefixed IRI forms; all three consumers import it. Ideally derive it from the
existing forward map so forward/reverse cannot drift.

### F7 — XSD facet ↔ JSON-Schema keyword correspondence duplicated (MEDIUM)
Forward (`src/modules/rdf/OwlProjection.ts:221-249` `SHACL_TO_XSD_FACET` + `XSD_FACET_DATATYPE`) and
reverse (`src/modules/ontology/importDispatch/Datatypes.ts:113-256` `FACET_MAP`) each enumerate the
same facet set (minLength, maxLength, min/maxInclusive, min/maxExclusive, pattern).

Fix: one bidirectional facet-correspondence table in `src/constants/`; derive both directions from it.

### F8 — `jt:annotatedEdge` read raw from `node.schema`, absent from semantics API (MEDIUM)
`src/modules/graph/SchemaGraphRelations.ts:398-451` (`pushAnnotatedEdgeRelations`) reads
`node.schema['jt:annotatedEdge']` directly. It is the only schema keyword with no field on
`SchemaGraphSemanticsInterface`, so it is invisible to `graph.semantics()` consumers — a second-model
risk for any future reader.

Fix: add `annotatedEdge?: AnnotatedEdgeStructureType` to `SchemaGraphSemanticsInterface`, populate it
in `SchemaGraphSupport.extractSemantics`, and have `pushAnnotatedEdgeRelations` read it from `sem`.
(Introduced by the annotated-edge baseline; fix in the same spirit as the other semantics fields.)

## Compliant (no action)
`GraphSchemaSerializer`, `Materializer`, `GraphOntology/ShaclSerializer`, `GraphEngineDefaults/Visit`,
`SchemaCompiler` consume only `graph.semantics()`/`graph.allRelations()` (raw-schema reads are
`typeof node.schema === 'boolean'` fast-paths only).

## Suggested sequencing
1. F8 (small, isolated to graph layer).
2. F5/F9 (ABox datatype from graph relation) — highest user-visible impact.
3. F6 then F7 (import-side reverse-map consolidation).
Each is independently shippable. F5/F9 is a behavior change (datatype values in ABox) → changelog note.

## Out of scope
- The property-predicate work (handled by `canonical-predicate-projection`; F1–F4).
