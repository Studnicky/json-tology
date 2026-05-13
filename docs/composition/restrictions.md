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

You want to express OWL property-restriction class axioms - anonymous classes that constrain how a property is used. Each restriction becomes an `owl:Restriction` blank node in the TBox, referenced from the body class via `rdfs:subClassOf`. Restrictions compose: chaining `Compose.subClassOf` accumulates `jt:restrictions` on the body schema.

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
* Use [`Compose.extend`](/composition/extend) for structural inheritance (allOf + $ref). Restrictions are *property-level* axioms - they say "values of this property satisfy X", not "this class also has these properties".
* Don't use `cardinality`/`minCardinality`/`maxCardinality` to drive structural validation. JSON Schema's `required`, `minItems`, and `maxItems` already cover those at instance time. Restrictions are purely TBox semantic content for reasoners.

## Examples

### Example 1: Exact cardinality: PersonWithExactlyTwoParents

```ts
import { Compose, JsonTology } from 'json-tology';

const PARENT = 'https://bookstore.example/parent';

const PersonWithExactlyTwoParents = Compose.subClassOf(
  Compose.cardinality(PARENT, 2),
  {
    $id: 'https://bookstore.example/PersonWithExactlyTwoParents',
    type: 'object',
  } as const
);

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [PersonWithExactlyTwoParents] as const,
});

console.log(jt.toTbox().jsonLd());
// {
//   "@id": "https://bookstore.example/PersonWithExactlyTwoParents",
//   "@type": "owl:Class",
//   "rdfs:subClassOf": [{
//     "@type": "owl:Restriction",
//     "owl:onProperty": { "@id": "https://bookstore.example/parent" },
//     "owl:cardinality": 2
//   }]
// }
```

### Example 2: someValuesFrom: book authored by at least one author

```ts
import { Compose, JsonTology } from 'json-tology';
import { BookSchema } from './bookstore/index.js';

const AUTHORED_BY = 'https://bookstore.example/authoredBy';
const AUTHOR_IRI  = 'https://bookstore.example/Author';

const AuthoredBookSchema = Compose.subClassOf(
  Compose.someValuesFrom(AUTHORED_BY, AUTHOR_IRI),
  {
    $id: 'https://bookstore.example/AuthoredBook',
    type: 'object',
  } as const
);
// TypeScript narrows the authored-by property to a non-empty tuple at compile time
```

### Example 3: Chaining restrictions: at least one author, all authors are Author instances

```ts
import { Compose } from 'json-tology';

const AUTHORED_BY = 'https://bookstore.example/authoredBy';
const AUTHOR_IRI  = 'https://bookstore.example/Author';

const VerifiedAuthoredBook = Compose.subClassOf(
  Compose.minCardinality(AUTHORED_BY, 1),
  Compose.subClassOf(
    Compose.allValuesFrom(AUTHORED_BY, AUTHOR_IRI),
    { $id: 'https://bookstore.example/VerifiedAuthoredBook', type: 'object' } as const
  )
);
// TBox carries two owl:Restriction blank nodes on rdfs:subClassOf
```

### Example 4: hasValue: mark in-print books

```ts
import { Compose } from 'json-tology';

const IN_STOCK = 'https://bookstore.example/inStock';

const InPrintBook = Compose.subClassOf(
  Compose.hasValue(IN_STOCK, true),
  { $id: 'https://bookstore.example/InPrintBook', type: 'object' } as const
);
// TypeScript narrows the inStock property type to the literal `true`
```

## Bad examples: what NOT to do

### Anti-pattern 1: Using cardinality restrictions to drive instance validation

```ts
import { Compose, JsonTology } from 'json-tology';

// ✗ Don't do this — owl:cardinality is a TBox semantic axiom for reasoners,
// NOT a runtime validation constraint on instance data
const StrictBook = Compose.subClassOf(
  Compose.cardinality('https://bookstore.example/authors', 1),
  { $id: 'https://bookstore.example/StrictBook', type: 'object' } as const
);
const jt = JsonTology.create({ baseIRI: 'https://bookstore.example', schemas: [StrictBook] as const });
jt.validate('https://bookstore.example/StrictBook', { authors: ['A', 'B'] });
// Does NOT fail — restrictions are TBox-only, not checked at validate/instantiate time

// ✓ Do this — use JSON Schema keywords for instance validation
const StrictBook2 = {
  $id: 'https://bookstore.example/StrictBook2',
  type: 'object',
  properties: { authors: { type: 'array', minItems: 1, maxItems: 1 } },
} as const;
```

### Anti-pattern 2: Using Compose.equivalent to express a property restriction

```ts
// ✗ Don't do this — equivalent expresses class identity, not property constraints
import { Compose } from 'json-tology';
import { BookSchema } from './bookstore/index.js';

const InPrintBook = Compose.equivalent(BookSchema, {
  $id: 'https://bookstore.example/InPrintBook',
  // can't express owl:hasValue here — equivalent only supports $id / description / title
});

// ✓ Do this — use Compose.subClassOf + Compose.hasValue
const InPrintBook2 = Compose.subClassOf(
  Compose.hasValue('https://bookstore.example/inStock', true),
  { $id: 'https://bookstore.example/InPrintBook2', type: 'object' } as const
);
```

### Anti-pattern 3: Confusing minCardinality and JSON Schema minItems

```ts
// ✗ Don't do this — minCardinality on a multi-valued property is an OWL axiom;
// it does NOT add a minItems constraint on the JSON Schema array
const AuthoredBook = Compose.subClassOf(
  Compose.minCardinality('https://bookstore.example/authors', 2),
  { $id: 'https://bookstore.example/AuthoredBook', type: 'object' } as const
);
// jt.validate('AuthoredBook', { authors: [] }) → passes (no minItems in JSON Schema)

// ✓ Do this — use minItems in the JSON Schema definition for runtime enforcement
const AuthoredBook2 = {
  $id: 'https://bookstore.example/AuthoredBook2',
  type: 'object',
  properties: { authors: { type: 'array', minItems: 2 } },
} as const;
```

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

:::

## Related

* [`Compose.equivalent`](/composition/equivalent) - `owl:equivalentClass` for class identity
* [`Compose.extend`](/composition/extend) - `rdfs:subClassOf` via allOf + $ref
* [Graph concepts (TBox / ABox)](/advanced/graph-concepts)
* [`sameAs`](/advanced/sameas) - the ABox counterpart to class restrictions

## See also

* [Bookstore domain](/bookstore-domain) - schema definitions used in examples
* [OWL TBox output](/advanced/ontology#jt-totbox) - how restrictions appear in the emitted TBox
