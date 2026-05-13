# OWL class restrictions <Badge type="info" text="Compile-time" />

> Validation modes: [Validation modes reference](/validation-modes)

OWL property restrictions narrow the inferred TypeScript type of the restricted property at compile time. The TBox output carries `owl:Restriction` blank nodes for reasoners.

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

| Method | Predicate | TypeScript narrowing | OWL semantics |
|---|---|---|---|
| `someValuesFrom(prop, classIRI)` | `owl:someValuesFrom` | non-empty tuple | At least one value of `prop` is an instance of `classIRI` |
| `allValuesFrom(prop, classIRI)` | `owl:allValuesFrom` | readonly array of element type | Every value of `prop` is an instance of `classIRI` |
| `hasValue(prop, value)` | `owl:hasValue` | property type is the literal `value` | `prop` carries the literal `value` (string/number/boolean) |
| `cardinality(prop, n)` | `owl:cardinality` | length-`n` readonly tuple (cap 16) | Exactly `n` values |
| `minCardinality(prop, n)` | `owl:minCardinality` | `n` mandatory prefix elements | At least `n` values |
| `maxCardinality(prop, n)` | `owl:maxCardinality` | union of tuples length `0..n` | At most `n` values |

The compile-time narrowing applies to the property named in the restriction. `cardinality(prop, N)` produces an `N`-length tuple capped at 16; `minCardinality(prop, N)` produces a tuple with `N` mandatory prefix elements; `maxCardinality(prop, N)` produces a union of tuples of length `0..N`.

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
