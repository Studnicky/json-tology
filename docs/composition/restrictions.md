# OWL class restrictions <Badge type="info" text="Compile-time" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** OWL property restrictions narrow the inferred TypeScript type of the restricted property at compile time. The TBox output carries `owl:Restriction` blank nodes for reasoners.

<!-- inline-ts-ok: pseudocode signature group for the restriction builders; not runnable expressions. -->
```ts
Compose.someValuesFrom(propIri, rangeClassIri): RestrictionRefType
Compose.allValuesFrom(propIri, rangeClassIri): RestrictionRefType
Compose.hasValue(propIri, value): RestrictionRefType
Compose.cardinality(propIri, n): RestrictionRefType
Compose.minimumCardinality(propIri, n): RestrictionRefType
Compose.maximumCardinality(propIri, n): RestrictionRefType

Compose.subClassOf(restriction, body): typeof body
```

**Use this when** you want to express OWL property-restriction class axioms - anonymous classes that constrain how a property is used. Each restriction becomes an `owl:Restriction` blank node in the TBox, referenced from the body class via `rdfs:subClassOf`. Restrictions compose: chaining `Compose.subClassOf` accumulates `jt:restrictions` on the body schema.

<RunnableExample src="examples/docs/composition/08-restrictions" />

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
| `someValuesFrom(prop, classIri)` | `owl:someValuesFrom` | non-empty tuple | At least one value of `prop` is an instance of `classIri` |
| `allValuesFrom(prop, classIri)` | `owl:allValuesFrom` | readonly array of element type | Every value of `prop` is an instance of `classIri` |
| `hasValue(prop, value)` | `owl:hasValue` | property type is the literal `value` | `prop` carries the literal `value` (string/number/boolean) |
| `cardinality(prop, n)` | `owl:cardinality` | length-`n` readonly tuple (cap 16) | Exactly `n` values |
| `minCardinality(prop, n)` | `owl:minCardinality` | `n` mandatory prefix elements | At least `n` values |
| `maxCardinality(prop, n)` | `owl:maxCardinality` | union of tuples length `0..n` | At most `n` values |

The compile-time narrowing applies to the property named in the restriction. `cardinality(prop, N)` produces an `N`-length tuple capped at 16; `minCardinality(prop, N)` produces a tuple with `N` mandatory prefix elements; `maxCardinality(prop, N)` produces a union of tuples of length `0..N`.

## Chaining

`Compose.subClassOf` is composable. Each call appends to the body's `jt:restrictions`:

<RunnableExample src="examples/docs/composition/37-restrictions-chained-cardinality" />

The TBox carries two `owl:Restriction` blank nodes attached via `rdfs:subClassOf`.

**Don't use this when**

* Use [`Compose.equivalent`](/composition/equivalent) to declare two classes have identical extension. That maps to `owl:equivalentClass`, not a property restriction.
* Use [`Compose.extend`](/composition/extend) for structural inheritance (allOf + $ref). Restrictions are *property-level* axioms - they say "values of this property satisfy X", not "this class also has these properties".
* Don't use `cardinality`/`minCardinality`/`maxCardinality` to drive structural validation. JSON Schema's `required`, `minItems`, and `maxItems` already cover those at instance time. Restrictions are purely TBox semantic content for reasoners.

## Examples

### Example 1: Exact cardinality: PersonWithExactlyTwoParents

<RunnableExample src="examples/docs/composition/09-cardinality-two-parents" />

### Example 2: someValuesFrom: book authored by at least one author

<RunnableExample src="examples/docs/composition/10-some-values-from" />

### Example 3: Chaining restrictions: at least one author, all authors are Author instances

<RunnableExample src="examples/docs/composition/11-chained-restrictions" />

### Example 4: hasValue: mark in-print books

<RunnableExample src="examples/docs/composition/12-has-value-literal" />

## Bad examples: what NOT to do

### Anti-pattern 1: Using cardinality restrictions to drive instance validation

<RunnableExample src="examples/docs/composition/13-antipattern-cardinality-validation" />

### Anti-pattern 2: Using Compose.equivalent to express a property restriction

<RunnableExample src="examples/docs/composition/14-antipattern-equivalent" />

### Anti-pattern 3: Confusing minCardinality and JSON Schema minItems

<RunnableExample src="examples/docs/composition/15-antipattern-mincardinality" />

## Comparison

::: code-group

```ts [json-tology]
const InPrintBook = Compose.subClassOf(
  Compose.hasValue('https://bookstore.example/inStock', true),
  { $id: 'https://bookstore.example/InPrintBook', type: 'object' } as const
);
// Emits owl:Restriction blank node in TBox; TypeScript narrows inStock to literal true.
```

```ts [Zod]
// Zod has no OWL restriction concept. Compile-time narrowing is expressed
// directly via literal types:
const InPrintBook = z.object({ inStock: z.literal(true) });
// Limitation: no owl:Restriction emitted; no TBox; narrowing is structural,
// not ontological.
```

```ts [Valibot]
import * as v from 'valibot';
const InPrintBook = v.object({ inStock: v.literal(true) });
// Limitation: same as Zod — structural narrowing only, no OWL output.
```

```ts [io-ts]
import * as t from 'io-ts';
const InPrintBook = t.type({ inStock: t.literal(true) });
// Limitation: codec-based narrowing; no ontological semantics; no TBox output.
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
const InPrintBook = Type.Object({ inStock: Type.Literal(true) });
// Limitation: JSON Schema literal constraint; no owl:Restriction; no TBox.
```

```ts [AJV]
const inPrintBookSchema = {
  $id: 'https://bookstore.example/InPrintBook',
  type: 'object',
  properties: { inStock: { const: true } },
};
// Limitation: JSON Schema const; validates instances but emits no OWL.
```

```py [Pydantic]
from typing import Literal
class InPrintBook(BaseModel):
    in_stock: Literal[True]
# Limitation: Python Literal type; no owl:Restriction; no RDF/OWL output.
```


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

## Related

* [`Compose.equivalent`](/composition/equivalent) - `owl:equivalentClass` for class identity
* [`Compose.extend`](/composition/extend) - `rdfs:subClassOf` via allOf + $ref
* [Graph concepts (TBox / ABox)](/advanced/graph-concepts)
* [`sameAs`](/advanced/sameas) - the ABox counterpart to class restrictions

## See also

* [Bookstore domain](/bookstore-domain) - schema definitions used in examples
* [OWL TBox output](/advanced/ontology#jt-totbox) - how restrictions appear in the emitted TBox
