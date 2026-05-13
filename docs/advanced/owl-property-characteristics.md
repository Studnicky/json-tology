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

## Compile-time conflict detection

Three combinations are logically impossible under OWL 2 semantics. Setting them on the same property produces a `PropertyCharacteristicConflictInterface` branded type error at the property definition site, and `SchemaRegistry.register()` throws a `SchemaError` with code `PROPERTY_CHARACTERISTIC_CONFLICT` at runtime.

| Conflict | Reason |
|----------|--------|
| `symmetric` + `asymmetric` | Mutually exclusive by definition — a relation cannot be both directed and undirected |
| `reflexive` + `irreflexive` | Mutually exclusive by definition — an individual cannot both relate and not relate to itself |
| `asymmetric` + `reflexive` | Asymmetric implies irreflexive in OWL 2; explicit `reflexive` directly contradicts that |

### symmetric + asymmetric

```ts
import type { ValidatePropertyCharacteristicsType } from 'json-tology/types';

// @ts-expect-error — 'relates' sets symmetric:true and asymmetric:true
//                     (PropertyCharacteristicConflictInterface)
const _bad: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad';
  readonly 'properties': {
    readonly 'relates': { readonly 'asymmetric': true; readonly 'symmetric': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad',
  'properties': { 'relates': { 'asymmetric': true, 'symmetric': true } },
  'type': 'object'
} as const;
```

### reflexive + irreflexive

```ts
// @ts-expect-error — 'rel' sets reflexive:true and irreflexive:true
//                     (PropertyCharacteristicConflictInterface)
const _bad: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad';
  readonly 'properties': {
    readonly 'rel': { readonly 'irreflexive': true; readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad',
  'properties': { 'rel': { 'irreflexive': true, 'reflexive': true } },
  'type': 'object'
} as const;
```

### asymmetric + reflexive

```ts
// @ts-expect-error — 'edge' sets asymmetric:true and reflexive:true
//                     (PropertyCharacteristicConflictInterface)
const _bad: ValidatePropertyCharacteristicsType<{
  readonly '$id': 'urn:test:Bad';
  readonly 'properties': {
    readonly 'edge': { readonly 'asymmetric': true; readonly 'reflexive': true };
  };
  readonly 'type': 'object';
}> = {
  '$id': 'urn:test:Bad',
  'properties': { 'edge': { 'asymmetric': true, 'reflexive': true } },
  'type': 'object'
} as const;
```

The brand interface shape is:

```ts
interface PropertyCharacteristicConflictInterface<
  TProperty extends string,
  TConflicts extends readonly string[]
> {
  readonly kind:      'PropertyCharacteristicConflict';
  readonly property:  TProperty;
  readonly conflicts: TConflicts;
}
```

IDE hover on the failing assignment surfaces `kind`, `property`, and `conflicts` directly, making the offending property and characteristics visible without reading a stack trace.

## Examples

```ts
// Good — symmetric + reflexive (SimilarBook pattern)
const SimilarBookSchema = {
  $id: 'urn:bookstore:SimilarBook',
  type: 'object',
  properties: {
    a: { $ref: 'urn:bookstore:Book' },
    b: { $ref: 'urn:bookstore:Book', symmetric: true, reflexive: true }
  },
  required: ['a', 'b']
} as const;

// Good — asymmetric alone (Sequel pattern)
const SequelSchema = {
  $id: 'urn:bookstore:Sequel',
  type: 'object',
  properties: {
    predecessor: { $ref: 'urn:bookstore:Book', asymmetric: true }
  },
  required: ['predecessor']
} as const;

// Good — transitive + irreflexive (Order.placedAt pattern)
const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    placedAt: { $ref: 'urn:bookstore:Iso8601', transitive: true, irreflexive: true }
  },
  required: ['placedAt']
} as const;
```

## Bad examples — what NOT to do

```ts
// Bad — symmetric and asymmetric are mutually exclusive
const Bad1 = {
  $id: 'urn:test:Bad1',
  type: 'object',
  properties: {
    relates: { symmetric: true, asymmetric: true }
  //          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  //          PropertyCharacteristicConflictInterface<'relates', ['symmetric', 'asymmetric']>
  }
} as const;

// Bad — reflexive and irreflexive are mutually exclusive
const Bad2 = {
  $id: 'urn:test:Bad2',
  type: 'object',
  properties: {
    rel: { reflexive: true, irreflexive: true }
    //    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    //    PropertyCharacteristicConflictInterface<'rel', ['reflexive', 'irreflexive']>
  }
} as const;

// Bad — asymmetric implies irreflexive; explicit reflexive contradicts it
const Bad3 = {
  $id: 'urn:test:Bad3',
  type: 'object',
  properties: {
    edge: { asymmetric: true, reflexive: true }
    //     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    //     PropertyCharacteristicConflictInterface<'edge', ['asymmetric', 'reflexive']>
  }
} as const;
```

## Comparison

**OWL DL reasoners** detect these contradictions at query time — a reasoner run over a TBox that declares both `owl:SymmetricProperty` and `owl:AsymmetricProperty` on the same property will identify it as an inconsistency, but only after the ontology is loaded and reasoned over. json-tology surfaces the same contradiction at schema-authoring time, before any data touches the system.

**Zod** has no concept of OWL property characteristics and provides no equivalent enforcement layer — authors must discover logical impossibilities through runtime behavior or domain review rather than compiler output.

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
