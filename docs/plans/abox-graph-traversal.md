# Plan: ABox reference semantics + typed graph traversal

Status: proposed — design under review. Targets a minor release (0.x breaking allowed).
Owner: (json-tology agent)
Consumer: Node applications working with instance data as a connected, navigable graph —
"give me this Order, walk to its Customer and the Books it references, all typed."

## Motivation

`CLAUDE.md` states the canonical graph is *"lossless execution data intended to support TBox/ABox
reasoning **and graph exploration**."* Reasoning and serialization exist; **exploration does not**.

Today `toQuads` projects each instance independently. Relationships modeled as **scalar foreign
keys** (`order.customerId`, `review.bookIsbn`) emit as datatype-property *literals*, not
object-property edges — so a projected ABox is a set of disconnected per-fixture islands (the
bookstore demo lifts to 5 components). Even where instances link (nesting, `x-jt-iriRef`), there is
no API to *walk* the graph; a consumer filters quads by hand.

Two gaps, two fixes — separable, and composable:

1. **Reference semantics** — make foreign keys first-class references so the projected graph is
   *connected*.
2. **Traversal API** — make the connected graph *navigable*, yielding *typed* instances.

Composed with the existing `fromQuads`, the result is a typed, ontology-backed, traversable instance
graph in Node — a capability few JSON-Schema toolkits offer.

## Piece 1 — Reference semantics (`x-jt-ref`)

### Problem
A scalar property may be a foreign key to another entity's identity. JSON Schema cannot express
this; `$ref` is structural (inlines a subschema) and `x-jt-iriRef` only marks a value that already
*is* an IRI. Neither says "`customerId` identifies a `Customer` by its `customerId`."

### Keyword
A property-level keyword declaring a reference target and the key it matches:

```jsonc
"customerId": {
  "type": "string",
  "x-jt-ref": { "schema": "urn:bookstore:Customer", "key": "customerId" }
}
```

