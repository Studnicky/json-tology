# OWL 2 TBox import (`fromTbox`) <Badge type="tip" text="v0.10.0+" />

`fromTbox` is the inverse of `toTbox`. It reads an OWL 2 TBox (as JSON-LD, a quad array, or an N-Quads string) and reconstructs JSON Schema objects for every declared class, along with invariants, property characteristics, `owl:sameAs` pairs, and named individuals.

The round-trip contract is:

```
fromTbox ∘ toTbox ≈ identity   (on the supported OWL 2 axiom set)
```

"Approximately identity" because the OWL TBox encodes a subset of JSON Schema semantics. Primitive type facets (`minLength`, `minimum`, `format`, etc.) are not OWL class axioms and are not carried back through a generic OWL round-trip. The contract holds for all axioms listed in the **Supported axioms** table below.

## API

### Static helper — no registry state

<!-- inline-ts-ok: API signature pseudocode — optional parameters use ?: syntax which is not runnable standalone -->
```ts
import { JsonTology } from 'json-tology';

const result: OwlImportResult = JsonTology.fromTbox(
  jsonLdStringOrQuads,   // string | object | QuadInterface[]
  { baseIRI?: string; prefixes?: Record<string, string> }
);
```

The static helper is stateless — it constructs a transient `OwlImporter` and discards it. Use it when you only need the reconstructed schemas as plain objects.

### Instance method — registers into the live registry

<!-- inline-ts-ok: API signature pseudocode — optional parameters use ?: syntax which is not runnable standalone -->
```ts
const jt = JsonTology.create({ baseIRI: 'https://example.org' });
const result: OwlImportResult = jt.fromTbox(
  jsonLdStringOrQuads,
  { register?: boolean }  // default: true
);
```

When `register: true` (the default), all produced schemas are passed to `registry.set()`, invariants are registered, `sameAs` pairs are applied, and property characteristics are recorded. This makes the imported vocabulary immediately available for `validate()` / `instantiate()` / `materialize()` calls.

### Return type — `OwlImportResult`

| Field | Type | Description |
|-------|------|-------------|
| `schemas` | `JsonSchemaDocumentObjectType[]` | One schema per declared class IRI |
| `invariants` | `{ invariant, schemaId }[]` | Structural invariants from OWL axioms |
| `characteristics` | `{ characteristic, propertyIri }[]` | OWL property characteristics |
| `sameAs` | `[string, string][]` | `owl:sameAs` identity pairs |
| `individuals` | `{ iri, types, properties }[]` | Named individuals (ABox) |
| `unsupported` | `{ axiomIri, subjectIri }[]` | Axioms no dispatcher handled |

## Supported axioms

| OWL 2 axiom | Serialised predicate IRI | JSON Schema mapping |
|-------------|--------------------------|---------------------|
| Class declaration | `rdf:type owl:Class` | `{ $id: classIri, type: 'object' }` stub |
| `rdfs:subClassOf` | `rdfs:subClassOf` | `allOf: [{ $ref: parentIri }]` |
| `owl:equivalentClass` | `owl:equivalentClass` | `$ref: equivalentIri` |
| `owl:disjointWith` | `owl:disjointWith` | `disjointWith: otherIri` (symmetric) |
| `owl:complementOf` | `owl:complementOf` | `not: { $ref: complementIri }` |
| `owl:disjointUnionOf` | `owl:disjointUnionOf` | `oneOf` on member IRIs |
| `owl:ObjectProperty` with domain+range | `rdfs:domain` / `rdfs:range` | `properties[name]: { $ref: rangeIri }` |
| `owl:DatatypeProperty` with xsd:string range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'string' }` |
| `owl:DatatypeProperty` with xsd:boolean range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'boolean' }` |
| `owl:DatatypeProperty` with xsd:integer / xsd:int range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'integer' }` |
| `owl:DatatypeProperty` with xsd:decimal / xsd:double range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'number' }` |
| `owl:oneOf` datatype enumeration | `owl:oneOf` / `rdf:rest` / `rdf:first` | `enum: [...]` |
| Property characteristics | `rdf:type owl:FunctionalProperty` etc. | Recorded in `characteristics` |
| `owl:NamedIndividual` | `rdf:type owl:NamedIndividual` | Recorded in `individuals` |
| `owl:sameAs` | `owl:sameAs` | Recorded in `sameAs` |
| `rdfs:subPropertyOf` | `rdfs:subPropertyOf` | Recorded in `characteristics` |

## Example

<<< ../../examples/docs/advanced/90-owl-import-roundtrip.ts

## Limitations

The following OWL 2 constructs are not yet mapped to JSON Schema constraints:

| OWL 2 construct | Axiom IRI | Status |
|-----------------|-----------|--------|
| Qualified cardinality (`owl:minQualifiedCardinality`, `owl:maxQualifiedCardinality`) | `owl:onClass` | Not mapped to `minItems` / `maxItems` |
| Anonymous restriction nodes (`owl:Restriction` + `owl:someValuesFrom` / `owl:allValuesFrom`) outside the json-tology serialiser output | `owl:Restriction` | Reconstructed as `jt:restrictions` from json-tology TBox; not generalised for arbitrary OWL serialisations |
| `owl:intersectionOf` on class expressions | `owl:intersectionOf` | Partially handled via `allOf`; complex nested class expressions are logged as `unsupported` |
| `owl:unionOf` on class expressions | `owl:unionOf` | Partially handled via `oneOf`; complex anonymous class union nodes are logged as `unsupported` |
| `rdfs:comment` / `rdfs:label` literal annotations | `rdfs:comment`, `rdfs:label` | Not carried into `title` or `description` (annotation triples are consumed but not mapped) |
| Datatype facets (XSD `owl:withRestrictions`) | `owl:withRestrictions` | Not mapped to `minLength` / `minimum` / `pattern` |
| `owl:hasValue` restrictions | `owl:hasValue` | Not implemented |
| `owl:hasSelf` restrictions | `owl:hasSelf` | Not implemented |

If the input contains any of the above, the affected axiom IRI appears in `result.unsupported`. Round-tripping a TBox that was exported by json-tology's own `toTbox()` will produce zero unsupported entries because `toTbox()` only emits axioms in the supported set.

## Round-trip fidelity

Run `fromTbox(toTbox(schemas).jsonLd())` against the canonical bookstore registry to confirm the supported axiom set round-trips cleanly:

<<< ../../examples/docs/advanced/90-owl-import-roundtrip.ts

## Related

- [`jt.toTbox()`](/advanced/ontology#jt-totbox) — OWL TBox emission (the inverse operation)
- [`jt.toShacl()`](/advanced/ontology#jt-toshacl) — SHACL shapes emission
- [RDF round-trip (toQuads / fromQuads)](/advanced/quads) — ABox data round-trip
- `OwlImporter` (`src/modules/ontology/OwlImporter.ts`) — low-level class if you need to reuse a single importer across multiple inputs
