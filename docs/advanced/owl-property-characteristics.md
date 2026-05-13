# OWL 2 property characteristics <Badge type="tip" text="Runtime" />

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

All seven keywords are tracked in `OWL_CORE_PREDICATES` in `src/constants/ONTOLOGY_PREDICATES.ts` and exposed as fields on `SchemaGraphSemanticsInterface` so consumers can inspect them on the canonical graph without re-reading the source schema.

## Usage

Declare a characteristic on the property's schema body. The keyword is set at the property-schema level, not the class level.

```ts
import { JsonTology } from 'json-tology';

const KnowsSchema = {
  $id:   'https://example.com/knows',
  type:  'object',
  symmetric: true,       // owl:SymmetricProperty
  transitive: true,      // owl:TransitiveProperty
  properties: {
    subject: { type: 'string', format: 'uri' },
    object:  { type: 'string', format: 'uri' },
  },
} as const;

const ParentOfSchema = {
  $id:      'https://example.com/parentOf',
  type:     'object',
  asymmetric: true,      // owl:AsymmetricProperty — cannot be its own parent
  irreflexive: true,     // owl:IrreflexiveProperty
  properties: {
    parent: { type: 'string', format: 'uri' },
    child:  { type: 'string', format: 'uri' },
  },
} as const;

const HasIdentifierSchema = {
  $id:              'https://example.com/hasIdentifier',
  type:             'object',
  functional:       true,       // owl:FunctionalProperty — at most one value per subject
  inverseFunctional: true,      // owl:InverseFunctionalProperty — uniquely identifies subject
  properties: {
    entity:     { type: 'string', format: 'uri' },
    identifier: { type: 'string' },
  },
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [KnowsSchema, ParentOfSchema, HasIdentifierSchema] as const,
});

console.log(jt.toTbox().jsonLd());
```

The TBox output for `KnowsSchema` includes:

```json
{
  "@id": "https://example.com/knows",
  "@type": ["owl:ObjectProperty", "owl:SymmetricProperty", "owl:TransitiveProperty"]
}
```

## Semantics

Property characteristics are TBox axioms — they describe logical structure and enable reasoning, they do not add runtime validation constraints.

- **`symmetric`**: if `A knows B` then `B knows A`.
- **`transitive`**: if `A knows B` and `B knows C` then `A knows C`.
- **`asymmetric`**: if `A parentOf B` then `B parentOf A` is false.
- **`functional`**: each subject has at most one value for this property.
- **`inverseFunctional`**: each value uniquely identifies its subject.
- **`irreflexive`**: no individual relates to itself via this property.
- **`reflexive`**: every individual relates to itself via this property.

## Constants

The IRI constants are exported from `src/constants/IRI.ts`:

```ts
import {
  OWL,
  RDFS,
} from 'json-tology/schema';

OWL.AsymmetricProperty;       // 'http://www.w3.org/2002/07/owl#AsymmetricProperty'
OWL.FunctionalProperty;       // 'http://www.w3.org/2002/07/owl#FunctionalProperty'
OWL.InverseFunctionalProperty;// 'http://www.w3.org/2002/07/owl#InverseFunctionalProperty'
OWL.IrreflexiveProperty;      // 'http://www.w3.org/2002/07/owl#IrreflexiveProperty'
OWL.ReflexiveProperty;        // 'http://www.w3.org/2002/07/owl#ReflexiveProperty'
OWL.SymmetricProperty;        // 'http://www.w3.org/2002/07/owl#SymmetricProperty'
OWL.TransitiveProperty;       // 'http://www.w3.org/2002/07/owl#TransitiveProperty'
RDFS.subPropertyOf;           // 'http://www.w3.org/2000/01/rdf-schema#subPropertyOf'
```

## Related

- [Ontology and graphs](/advanced/ontology) — `toTbox`, `toShacl`, `ontology`
- [OWL class axioms](/composition/sub-class-of) — `subClassOf`, `disjointWith`, `complementOf`
- [OWL property restrictions](/composition/restrictions) — cardinality, `someValuesFrom`, `allValuesFrom`, `hasValue`

## See also

- [Bookstore domain](/bookstore-domain) — the running example domain
- [Validation modes](/validation-modes) — enforcement layer reference
