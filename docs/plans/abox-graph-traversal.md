# Plan: typed ABox graph traversal — "an ORM for graphs"

Status: proposed — design under review. Targets a minor release (0.x breaking allowed).
Owner: (json-tology agent)
Consumer: Node applications that want to work with instance data as a connected, navigable,
**typed** graph — "load this Order, walk to its Customer and the Books it references."

## Key realization: the associations already exist in the TBox

json-tology already derives, from authored schemas, everything an ORM calls an *association*:

- **Object-property associations** — a property whose range is another registered class emits
  `owl:ObjectProperty` + `rdfs:domain`/`rdfs:range` in the TBox (verified: the bookstore TBox emits
  all three). `$ref`-to-entity references (`Order.shippingAddress → Address`, `Order.orderLines →
  OrderLine`, `Order.orderTotal → Money`) **already project as object-property edges and already
  connect in the ABox.** This part works today.
- **Identity** — `Customer.customerId` is declared `owl:InverseFunctionalProperty` and `required`
  (verified in the TBox). That *is* the statement "`customerId` uniquely identifies a `Customer`."

So this is **not** a "model the data differently / add a keyword" feature. The schema layer already
knows the relationships. What is missing is a layer that **reads those associations and uses them to
navigate the ABox** — the ORM/query surface. Two gaps remain:

1. **Identity-keyed foreign keys are not resolved.** `Order.customerId` is `$ref: CustomerId` — the
   *same primitive type* as `Customer`'s inverse-functional identity — but its value projects as a
   scalar, not a link. Nothing joins `Order.customerId` to the `Customer` it identifies, even though
   the TBox has the inverse-functional declaration to do so. (This, not object-refs, is why the
   bookstore ABox shows islands.)
2. **No traversal API.** Even where instances link, a consumer filters quads by hand.

"Models = schemas (have). Associations = TBox object-properties + inverse-functional identities
(have). Query / eager-load = the new layer."

## Piece 1 — Association model (derive, don't re-declare)

A read-only association index built from the existing TBox, per registered schema:

- **Object associations**: for each `owl:ObjectProperty`, `{ property, from: domainClass,
  to: rangeClass, cardinality }` (cardinality from array vs scalar + restrictions). Already emitted.
- **Identity**: for each `owl:InverseFunctionalProperty` (+ `required`), the class's identity
  property and its primitive type (e.g. `Customer` ← `customerId : CustomerId`).
- **Foreign-key associations (derived)**: a property typed as some class C's identity primitive,
  on a *different* class, is a foreign key to C. `Order.customerId : CustomerId` ⇒ `Order` →
  `Customer` by identity. Derivable purely from existing constructs (inverse-functional + shared
  `$ref` primitive). No new authoring required for the common case.

Open: ambiguity (two classes sharing one identity primitive) and cross-graph references may need an
explicit override — see "Optional explicit override" below.

## Piece 2 — Typed traversal API (RDF access paths)

Operate over a projected ABox (quads from `toQuads`, unioned), indexed once. Associations (Piece 1)
make object-property edges and identity foreign keys traversable uniformly; `fromQuads` makes
results typed. The conceptual model is ORM-like (typed entities + their relationships), but the
**access paths use proper RDF terminology** — subjects, predicates, objects, inverse, property
paths, and Concise Bounded Description — not ORM verbs.

The view spans **both layers**: instance access paths over the projected ABox quads, and schema
access paths over the registry's TBox (which already carries `rdfs:domain`/`rdfs:range`/
`rdfs:subClassOf`/inverse-functional as quads). Schema and data are traversable through the same
surface.

```ts
const g = jt.aboxGraph(quads);              // RDF graph view: ABox quads + the registry TBox
                                            // (also accepts external n3 / eyereasoner quads)

// ── ABox (instance) access paths ──
g.resource(iri)                              // the resource at iri, typed via fromQuads
g.objects(subject, predicate)                // objects of (subject, predicate) — forward; resolves identity FKs to the typed target
g.subjects(predicate, object)                // subjects of (predicate, object) — the inverse path (^predicate)
g.predicates(subject)                        // predicates asserted with subject in subject position
g.instances(classIri)                        // resources whose rdf:type is classIri
g.path(fromIri, toIri)                       // a connecting property path between two resources, if any

// ── TBox (schema) access paths ── over rdfs:domain / rdfs:range / rdfs:subClassOf
g.domain(predicate)                          // the rdfs:domain class(es) of a predicate (typed schema)
g.range(predicate)                           // the rdfs:range class(es) / datatype of a predicate
g.subClassOf(classIri)                       // direct rdfs:subClassOf superclasses (use a property path for transitive)

// ── Bounded neighbourhoods ──
g.subgraph(iri, depth)                       // the subgraph within `depth` hops of iri (BFS bound), nodes typed
g.describe(iri)                              // Concise Bounded Description (CBD) — the canonical RDF resource description

// ── Property paths (SPARQL 1.1 style) for multi-hop access, across ABox AND schema predicates ──
g.traverse(subject, 'orderLines/bookIsbn')   // sequence: Order → OrderLine → Book (FK resolved), typed
g.traverse(customerIri, '^customerId')        // inverse: subjects whose customerId identifies this Customer
g.traverse(predicate, 'rdfs:range/rdfs:subClassOf*')  // schema walk: a predicate's range, then up its class hierarchy
```

