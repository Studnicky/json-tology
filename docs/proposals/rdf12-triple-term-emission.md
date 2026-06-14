# Plan: RDF 1.2 Triple-Term (edge-annotation) emission

Status: accepted — design finalized (Opus review 2026-05-28). Ready to implement.
Owner: (json-tology agent)
Consumer: Annotated-edge emission pipeline (edge annotations on `bk:reviews` and similar)

## Resolved design decisions (Opus review)

Verified against the codebase; the plan's "current state" claims hold, with the
corrections below.

1. **Declaration shape: `Compose.annotatedEdge` (chosen — not the reserved keyword).**
   It matches the existing composition idiom (`subClassOf`/`equivalent`/`complementOf`),
   stays strict-graph-compatible (`$ref` to named primitives, no inline
   constraints), and the keyword alternative would require schema-compiler +
   graph-node-kind work anyway, so it is strictly more surface for no gain.
   ```ts
   const ReviewsBook = Compose.annotatedEdge({
     predicate: 'https://bookstore.example/reviews',
     targetRef: BookSchema.$id,                          // $ref to a named class
     annotations: {
       ratingGiven:      { $ref: RatingScoreSchema.$id }, // $ref to named datatypes
       verifiedPurchase: { $ref: VerifiedPurchaseSchema.$id },
     },
   });
   ```
   Like `Compose.equivalent`, the helper MUST use a `const` type parameter and a
   return type that preserves literal `predicate`/`$id`s — a widened `string`
   would poison `$ref` resolution and graph keying (this exact bug was just fixed
   in `equivalent`).

2. **N3 version corrected.** The repo uses `n3@^2.0.3` (NOT 1.26 as the plan
   states). Re-verify Turtle 1.2 triple-term serialization against the **v2**
   `Writer` API; do not rely on the v1.16 behavior described below.

3. **`graphIRI` becomes required for annotated-edge emission.** `toQuads`'
   `graphIRI` is optional today, but a triple term carries no graph membership,
   so the base + annotation quads MUST share one named graph. Emission of an
   annotated edge with no `graphIRI` MUST raise an intelligible error directing
   the caller to supply one — never silently fall back to the default graph.

## Architecture-mandatory additions (beyond the original capabilities)

These two were missing from the first draft and are REQUIRED, not optional.

### A. Model the annotated edge as a first-class canonical-graph relation
Per `CLAUDE.md`: "Do not add features that require validation to bypass the
canonical graph" and "$ref, composition … must all be representable in the
canonical graph." The annotated edge must therefore become a **new relation kind
in `SchemaGraph`** (e.g. `annotatedEdge` with sub-relations `edgePredicate`,
`edgeTarget`, `edgeAnnotation`), produced during translation from the authored
schema into the graph. `Projection` (ABox emit), `fromQuads` (lift), `validate`,
and `materialize` MUST all read from that graph relation — there must NOT be a
second emission path that special-cases the schema shape outside the graph.
`GraphEngine` consumes the new relation kind directly. Touch:
`src/modules/graph/SchemaGraph.ts`, `src/modules/graph/GraphEngine.ts`, and the
schema→graph translation that builds node kinds/relations.

### B. Define the inferred TypeScript type of an annotated edge
Annotation ranges are `$ref`s to named datatypes, so (after the branded-type
work) they infer as branded primitives. The inferred shape must be specified and
guarded by `test/types` assertions, e.g.:
```ts
type ReviewsBook = InferType<typeof ReviewsBookSchema, Refs>;
// ≅ {
//   readonly target: Book;                          // branded class type
//   readonly annotations: {
//     readonly ratingGiven:      RatingScore;        // branded datatype
//     readonly verifiedPurchase: VerifiedPurchase;   // branded datatype
//   };
// }
```
Add the inference branch in `src/types/Infer.ts` (recognize the `annotatedEdge`
shape produced by `Compose.annotatedEdge`) and a `test/types/annotated-edge.test.ts`
asserting the shape resolves to branded ranges (not `unknown`). Use the
dispatch-map idiom, not a nested-ternary arm, when adding the dispatcher branch.

## Motivation

Consumers need to annotate a *relationship* (an edge), not just a node. The canonical case is
a bookstore review relationship: the fact "Review rev-001 reviews Book 978-0-06-112008-4" carries
edge-level metadata (rating given, verified purchase flag, …) that cannot be modeled as binary
predicates on either endpoint. RDF 1.2 expresses this with a **triple term** as the subject of
the annotation triples:

```turtle
# all in the SAME named graph (e.g. https://bookstore.example/graph/reviews):
<urn:bookstore:instances/review/rev-001> bk:reviews <urn:bookstore:instances/book/978-0-06-112008-4> .  # base triple
<< <urn:bookstore:instances/review/rev-001> bk:reviews <urn:bookstore:instances/book/978-0-06-112008-4> >>
    bk:ratingGiven      5 ;
    bk:verifiedPurchase true .
```