- `schema` — the `$id` of the referenced schema (the target entity class).
- `key` — the identity property on the target whose value this property matches
  (default: the target's declared identity / `$id`-bearing key).

### Projection behaviour (`toQuads`)
When a property carries `x-jt-ref`, projection emits an **object-property edge** to the referenced
instance's IRI instead of (or in addition to) the scalar literal:

- Resolve the target IRI via the same `iriFor` / `PredicateResolver` machinery the target instance
  was minted under (so the edge points at the *same* IRI the target projects to).
- Emits `<subject> <predicate> <targetIRI>` (NamedNode object) — a real RDF object property,
  reversible by `fromQuads`.
- Open decision: keep the scalar literal too (lossless, but duplicative) or replace it (clean graph,
  but the raw key is no longer in the quads). Leaning **replace**, with the key recoverable from the
  target instance.

### `fromQuads` behaviour
Lift the object-property edge back to the foreign-key scalar (or to a nested/linked instance,
depending on a `resolveRefs` option) so round-trips stay lossless under the schema contract.

### Why not just require IRI modeling?
`x-jt-iriRef` already connects authors who model references as IRIs. But real-world / relational /
DTO data overwhelmingly carries opaque scalar keys. `x-jt-ref` is the bridge that turns that data
into a graph **without rewriting the source shape** — the differentiator.

### Authoring ergonomics — composition helpers (REQUIRED)
Authors must never hand-write the `x-jt-ref` object. References are declared through the existing
`Compose` static-helper family (precedent: `Compose.subClassOf`, `Compose.extend`,
`Compose.intersection`, `Compose.equivalent`), so a reference reads as a first-class schema
operation and the keyword shape stays an implementation detail:

```ts
const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    orderId: { type: 'string' },
    // references the Customer entity by its identity key; the helper emits the
    // correct scalar type (matching the target key) + the x-jt-ref keyword.
    customerId: Compose.ref(CustomerSchema),
    // array-valued reference (one edge per element):
    bookIsbns: Compose.refs(BookSchema, { key: 'isbn' })
  }
} as const;
```

Helpers (names provisional, to mirror the `Compose` surface):
- `Compose.ref(target, options?)` — a single reference property to `target` (a schema with `$id`),
  matching `target`'s declared identity key (or `options.key`). Returns the property subschema
  `{ type: <target-key-type>, 'x-jt-ref': { schema: target.$id, key } }`.
- `Compose.refs(target, options?)` — array-valued variant (`type: 'array'`, `items` carrying the
  `x-jt-ref`).
- `Compose.identity(schema, key)` (or an `x-jt-identity` keyword) — declares which property is a
  schema's identity, so `Compose.ref(target)` needs no explicit `key` and traversal/`fromQuads`
  know the join column. Open: keyword vs. helper-only.

Type inference must flow through: `InferType` of a `Compose.ref(CustomerSchema)` property is the
target key's scalar type (e.g. `string`), and the traversal API resolves it to the typed
`Customer`. Compile-time chain checks follow the `Transform.chain` precedent (reject a `ref` whose
declared `key` is not a property of `target`).

## Piece 2 — Typed traversal API

### Substrate
Operate over a projected ABox (the quads from `toQuads`, unioned across instances) — the RDF graph
is the natural index. Build it once, expose navigation. References (Piece 1, `x-jt-iriRef`, `$ref`,
nesting) all become traversable edges uniformly.

### Surface (sketch — names provisional)
```ts
const graph = jt.aboxGraph(quads);          // or jt.toQuads(...).graph()

graph.node(iri)                              // the instance at iri (typed via fromQuads)
graph.out(iri, predicate?)                   // outgoing edges → { predicate, target }
graph.in(iri, predicate?)                    // incoming edges (who references iri)
graph.neighbors(iri)                         // both directions
graph.path(fromIri, toIri)                   // shortest path, if any
graph.subgraph(iri, depth)                   // bounded neighborhood
graph.instancesOf(schemaId)                  // all instances of a type
```

- Results are **typed**: `node()` / traversal targets lift through `fromQuads` to the instance's
  inferred type (keyed by the schema map), not raw quads.
- Predicate arguments accept the canonical predicate IRI **or** the authored property name (resolved
  through `PredicateResolver`).
- Read-only and in-memory; backed by indexes (subject→edges, object→edges, type→subjects).

### Composition
`x-jt-ref` (connect) + traversal (navigate) + `fromQuads` (type) is the whole story:
`graph.out(order, 'customer')` returns a typed `Customer`.

## Non-goals (for this iteration)
- No persistent store / external graph DB — in-memory over projected quads only.
- No SPARQL/Cypher surface — a focused navigation API, not a query language.
- No write/mutation traversal — read-only exploration.

## Open decisions
- `x-jt-ref` literal-vs-edge: replace the scalar or keep both (leaning replace).
- Traversal entry point: a method on `JsonTology` (`aboxGraph(quads)`) vs a returned object from
  `toQuads`. Leaning a standalone `aboxGraph` so it also accepts externally-sourced quads (n3,
  eyereasoner) symmetric with `fromQuads`.
- Identity declaration: does `x-jt-ref.key` default to a per-schema declared identity property
  (a new `x-jt-identity`?) or stay explicit per reference.
- Cardinality: array-valued references (`orderLines[].bookIsbn`) — natural (one edge per element).

## Phasing
1. **Phase 1 — reference semantics + composition helpers.** `x-jt-ref` keyword + type;
   `Compose.ref` / `Compose.refs` (and identity declaration) as the authoring surface; projection
   emits object-property edges; `fromQuads` reverses. Unit + round-trip + type-assertion tests
   (`InferType` of a `ref` property, compile-time bad-key rejection). The bookstore domain adopts
   `Compose.ref` for `customerId` / `bookIsbn`, so its ABox connects natively (and the docs graph
   demo becomes a true connected graph — no viz heuristic).
2. **Phase 2 — traversal API.** `aboxGraph(quads)` + navigation methods, typed via `fromQuads`.
   Unit tests over the now-connected bookstore ABox; e2e walking Order→Customer→…→Book.
3. **Phase 3 — docs.** "Working with instance graphs in Node" guide; the `BookstoreGraph` ABox tab
   showcases real traversal instead of per-fixture islands.

## Impact on the current docs work
The shipped TBox/ABox tabs, fcose layout, readable labels, and the multi-representation inspector
are independent of this plan and commit on their own. Once Phase 1 lands, the docs ABox connects via
real object properties (no docs-side foreign-key heuristic) — the demo then *demonstrates* the
capability rather than faking it.
