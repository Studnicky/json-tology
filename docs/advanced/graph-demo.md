# Graph demo (live)

This page renders the bookstore TBox as an interactive graph. The data is generated at build time
from `entities.toTbox().raw()` — the same OWL quads that feed the serialization pipeline.

<BookstoreGraph />

Click any node to inspect its schema and graph relations in the side panel.

---

## Legend

### Nodes

| Color | Meaning |
|---|---|
| Dark blue (`#005a9c`) | Entity schema — has object properties (Book, Customer, Order, ...) |
| Light blue (`#a8d1f0`) | Primitive schema — a named leaf type (Isbn, Email, Money, ...) |

### Edges

| Style | Kind | Meaning |
|---|---|---|
| Solid gray arrow | `subClassOf` | Source is a subclass of target (from `Compose.extend`) |
| Green dashed | `equivalentClass` | Logically identical classes (from `Compose.equivalent`) |
| Solid blue vee | `range` | A property of the source points to the target class |
| Dotted orange | `domain` | Explicit `rdfs:domain` override (rare, usually inferred) |

### How the graph is built

The build script at `scripts/build-bookstore-graph.mjs` runs `entities.toTbox().raw()` and
transforms the raw JSON-LD nodes into Cytoscape elements. Class nodes become graph nodes;
property nodes (identified by their `#` fragment) become edges between the class nodes at their
`rdfs:domain` and `rdfs:range`.

Edges to XSD datatypes (e.g. `xsd:string`, `xsd:dateTime`) and `rdf:List` are omitted to keep
the graph readable — those appear in the SHACL `sh:datatype` output instead.

### Reproducing the data

```bash
npm run build:bookstore-graph
# Writes docs/.vitepress/data/bookstore-graph.json
# Writes docs/.vitepress/data/bookstore-schemas.json
```

The graph JSON is also auto-regenerated as part of `npm run docs:build`.

### Querying the same TBox in SPARQL

```ts
import { bookstoreEntities as entities } from './examples/docs/bookstore/index.js';

// Render TBox to JSON-LD string — load into any RDF store
const tboxJsonLd = entities.toTbox().jsonLd();
```

```sparql
-- Find all properties whose range is urn:bookstore:Isbn
SELECT ?property WHERE {
  ?property rdfs:range <urn:bookstore:Isbn> .
}

-- Find all entity classes (those with at least one property)
SELECT DISTINCT ?class WHERE {
  ?property rdfs:domain ?class .
}
```

See [Graph concepts](./graph-concepts.md) for a full conceptual walkthrough.