**Critical invariant (named graphs):** a triple term `<< s p o >>` is a *value*; it carries no
graph membership. The base triple AND its annotation triples MUST be asserted in the **same**
named graph. Emission must stamp both with the same `graphIRI`.

## Current state in json-tology (verified)

- `toQuads(schema, data, { graphIRI, iriFor })` → `QuadInterface[]` (JsonTology public method).
  ABox projection in `src/modules/rdf/Projection.ts`; quad construction in
  `src/modules/rdf/QuadFactory.ts`.
- `QuadInterface` = rdf/js `Quad` (`src/interfaces/Quad.ts`, re-export of `@rdfjs/types#Quad`).
  Per the rdf/js data model a `Quad` IS a `Term` (`termType: 'Quad'`), so a quad's `subject`
  can already *be* a quad — the representation for triple terms exists; json-tology just never
  produces it.
- N3.js ≥ 1.16 (repo uses 1.26) parses **and serializes** Turtle 1.2 triple terms, so the
  downstream `Writer` path works once the quads carry a `Quad`-typed subject.
- There is **no schema mechanism** to declare an annotated edge, and `Projection` never emits a
  `Quad`-subject quad. SHACL/TBox serializers (`toShacl`, `toTbox`) do not model edge annotations.

## Required capabilities

### 1. Schema-level annotated-edge declaration
Add a first-class way for a schema to declare "this property is an annotated edge: it has a
target (object) plus a set of annotation properties." Two acceptable shapes — pick one, keep it
strict-graph-compatible (`$ref` to named primitives, no inline constraints):

- **Preferred — a `Compose` helper**, e.g. `Compose.annotatedEdge({ predicate, targetRef, annotations })`
  in `src/modules/composition/Compose.ts`, producing a subschema the projector recognizes; or
- **A reserved keyword** on the property (e.g. `x-jt-edgeAnnotation: { predicate, annotations }`)
  handled in the schema compiler.

The declaration must capture: the edge predicate IRI, the object/target term, and the annotation
properties (each a normal datatype/object property with its own range).

### 2. ABox emission (`toQuads` / `Projection`)
When the projector encounters an annotated edge it MUST emit:
1. the base triple `s predicate o` (graph = `graphIRI`), and
2. one quad per annotation: `subject = QuadFactory.quad(s, predicate, o)` (termType `'Quad'`),
   `predicate = annotationPredicate`, `object = annotationValue`, `graph = graphIRI`.

`QuadFactory` needs a constructor for a `Quad`-typed subject term (a quoted triple). Reuse the
existing literal/IRI term factories for the inner triple's terms. The inner triple's terms and
the outer annotation quads share the SAME `graphIRI` (enforce, don't leave default).

### 3. Round-trip (`fromQuads`)
`fromQuads` must recognize `Quad`-subject quads, group annotations by their quoted-triple
subject, and lift them back onto the annotated-edge shape so `instantiate`/`validate` round-trip.
`decodeLiteral` (`src/modules/rdf/Terms.ts`) applies to annotation literal values as usual.

### 4. Serialization compatibility
Verify the N3 `Writer` emits `<< s p o >>` Turtle 1.2 syntax for `Quad`-subject quads. If a
caller serializes via a different writer, document the requirement (rdf/js Quad-term support).

### 5. TBox / SHACL (scope-limited)
- TBox: annotation predicates are ordinary `owl:DatatypeProperty`/`owl:ObjectProperty`
  declarations — no special handling required beyond emitting them.
- SHACL over edge annotations is OUT of this plan's required scope (note as a follow-up);
  do not block emission on it.

## Acceptance criteria
1. A json-tology schema can declare an annotated edge (capability #1).
2. `toQuads(schema, instance, { graphIRI })` emits the base triple + each annotation as a
   `Quad`-subject quad, ALL stamped with `graphIRI`.
3. Serializing those quads with N3 `Writer` yields valid Turtle 1.2 reproducing the
   bookstore review/book example above (byte-compatible modulo prefix/spacing).
4. `fromQuads` round-trips the emitted quads back to the instance shape; `validate` passes.
5. Unit tests cover: single annotation, multiple annotations, IRI-valued annotation
   (`bk:featuredEdition` → Book IRI), and the same-graph invariant (annotation quads
   never land in a different graph than the base triple).

## Test fixture (use this exact case)
`Review rev-001 reviews Book 978-0-06-112008-4` annotated with `ratingGiven 5` and
`verifiedPurchase true`, in graph `https://bookstore.example/graph/reviews`.

## Pointers
- Public API surface: `JsonTology.toQuads` / `JsonTology.fromQuads`.
- ABox projector: `src/modules/rdf/Projection.ts`.
- Quad/term construction: `src/modules/rdf/QuadFactory.ts`, `src/modules/rdf/Terms.ts`.
- Quad type: `src/interfaces/Quad.ts` (rdf/js Quad — Quad-as-term already valid).
- Composition helpers: `src/modules/composition/Compose.ts`.
