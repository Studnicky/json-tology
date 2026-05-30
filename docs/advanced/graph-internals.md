---
title: Graph internals
---

# Graph internals

These are the implementation details behind the canonical graph: how $ref resolves, how ABox
projects to RDF, $id conventions, the irreducible jt:* vocabulary, and how to query the TBox
programmatically. Prerequisite: [Graph concepts](./graph-concepts).

## JSON Pointer canonical identifiers

Every node in the schema graph has a stable identifier derived from JSON Pointer syntax.

**Schema-level IRI:** `$id` directly - `urn:bookstore:Book`.

**Sub-schema IRI:** `$id` + fragment - `urn:bookstore:Book#/properties/isbn`.

These stable pointers are used internally for:
- `$ref` resolution: `{ $ref: 'urn:bookstore:Isbn' }` resolves via the registry to the schema
  whose `$id` matches that string.
- Anchor lookup: `$anchor` values establish named pointer aliases within a schema.
- `subschemaAt` sub-schema selection: `jt.subschemaAt(schema, '/properties/isbn')` returns
  the `isbn` sub-schema node from the schema graph.

**Instance paths vs schema paths:** JSON Pointer appears in two distinct contexts:

| Context | Example | Points at |
|---|---|---|
| Schema path | `urn:bookstore:Book#/properties/isbn` | A *sub-schema* node in the schema graph |
| Instance path | `/isbn` | A *value* in a data object |

Schema paths are used for internal graph navigation and programmatic use.
Instance paths appear in validation error messages.

---

## Domain and range

Properties in OWL have `rdfs:domain` (the class the property belongs to) and `rdfs:range`
(the class or datatype of its value).

json-tology derives these from the schema graph:

<<< ../../examples/docs/advanced/62-graph-domain-range.ts

This emits (in the TBox):

```turtle
https://bookstore.example/isbn  rdfs:domain  urn:bookstore:Book .
https://bookstore.example/isbn  rdfs:range   urn:bookstore:Isbn .
```

For primitive string properties with a `format` hint, the range is an XSD datatype:

<<< ../../examples/docs/advanced/63-graph-format-xsd-mapping.ts

These emit:

```turtle
urn:bookstore:PublicationDate  rdfs:range  xsd:date .
urn:bookstore:Iso8601          rdfs:range  xsd:dateTime .
```

Supported format → XSD mappings include: `date` → `xsd:date`, `date-time` → `xsd:dateTime`,
`time` → `xsd:time`, `duration` → `xsd:duration`, `uri`/`iri`/`uri-reference` → `xsd:anyURI`.
Formats without an XSD equivalent (`email`, `uuid`, `hostname`, etc.) stay `xsd:string`.

---

## `$ref` resolution

The schema graph is a **directed graph**, not a tree. `$ref` creates edges between nodes.

<<< ../../examples/docs/advanced/64-graph-ref-resolution.ts

`$defs` entries live in the **same namespace** as their parent schema. They are part of
that schema's ontology surface:

<<< ../../examples/docs/advanced/88-graph-defs-namespace.ts

Here `LineItem` is accessible as `urn:bookstore:Order#/$defs/LineItem` - a node in the graph
whose parent is `urn:bookstore:Order`.

Cross-schema `$ref` values resolve through the registry. A `$ref` is looked up by its IRI
against all registered schemas. The graph edges connect nodes across schema boundaries.

---

## Serializers

The canonical graph backs three serializers - see [Ontology emission](/advanced/ontology) for the operator-level reference.

---

## ABox projection

ABox projection round-trips typed data through RDF quads - see [RDF round-trip](/advanced/quads).

---

## `$id` IRI conventions

`$id` values are IRIs. Two conventions are common:

| Prefix | When to use |
|---|---|
| `urn:` | Project-local schemas not published to the web |
| `https://` | Web-resolvable schemas |

The bookstore example uses `urn:bookstore:{PascalCase}` - e.g. `urn:bookstore:Isbn`,
`urn:bookstore:Book`.

<<< ../../examples/docs/advanced/65-graph-base-iri.ts

`baseIRI` is used by the serializers to expand CURIE prefixes and anchor relative IRIs. It does
not need to match the `$id` prefixes of the registered schemas - it is the base for the
ontology document itself.

---

## Querying the TBox

Once emitted as JSON-LD the TBox loads into any RDF store; standard SPARQL applies. See [Querying the TBox](/advanced/ontology#querying-the-tbox) for recipes.

---

## The irreducible `jt:*` set

json-tology emits standard W3C vocabulary wherever possible. A small set of JSON Schema
concepts has no standard counterpart and is represented using the `jt:` prefix:

| Keyword | Why `jt:` is needed |
|---|---|
| `jt:multipleOf` | Divisibility constraint - XSD and SHACL have no modulo predicate |
| `jt:dependentRequired` | Same SHACL gap - no standard property for co-required fields |
| `jt:alias` | Input-key normalization - a runtime concern for coercion, not an ontology property |
| `jt:computed` | Runtime-derived property - no standard predicate for "computed at materialize time" |
| `jt:strict` | Per-field validation behavior - a runtime coercion control, not an ontology property |
| `jt:frozen` | `Object.freeze` output - a runtime effect, not an ontology concern |
| `jt:config` | Config bag - a composite of the above runtime concerns |

Whenever a JSON Schema concept can be expressed in standard RDFS, OWL, SHACL, or XSD
vocabulary, json-tology emits it that way. The `jt:*` predicates are reserved for the
irreducibles.

JSON Schema `if`/`then`/`else` fragments are not currently emitted by either `ShaclProjection` or `OwlProjection`. These fragments are explicitly skipped during graph serialization.

## See also

- [Graph concepts](./graph-concepts) - TBox/ABox, open-world assumption, subClassOf, equivalence
- [Ontology and Graphs](/advanced/ontology) - `toTbox`, `toShacl`, `ontology`, `toQuads`, `fromQuads`
- [RDF round-trip](/advanced/quads) - operator-level `toQuads` / `fromQuads` reference
- [Querying the TBox](/advanced/ontology#querying-the-tbox) - querying the TBox with SPARQL
