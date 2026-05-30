# OWL 2 property characteristics <Badge type="tip" text="Compile-time + Runtime" />

OWL 2 defines seven property characteristics that describe logical properties of object properties in a TBox. json-tology supports all seven. Setting a characteristic keyword to `true` on a property schema emits the corresponding `rdf:type owl:*Property` quad through the canonical graph.

## Supported keywords

| Keyword | OWL 2 characteristic | Emitted quad |
|---------|---------------------|--------------|
| `symmetric` | `owl:SymmetricProperty` | `<prop> rdf:type owl:SymmetricProperty` |
| `transitive` | `owl:TransitiveProperty` | `<prop> rdf:type owl:TransitiveProperty` |
| `asymmetric` | `owl:AsymmetricProperty` | `<prop> rdf:type owl:AsymmetricProperty` |
| `functional` | `owl:FunctionalProperty` | `<prop> rdf:type owl:FunctionalProperty` |
| `inverseFunctional` | `owl:InverseFunctionalProperty` | `<prop> rdf:type owl:InverseFunctionalProperty` |
| `irreflexive` | `owl:IrreflexiveProperty` | `<prop> rdf:type owl:IrreflexiveProperty` |
| `reflexive` | `owl:ReflexiveProperty` | `<prop> rdf:type owl:ReflexiveProperty` |

All seven keywords are registered in `KNOWN_SCHEMA_KEYWORDS` (`src/constants/SCHEMA_KEYWORDS.ts`); the emit logic that converts them to `rdf:type owl:*Property` quads lives in `src/modules/graph/SchemaGraphRelations.ts`. They are also exposed as fields on `SchemaGraphSemanticsInterface` so consumers can inspect them on the canonical graph without re-reading the source schema.

## Usage

Declare a characteristic on the property's schema body. The keyword is set at the property-schema level, not the class level.

<RunnableExample src="examples/docs/advanced/26-owl-property-characteristics-tbox" />

The TBox output for `KnowsSchema` includes:

```json
{
  "@id": "https://example.com/knows",
  "@type": ["owl:ObjectProperty", "owl:SymmetricProperty", "owl:TransitiveProperty"]
}
```

## Semantics

Property characteristics are TBox axioms - they describe logical structure and enable reasoning, they do not add runtime validation constraints.

- **`symmetric`**: if `A knows B` then `B knows A`.
- **`transitive`**: if `A knows B` and `B knows C` then `A knows C`.
- **`asymmetric`**: if `A parentOf B` then `B parentOf A` is false.
- **`functional`**: each subject has at most one value for this property.
- **`inverseFunctional`**: each value uniquely identifies its subject.
- **`irreflexive`**: no individual relates to itself via this property.
- **`reflexive`**: every individual relates to itself via this property.

## Compile-time conflict detection

Three combinations are logically impossible under OWL 2 semantics. Setting them on the same property produces a `PropertyCharacteristicConflictInterface` branded type error at the property definition site, and `SchemaRegistry.set()` throws a `SchemaError` with code `PROPERTY_CHARACTERISTIC_CONFLICT` at runtime.

| Conflict | Reason |
|----------|--------|
| `symmetric` + `asymmetric` | Mutually exclusive by definition - a relation cannot be both directed and undirected |
| `reflexive` + `irreflexive` | Mutually exclusive by definition - an individual cannot both relate and not relate to itself |
| `asymmetric` + `reflexive` | Asymmetric implies irreflexive in OWL 2; explicit `reflexive` directly contradicts that |

### symmetric + asymmetric

<RunnableExample src="examples/docs/advanced/27-owl-conflict-symmetric-asymmetric" />

### reflexive + irreflexive

<RunnableExample src="examples/docs/advanced/28-owl-conflict-reflexive-irreflexive" />

### asymmetric + reflexive

<RunnableExample src="examples/docs/advanced/29-owl-conflict-asymmetric-reflexive" />

The brand interface shape is:

<RunnableExample src="examples/docs/advanced/30-owl-conflict-brand-shape" />

IDE hover on the failing assignment surfaces `kind`, `property`, and `conflicts` directly, making the offending property and characteristics visible without reading a stack trace.

## Examples

<RunnableExample src="examples/docs/advanced/31-owl-good-patterns" />

## Bad examples: what NOT to do

<RunnableExample src="examples/docs/advanced/32-owl-bad-patterns" />

## Comparison

**OWL DL reasoners** detect these contradictions at query time - a reasoner run over a TBox that declares both `owl:SymmetricProperty` and `owl:AsymmetricProperty` on the same property will identify it as an inconsistency, but only after the ontology is loaded and reasoned over. json-tology surfaces the same contradiction at schema-authoring time, before any data touches the system.

**Zod** has no concept of OWL property characteristics and provides no equivalent enforcement layer - authors must discover logical impossibilities through runtime behavior or domain review rather than compiler output.

## Constants

The IRI constants are exported from `src/constants/IRI.ts`:

<RunnableExample src="examples/docs/advanced/33-owl-iri-constants" />

## Related

- [Ontology and graphs](/advanced/ontology) - `toTbox`, `toShacl`, `ontology`
- [OWL class axioms](/composition/sub-class-of) - `subClassOf`, `disjointWith`, `complementOf`
- [OWL property restrictions](/composition/restrictions) - cardinality, `someValuesFrom`, `allValuesFrom`, `hasValue`

## See also

- [Bookstore domain](/bookstore-domain) - the running example domain
- [Validation modes](/validation-modes) - enforcement layer reference
