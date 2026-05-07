# OWL class restrictions

## Declaration

```ts
Compose.someValuesFrom(propIRI, rangeClassIRI): RestrictionRefType
Compose.allValuesFrom(propIRI, rangeClassIRI): RestrictionRefType
Compose.hasValue(propIRI, value): RestrictionRefType
Compose.cardinality(propIRI, n): RestrictionRefType
Compose.minCardinality(propIRI, n): RestrictionRefType
Compose.maxCardinality(propIRI, n): RestrictionRefType

Compose.subClassOf(restriction, body): typeof body
```

## Use this when

You want to express OWL property-restriction class axioms — anonymous classes that constrain how a property is used. Each restriction becomes an `owl:Restriction` blank node in the TBox, referenced from the body class via `rdfs:subClassOf`. Restrictions compose: chaining `Compose.subClassOf` accumulates `jt:restrictions` on the body schema.

```ts
import { Compose, JsonTology } from 'json-tology';

const PARENT = 'https://example.com/parent';

const PersonWithExactlyTwoParents = Compose.subClassOf(
  Compose.cardinality(PARENT, 2),
  {
    $id: 'urn:example:PersonWithExactlyTwoParents',
    type: 'object',
  } as const
);

const jt = JsonTology.create({
  baseIRI: 'urn:example',
  schemas: [PersonWithExactlyTwoParents] as const,
});

console.log(jt.toTbox().jsonLd());
```

The TBox emits:

```json
{
  "@id": "urn:example:PersonWithExactlyTwoParents",
  "@type": "owl:Class",
  "rdfs:subClassOf": [
    {
      "@type": "owl:Restriction",
      "owl:onProperty": { "@id": "https://example.com/parent" },
      "owl:cardinality": 2
    }
  ]
}
```

## The six restriction methods

| Method | Predicate | Object form | OWL semantics |
|---|---|---|---|
| `someValuesFrom(prop, classIRI)` | `owl:someValuesFrom` | IRI | At least one value of `prop` is an instance of `classIRI` |
| `allValuesFrom(prop, classIRI)` | `owl:allValuesFrom` | IRI | Every value of `prop` is an instance of `classIRI` |
| `hasValue(prop, value)` | `owl:hasValue` | typed literal | `prop` carries the literal `value` (string/number/boolean) |
| `cardinality(prop, n)` | `owl:cardinality` | xsd:nonNegativeInteger | Exactly `n` values |
| `minCardinality(prop, n)` | `owl:minCardinality` | xsd:nonNegativeInteger | At least `n` values |
| `maxCardinality(prop, n)` | `owl:maxCardinality` | xsd:nonNegativeInteger | At most `n` values |

## Chaining

`Compose.subClassOf` is composable. Each call appends to the body's `jt:restrictions`:

```ts
const Adult = Compose.subClassOf(
  Compose.minCardinality(PARENT, 1),
  Compose.subClassOf(
    Compose.maxCardinality(PARENT, 2),
    { $id: 'urn:example:Adult', type: 'object' } as const
  )
);
```

The TBox carries two `owl:Restriction` blank nodes attached via `rdfs:subClassOf`.

## Don't use this when

* Use [`Compose.equivalent`](/composition/equivalent) to declare two classes have identical extension. That maps to `owl:equivalentClass`, not a property restriction.
* Use [`Compose.extend`](/composition/extend) for structural inheritance (allOf + $ref). Restrictions are *property-level* axioms — they say "values of this property satisfy X", not "this class also has these properties".
* Don't use `cardinality`/`minCardinality`/`maxCardinality` to drive structural validation. JSON Schema's `required`, `minItems`, and `maxItems` already cover those at instance time. Restrictions are purely TBox semantic content for reasoners.

## Related

* [`Compose.equivalent`](/composition/equivalent) — `owl:equivalentClass` for class identity
* [`Compose.extend`](/composition/extend) — `rdfs:subClassOf` via allOf + $ref
* [Graph concepts (TBox / ABox)](/advanced/graph-concepts)
* [`sameAs`](/advanced/sameas) — the ABox counterpart to class restrictions