- Predicates are addressable by IRI/CURIE **or** the authored property name, resolved to the
  canonical predicate via `PredicateResolver` (e.g. `'customerId'` → its flat predicate IRI).
- `objects(order, 'customerId')` resolves the inverse-functional identity foreign key and returns
  the typed `Customer` (not the raw UUID); `subjects('customerId', customer)` is the inverse.
- `domain`/`range` read the TBox the registry already holds — `range('orderLines')` → the
  `OrderLine` class schema — so you can walk schema and data with one vocabulary.
- `subgraph(iri, depth)` expands a bounded N-hop neighbourhood (BFS to `depth`); `describe` is the
  stricter Concise Bounded Description. Both lift nodes to their type via `fromQuads`.
- `traverse` accepts SPARQL-style property paths (sequence `/`, inverse `^`, alternative `|`,
  repetition `*`/`+`/`?`) and works over ABox predicates and schema predicates (`rdfs:range`,
  `rdfs:subClassOf`, …) alike.
- Results are **typed** through `fromQuads` and the schema map.
- Read-only, in-memory, index-backed: subject→(predicate,object), object→(predicate,subject),
  identity→subject (inverse-functional), rdf:type→subjects, plus the TBox domain/range/subClassOf index.

## Foreign-key round-trip (resolved decision)

When a derived foreign key is *materialized into the graph as an edge* (so traversal/connectivity
works without a separate resolution step):

- **Default = A (edge-only), strict.** Project the FK as an object-property edge to the target IRI;
  `fromQuads` reconstructs the scalar by reading the target instance's identity. Strict-by-default
  (`feedback_strict_by_default`): the graph carries no redundant scalar. If `fromQuads` cannot
  reconstruct (target absent from the quad set), it raises a structured error — no silent loss.
- **Opt-in fallback = B**, via `enableReferenceFallback: false` default (strict). Set `true` to also
  emit the scalar literal alongside the edge, guaranteeing lossless round-trips even when the target
  is absent (partial graphs, streaming) at the cost of a redundant value.

Note this materialization is *optional* — `graph.related()` can also resolve foreign keys lazily at
traversal time from the inverse-functional index without rewriting projection. Phase 1 evaluates
lazy-resolution-first (least invasive) before changing `toQuads` output.

## Optional explicit override (NOT the foundation)

For references the TBox cannot derive (cross-graph, ambiguous identity primitive, or a scalar that
*is not* a `$ref` to an identity type), an explicit declaration via the existing `Compose` family:
`Compose.ref(targetSchema, { key })` → marks a property as a foreign key to `targetSchema`'s
identity. This is a convenience/disambiguator layered *on top of* the derived model, not a
prerequisite. The bookstore needs none of it — its inverse-functional `customerId` already suffices.

## Non-goals (this iteration)
- No persistent store / external graph DB — in-memory over projected quads.
- No SPARQL/Cypher surface — a focused navigation/eager-load API.
- No write/mutation traversal — read-only exploration.

## Phasing
1. **Phase 1 — association index + lazy traversal (ABox + schema paths).** Read object-property +
   inverse-functional identity + `rdfs:domain`/`range`/`subClassOf` associations from the TBox; build
   `aboxGraph(quads)` with the RDF access paths — instance (`resource` / `objects` / `subjects` /
   `predicates` / `instances` / `path`), schema (`domain` / `range` / `subClassOf`), and bounded
   (`subgraph(iri, depth)` / `describe`) — with lazy FK resolution via the identity index (no
   `toQuads` change yet). Typed via `fromQuads`. Unit + e2e over the bookstore (`objects(order,
   'customerId')` → typed Customer; `range('orderLines')` → OrderLine; `subgraph(order, 2)`) +
   type-assertion tests. The docs ABox tab then renders the FK-resolved edges from the same
   association index — connected, no heuristic.
2. **Phase 2 — property paths + Concise Bounded Description + optional edge materialization.**
   `traverse(subject, '<property-path>')` (sequence / inverse / repetition) and `describe` depth/
   predicate selection; evaluate `enableReferenceFallback` projection mode (A/B) if materialized FK
   edges prove preferable to lazy resolution.
3. **Phase 3 — `Compose.ref` override** for the non-derivable cases, + docs guide
   ("instance graphs in Node").

## Impact on shipped docs work
The merged TBox/ABox tabs, fcose layout, readable labels, and inspector are independent. Once Phase 1
lands, the docs ABox connects via the association index (real associations, no viz heuristic) and the
demo *demonstrates* the ORM-for-graphs capability.
