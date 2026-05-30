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

## Piece 2 — Typed traversal API (a fluent RDF cursor)

Operate over a projected ABox (quads from `toQuads`, unioned), indexed once. Associations (Piece 1)
make object-property edges and identity foreign keys traversable uniformly; `fromQuads` makes
results typed. The conceptual model is ORM-like (typed entities + their relationships); the **access
paths use RDF terminology** (subjects/predicates/objects, domain/range/subClassOf); and navigation is
**fluent dot-chaining over a lazy `Cursor`** — read left-to-right, not nested calls, not a
path-expression DSL.

The view spans **both layers**: instance paths over the projected ABox quads, and schema paths over
the registry's TBox (which already carries `rdfs:domain`/`rdfs:range`/`rdfs:subClassOf`/
inverse-functional as quads).

```ts
const g = jt.aboxGraph(quads);              // RDF graph view: ABox quads + the registry TBox
                                            // (also accepts external n3 / eyereasoner quads)

// Entry points → a Cursor (a lazy, typed selection of resources):
g.resource(iri)                              // Cursor over { iri }
g.instances(classIri)                        // Cursor over all resources of rdf:type classIri

// Chainable navigation (Cursor → Cursor), dot-chained left → right:
cursor.objects(predicate)                    // forward: objects of each resource via predicate (identity FKs resolved)
cursor.subjects(predicate)                   // inverse (^predicate): resources that point at each via predicate
cursor.subgraph(depth)                       // expand to the bounded N-hop neighbourhood
cursor.filter(classIri)                      // keep only resources whose rdf:type is classIri

// Terminals (Cursor → typed values):
cursor.one()                                 // the single typed instance (throws if 0 or >1); .first() for lenient
cursor.all()                                 // typed instance[]  (alias: .resources())
cursor.iris()                                // the underlying IRIs
cursor.count()

// Schema (TBox) paths — also return a Cursor (over classes / predicates), chainable:
g.predicate(name).domain()                   // the rdfs:domain class(es) of a predicate
g.predicate(name).range()                    // the rdfs:range class / datatype
g.class(classIri).subClassOf()               // direct superclasses (.subClassOf({ transitive: true }) walks up)
g.class(classIri).properties()               // declared properties (predicates whose domain is this class)
```

Dot-chaining gives multi-hop without a DSL:

```ts
// Order → its OrderLines → the Books they reference, as typed Book[]:
g.resource(orderIri).objects('orderLines').objects('bookIsbn').all();

// Everything that references this Customer (Orders + Reviews, via the customerId FK):
g.resource(customerIri).subjects('customerId').all();

// The schema side, same vocabulary:
g.predicate('orderLines').range().one();     // → the OrderLine class schema
```

- Predicates are addressable by IRI/CURIE **or** the authored property name, resolved via
  `PredicateResolver` (`'customerId'` → its flat predicate IRI).
- `.objects('customerId')` resolves the inverse-functional identity foreign key to the typed
  `Customer` (not the raw UUID); `.subjects('customerId')` is the inverse.
- `g.predicate('orderLines').range()` reads the TBox the registry already holds, so schema and data
  are walked with one cursor vocabulary.
- Cursors are lazy: navigation builds an IRI set; terminals materialize and type via `fromQuads`.
- Read-only, in-memory, index-backed: subject→(predicate,object), object→(predicate,subject),
  identity→subject (inverse-functional), rdf:type→subjects, plus the TBox domain/range/subClassOf index.

### Scope boundary — simple fluent helpers, not a query engine
Each cursor step is one plain hop (`.objects`/`.subjects`), plus a depth-bounded `.subgraph`.
**Multi-hop is fluent dot-chaining** (`g.resource(order).objects('orderLines').objects('bookIsbn')`)
— read left to right, no nested calls, and crucially **no path-expression string to parse**. We
deliberately do **not** ship SPARQL property paths, a query language, or a general RDF
store/reasoner — that is reimplementing n3.js / Comunica, the opposite of the goal. The aim is
ergonomic, typed navigation of an already-projected graph. If a richer query surface is ever wanted,
hand the quads to a dedicated engine rather than grow one here.

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
   `aboxGraph(quads)` returning a fluent typed `Cursor`: entry points (`resource` / `instances`),
   chainable hops (`.objects` / `.subjects` / `.subgraph` / `.filter`), terminals (`.one` / `.all` /
   `.iris` / `.count`), and schema cursors (`g.predicate(p).domain()/.range()`,
   `g.class(c).subClassOf()/.properties()`) — with lazy FK resolution via the identity index (no
   `toQuads` change yet). Typed via `fromQuads`. Unit + e2e over the bookstore
   (`g.resource(order).objects('customerId').one()` → typed Customer;
   `g.predicate('orderLines').range().one()` → OrderLine; `g.resource(order).subgraph(2)`) +
   type-assertion tests.
   The docs ABox tab then renders the FK-resolved edges from the same association index — connected,
   no heuristic.
2. **Phase 2 (only if needed) — optional FK edge materialization + docs guide.** If lazy resolution
   proves insufficient, evaluate `enableReferenceFallback` projection mode (A/B) to materialize FK
   edges into `toQuads` output. Ship the "instance graphs in Node" docs guide.
3. **Phase 3 (deferred) — `Compose.ref` override** for the non-derivable references (cross-graph,
   ambiguous identity primitive). Not needed by the bookstore.

## Impact on shipped docs work
The merged TBox/ABox tabs, fcose layout, readable labels, and inspector are independent. Once Phase 1
lands, the docs ABox connects via the association index (real associations, no viz heuristic) and the
demo *demonstrates* the ORM-for-graphs capability.
