---
title: Visualizing the ontology
---

# Visualizing the ontology

`bookstoreEntities.toTbox().jsonLd()` produces an OWL TBox in JSON-LD. The build script writes it to `docs/public/data/bookstore-tbox.jsonld`. Any OWL-aware tool can consume it.

## What's in the file

The published TBox describes:

- 6 entity classes (`Customer`, `Order`, `Book`, `OrderLine`, `Address`, `Review`)
- 17 atomic primitive classes (`Isbn`, `Email`, `Iso8601`, ...)
- 1 composite primitive (`Money`)
- 25 properties with `rdfs:domain` / `rdfs:range` annotations
- 2 `owl:equivalentClass` edges (`CustomerName` and `AuthorName` linked to `PersonName`)
- XSD-typed ranges for primitive properties (`xsd:date`, `xsd:dateTime`, `xsd:anyURI`, `xsd:integer`, `xsd:string`)

## Tools that consume OWL JSON-LD

| Tool | Use case | Notes |
|---|---|---|
| [WebVOWL](http://vowl.visualdataweb.org/webvowl.html) | Visual graph rendering with VOWL notation | Upload the file via the WebVOWL UI; URL-based loading is unreliable across origins |
| [Protégé](https://protege.stanford.edu/) | Full ontology IDE for editing, querying, reasoning | Open the file via File menu; native JSON-LD support requires a converter, but Protégé reads RDF/XML and Turtle directly |
| [Apache Jena](https://jena.apache.org/) | Java RDF library; SPARQL queries | `jena.fuseki` server-side; CLI tools for conversion |
| [rdflib](https://rdflib.readthedocs.io/) | Python RDF library | `rdflib.Graph().parse('bookstore-tbox.jsonld', format='json-ld')` |
| [N3 / EYE](https://josd.github.io/eye/) | Notation3 reasoner | Convert JSON-LD to N3 first |
| [`rdflib.js`](https://github.com/linkeddata/rdflib.js) | Browser-side RDF | Direct JSON-LD load |
| Any SPARQL endpoint | Federated queries against the TBox | Load the file into a triple store |

## Quick-start with WebVOWL

1. Run `npm run build:bookstore-graph` (or `npm run docs:build`, which runs it as a prebuild step) to regenerate `docs/public/data/bookstore-tbox.jsonld`.
2. Open [WebVOWL](http://vowl.visualdataweb.org/webvowl.html).
3. Click the **Ontology** menu in the top-right and select **Select ontology file**. Upload the `bookstore-tbox.jsonld` file.
4. WebVOWL converts and renders the ontology using the [VOWL visual notation](http://purl.org/vowl/).

For an in-page interactive view that doesn't require leaving the docs, see [Your types are already a graph](/your-types-are-a-graph), which renders the same TBox via Cytoscape.

## Why JSON-LD?

JSON-LD is the W3C-recommended JSON serialization of RDF. It's plain JSON. It's accepted by every major OWL/SPARQL tool. No special TypeScript runtime is required to read it. A back-end service in Python, Java, Go, or Rust can consume the same file and reason over it.

This is the central point: the schemas you authored in TypeScript become a portable ontology document the moment you call `toTbox().jsonLd()`. The TS type system is one consumer of the schemas. The OWL ecosystem is another. They share the same source.

## Related

- [Your types are already a graph](/your-types-are-a-graph) - in-page Cytoscape rendering of the same TBox
- [Graph concepts](/advanced/graph-concepts) - TBox/ABox semantics
- [Ontology and Graphs](/advanced/ontology) - `toTbox`, `toShacl`, `ontology` reference

## See also

- [Bookstore domain](/bookstore-domain) - the schema set rendered here
- [Graph-native authoring](/advanced/graph-native-authoring) - extracting concepts to named schemas so the TBox stays clean
