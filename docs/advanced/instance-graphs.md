# Instance graphs (`aboxGraph`) <Badge type="tip" text="Runtime" />

`jt.aboxGraph(quads)` builds an in-memory typed graph view over a set of ABox quads and exposes a fluent cursor API for navigating it. The mental model is an ORM for graphs: entities are typed by their registered schemas, associations derive from the TBox that those schemas already emit (`rdfs:domain`, `rdfs:range`, `owl:InverseFunctionalProperty`), and navigation is left-to-right dot-chaining over a lazy cursor — no query language, no nested calls, no path strings to parse.

<<< ../../examples/docs/advanced/106-abox-graph.ts

## Concepts

### Quads-in, typed graph out

Pass any `QuadInterface[]` to `jt.aboxGraph(quads)`. The quads come from `jt.toQuads()`, from an external n3 parser, from EYE-reasoner output, or from any RDF/JS-compatible source. The graph is indexed once at construction time; subsequent cursor calls are in-memory set operations.

The same TBox the registry already holds is unioned into the graph view automatically. Schema associations (`rdfs:domain`, `rdfs:range`, `rdfs:subClassOf`, inverse-functional identity) are read from there — no separate configuration is required.

### The cursor

Every entry point returns a `Cursor` — a lazy, typed selection of resources. Cursors compose via dot-chaining. Terminals (`one`, `first`, `all`, `iris`, `count`, `some`, `none`) materialize the selection.

```
g.resource(iri)           → Cursor over { iri }
g.instances(classIri)     → Cursor over all resources of rdf:type classIri
```

Navigation chains (Cursor → Cursor):

| Method | Direction | Notes |
|---|---|---|
| `.objects(predicate)` | Forward — each resource's objects via predicate | FK-resolved via inverse-functional identity |
| `.subjects(predicate)` | Inverse — resources that point at each resource | The `^predicate` direction |
| `.ofType(classIri)` | Filter by `rdf:type` | |
| `.where(fn)` | Filter by typed JS predicate over the lifted instance | |
| `.having(predicate, value)` | Match a specific value | |
| `.closure(predicate)` | Transitive hop — `p+`/`p*` bounded BFS | |
| `.subgraph(depth)` | Bounded N-hop neighbourhood expansion | |

Set operations and modifiers (Cursor → Cursor):

| Method | |
|---|---|
| `.union(cursor)` | Set union |
| `.intersect(cursor)` | Set intersection |
| `.distinct()` | Deduplicate |
| `.orderBy(compareFn)` | Sort by typed instances |
| `.limit(n)` | Bound the result set |

Terminals (Cursor → values):

| Method | Returns |
|---|---|
| `.one()` | Single typed instance — throws `CURSOR_CARDINALITY` if 0 or >1 |
| `.first()` | First typed instance, or `undefined` if empty |
| `.all()` | Typed instance array (alias: `.resources()`) |
| `.iris()` | The underlying IRI strings |
| `.count()` | Number of selected resources |
| `.some()` | `true` if count > 0 |
| `.none()` | `true` if count === 0 |

### Schema cursors

The same cursor vocabulary exposes the TBox. Schema cursors operate over classes and predicates rather than instances.

```
g.predicate(name).domain()                     → Cursor over rdfs:domain class(es)
g.predicate(name).range()                      → Cursor over rdfs:range class / datatype
g.class(classIri).subClassOf()                 → Direct superclasses
g.class(classIri).subClassOf({ transitive: true })  → Full transitive closure upward
g.class(classIri).properties()                 → Predicate IRIs whose domain is this class
```

Predicates are addressable by authored property name (`'shippingAddress'`), by IRI, or by CURIE — `PredicateResolver` maps names to their flat predicate IRI automatically.

### Foreign-key resolution

`Order.customerId` carries the same UUID type (`$ref: CustomerId`) that `Customer.customerId` is declared as `owl:InverseFunctionalProperty`. The cursor reads that TBox declaration and resolves the scalar FK to the typed `Customer` at traversal time — no extra schema authoring, no `toQuads` change.

`.objects('customerId')` follows the FK forward to the `Customer`. `.subjects('customerId')` is the inverse: all resources that reference a given Customer via that predicate.

A foreign key resolves whenever its **range primitive backs an `owl:InverseFunctionalProperty` identity** on a target class — even when the key is named differently from the identity property. `Review.bookIsbn` and `OrderLine.bookIsbn` (range `Isbn`) resolve to the `Book` identified by its inverse-functional `isbn` (also range `Isbn`); subclass-typed instances (a `RareBook`) inherit their parent's identity. A property whose range backs no declared identity stays a literal value. (One constraint: array-property `range()` yields the RDF collection type `rdf:List`, since the item type is in the array encoding rather than a single `rdfs:range` triple — use a scalar object property for schema-cursor range demos.)

### Multi-hop navigation

Multi-hop is fluent dot-chaining — read left to right:

<!-- inline-ts-ok: illustrative snippet — variables established by surrounding prose, not a standalone runnable example -->
```ts
// Order → its OrderLines → the Books they reference (bookIsbn FK resolved), no DSL:
g.resource(orderIri).objects('orderLines').objects('bookIsbn').all();

// Everything that references this Customer:
g.resource(customerIri).subjects('customerId').all();
```

### Result typing

Terminals call `fromQuads` internally on the resolved IRI set and return `unknown`. Cast via a `Record<string, unknown>` helper to stay strict (no `any`):

<!-- inline-ts-ok: illustrative cast pattern — not a standalone runnable example -->
```ts
function record(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

const name = record(cursor.one())['name'];
```

### Scope

`aboxGraph` is an in-memory read-only cursor over projected quads — not a persistent store, not a SPARQL engine, not a reasoner. For multi-variable joins, GROUP-BY, OPTIONAL, or full SPARQL property paths, pass the standard RDF/JS quads to a dedicated engine (n3.js, Comunica). The cursor is the ergonomic fast path for typed instance navigation where the schemas already carry the associations.
