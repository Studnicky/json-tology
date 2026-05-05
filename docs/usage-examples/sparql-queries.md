# SPARQL queries

Once you have a TBox, you can query it with SPARQL. The `toTbox().jsonLd()` output is a valid JSON-LD document that can be loaded into any RDF store.

```sparql
# Find all subclasses of urn:bookstore:Customer
SELECT ?subclass WHERE {
  ?subclass rdfs:subClassOf <urn:bookstore:Customer> .
}

# Find all properties whose range is urn:bookstore:Isbn
SELECT ?property WHERE {
  ?property rdfs:range <urn:bookstore:Isbn> .
}

# Find all named primitives (classes that are not object schemas)
SELECT ?cls WHERE {
  ?cls a owl:Class .
  FILTER NOT EXISTS { ?cls rdfs:subClassOf ?parent . }
}
```

## Usage with N3.js

```ts
import { Store, Parser } from 'n3';

const store = new Store();
const parser = new Parser({ format: 'application/ld+json' });

parser.parse(entities.toTbox().jsonLd(), (error, quad) => {
  if (quad) store.addQuad(quad);
});

// Query: all subclass relations
const subclasses = store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#subClassOf', null, null);
```

## Related

- [Graph concepts](/advanced/graph-concepts) - TBox vs ABox, domain and range
- [Ontology and Graphs](/advanced/ontology) - `toTbox`, `toShacl`, `ontology`
- [RDF round-trip](/advanced/quads) - `toQuads` / `fromQuads` for ABox data
