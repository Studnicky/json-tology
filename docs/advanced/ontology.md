# Ontology and Graphs

> Validation modes: [Validation modes reference](/validation-modes)

> **Conformance status:** RDF/OWL/SHACL conformance is aspirational and a work in progress. Output loads into reasoners like Apache Jena and editors like Protege, but full normative conformance is still being built out. See [References - Standards conformance](/references#standards-conformance). File issues at [github.com/Studnicky/json-tology/issues](https://github.com/Studnicky/json-tology/issues).
>
> You only need this section if you want to emit or consume **RDF/OWL/SHACL** output, perform graph-based reasoning, or round-trip data through an RDF store. If you are building a TypeScript application that validates and coerces data, the core guides (Schemas, Validation, Composition, Transforms) are all you need. The ontology features are fully tree-shakable - importing from `json-tology/ontology` does not increase the bundle of consumers who only import from `json-tology`, `json-tology/value`, or `json-tology/types`.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used throughout these examples. The same canonical graph used for validation is the source of truth for all ontology output - there is no second semantic model.

---

## `jt.toTbox` {#jt-totbox}

**Declaration.** Returns a fresh `OntologyBuilder` containing only the OWL TBox derived from all registered schemas - class declarations, property declarations, domain and range assertions, and cardinality constraints. No SHACL shapes are included. Not cached - every call builds a new `OntologyBuilder`.

**Use this when** you need only the OWL TBox (class/property vocabulary) without SHACL structural constraints - for example, when loading class definitions into an OWL reasoner, publishing a schema as Linked Data vocabulary, or merging TBox quads into an existing knowledge graph without overwriting separately managed shape constraints.

**Don't use this when** you want both TBox and SHACL in a single document - use [`ontology()`](#jt-ontology) for that. Don't use it when you only want structural validation shapes - use [`toShacl()`](#jt-toshacl).

### Examples

#### Example 1: Generate OWL TBox JSON-LD from bookstore schemas

<<< ../../examples/docs/advanced/03-ontology.ts

#### Example 2: Merge TBox with separately sourced ABox

<<< ../../examples/docs/advanced/19-merge-tbox-abox.ts

### Bad examples

<<< ../../examples/docs/advanced/84-ontology-totbox-not-cached.ts

### Comparison

| Tool | OWL TBox generation |
|------|---------------------|
| json-tology `toTbox()` | Full OWL vocabulary from registered JSON Schemas |
| TypeBox | No ontology output |
| Zod | No ontology output |
| AJV | No ontology output |
| Pydantic `model_json_schema()` | JSON Schema only - no OWL/SHACL |

### Related

- [`toShacl()`](#jt-toshacl) - SHACL shapes only
- [`ontology()`](#jt-ontology) - combined TBox + SHACL (cached)
- [`toQuads()`](#jt-toquads) - ABox individual data

### See also

- [Bookstore domain](/bookstore-domain) - schemas used in examples

---

## `jt.toShacl` {#jt-toshacl}

**Declaration.** Returns a fresh `OntologyBuilder` containing only the SHACL shapes derived from all registered schemas - node shapes and property shapes encoding structural constraints. No OWL class or property declarations are included. Not cached - every call builds a new `OntologyBuilder`.

**Use this when** you need only the SHACL shapes - for example, when validating RDF data in a SHACL processor, publishing shapes for a shared API contract, or loading shapes into a triplestore that manages its own TBox separately.

**Don't use this when** you want both TBox and SHACL - use [`ontology()`](#jt-ontology). Don't use it when you only need OWL class vocabulary - use [`toTbox()`](#jt-totbox).

### Examples

#### Example 1: Generate SHACL shapes JSON-LD from bookstore schemas

<<< ../../examples/docs/advanced/20-toshacl-shapes.ts

#### Example 2: SHACL-only export for a validation pipeline

<<< ../../examples/docs/advanced/21-toshacl-validation-pipeline.ts

### Bad examples

<<< ../../examples/docs/advanced/85-ontology-toshacl-shaclObject.ts

### Comparison

| Tool | SHACL shapes generation |
|------|-------------------------|
| json-tology `toShacl()` | Full SHACL node/property shapes from JSON Schemas |
| TypeBox | No SHACL output |
| Zod | No SHACL output |
| AJV | No SHACL output |
| Pydantic `model_json_schema()` | JSON Schema only - no OWL/SHACL |

### Related

- [`toTbox()`](#jt-totbox) - OWL TBox only
- [`ontology()`](#jt-ontology) - combined TBox + SHACL (cached)

### See also

- [Bookstore domain](/bookstore-domain) - schemas used in examples

---

## `jt.ontology` {#jt-ontology}

**Declaration.** Returns an `OntologyBuilder` derived from all registered schemas containing both the OWL TBox and SHACL shapes. The result is cached - subsequent calls return the same builder until a new schema is registered. The `OntologyBuilder` exposes methods for JSON-LD, SHACL, raw quads, and the prefix context.

**Use this when** you need both TBox output (class definitions, property declarations, domain/range assertions) and SHACL shapes from your schemas in a single artifact - for use in an OWL reasoner, a semantic knowledge graph, or an API that consumes JSON-LD.

**Don't use this when** you need only one vocabulary - use [`toTbox()`](#jt-totbox) for OWL only or [`toShacl()`](#jt-toshacl) for SHACL only. The separation avoids coupling two concerns when a consumer only needs one.

### Examples

#### Example 1: Generate OWL JSON-LD for all bookstore schemas

<<< ../../examples/docs/advanced/22-ontology-both-tbox-shacl.ts

#### Example 2: OWL and SHACL from cross-referenced schemas

`CustomerSchema` has `addresses: [Address]` via `$ref`. The ontology output produces `rdfs:domain` and `rdfs:range` relations between the Customer class and the Address class.

<<< ../../examples/docs/advanced/12-ontology-cross-refs.ts

---

## `jt.toQuads` {#jt-toquads}

**Declaration.** Projects instance data into RDF quads (ABox individuals) and returns a `QuadInterface[]` array of the projected nodes. Validates the data against the schema before projecting - throws `MaterializationError` if validation fails. Inverse of [`fromQuads`](#jt-fromquads). See [RDF round-trip](/advanced/quads) for the full quad pattern.

**Use this when** you want to produce ABox (instance-level) RDF triples from validated domain objects - for storage in an RDF triplestore, for input to a reasoner, or for export as Linked Data.

### Examples

#### Example 1: Project a customer to ABox quads

<<< ../../examples/docs/advanced/24-toquads-customer.ts

#### Example 2: Combine TBox and ABox

<<< ../../examples/docs/advanced/25-toquads-combine-tbox-abox.ts

---

## `jt.fromQuads` {#jt-fromquads}

**Declaration.** Lifts RDF quads back into typed JS objects. Inverse of `toQuads`. Given quads produced by `toQuads`, a reasoning engine, or any RDF source, recovers plain JS objects matching the target schema. Each returned object is validated through `instantiate` to apply defaults, transforms, and type safety. Returns `Array<TMap[K]>`.

**Use this when** you have RDF quads from an external source (a triplestore query result, a reasoner output) and need to recover validated domain objects.

### Examples

#### Example 1: Round-trip a customer through quads

<<< ../../examples/docs/advanced/15-fromquads-roundtrip.ts

---

## `jt.toSchema`

See [`jt.toSchema`](/serialization/toSchema) in the Serialization guide - it reconstructs a JSON Schema from the canonical graph and is useful for verifying round-trip fidelity, but is not specific to the RDF/ontology use case.

---

## Direct serializer access

For advanced use cases without the `JsonTology` facade, serializers are importable from `json-tology/ontology`:

<<< ../../examples/docs/advanced/16-direct-serializer-access.ts

## Custom prefixes and vocabulary plugins

<<< ../../examples/docs/advanced/17-custom-vocabulary-plugin.ts

## Querying the TBox {#querying-the-tbox}

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

### Usage with N3.js {#usage-with-n3js}

<<< ../../examples/docs/advanced/18-n3-parser-integration.ts

## Related

- [Bookstore domain](/bookstore-domain) - schemas used in examples
- [Schemas](/schemas) - schema registration
- [Serialization](/serialization/dump) - `dump` / `dumpJson` for non-RDF serialization
- [Graph concepts](/advanced/graph-concepts) - TBox vs ABox, domain and range
- [RDF round-trip](/advanced/quads) - `toQuads` / `fromQuads` for ABox data

## See also

