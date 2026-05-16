# `Compose.subClassOf` / `Compose.disjointWith` / `Compose.complementOf`

> Validation modes: [Validation modes reference](/validation-modes)

These three methods complete the OWL class-axiom set on `Compose`. They are authored as plain JSON Schema documents - every concept lives behind a method, not behind a custom keyword on the schema literal.

## Declaration

```ts
Compose.subClassOf(parent | parents, body): { $id, allOf: [{ $ref }, ...] }
Compose.disjointWith(other, body):           { $id, disjointWith, ...body }
Compose.complementOf(other, body):           { $id, not: { $ref }, ...body }
```

**`subClassOf`** <Badge type="info" text="Compile-time" /> - self-subclass is a compile-time error (`SelfSubClassType` brand). The body's `$id` cannot match any parent's `$id`.

**`disjointWith`** <Badge type="warning" text="Compile-time + Runtime" /> - compile-time brand (`~jt:disjointWith`) names the disjoint target; runtime enforces the constraint at `validate` / `instantiate`.

**`complementOf`** <Badge type="info" text="Compile-time" /> - adds `~jt:complementOf` brand naming the complement target. Runtime JSON Schema `not` semantics apply.

`body` always carries the new schema's `$id` and any structural keywords you would normally write inline (`type`, `properties`, `required`, `description`, etc.).

## Use this when

- **`subClassOf`** - you want explicit taxonomic narrowing with one OR multiple parents. Emits `rdfs:subClassOf` per parent in the OWL TBox.
- **`disjointWith`** - two classes share no instances (e.g. `Weapon` and `Armor`). Emits `owl:disjointWith`.
- **`complementOf`** - a class is the negation of another (e.g. `NonHumanRace` is everything that is not `HumanRace`). Emits `owl:complementOf`.

## Don't use this when

- You only need property-merging with a single parent - use [`Compose.extend`](/composition/extend), which is structurally equivalent (both produce `allOf + $ref`) but signals "extension" rather than "is-a".
- You want type aliasing without OWL semantics - use [`Compose.equivalent`](/composition/equivalent).
- You want individual-level identity (`owl:sameAs` between two ABox individuals) - use [`JsonTology.prototype.sameAs`](/advanced/sameas). Class axioms operate on the TBox layer.

## Examples

### Example 1: single-parent subclass

`EBook` is a `Book` with three extra fields. The full source lives in the shared bookstore domain:

<<< ../../examples/docs/bookstore/entities/EBook.ts

Output wire shape:

```ts
// {
//   $id: 'urn:bookstore:EBook',
//   allOf: [
//     { $ref: 'urn:bookstore:Book' },
//     { type: 'object', properties: { fileFormat: {...}, downloadUrl: {...}, fileSizeBytes: {...} } }
//   ]
// }
```

### Example 2: subclass + invariant for axioms TypeScript can't express

A `SignedFirstEdition` is a `RareBook` whose sole author signed the copy. The structural OWL contract — "subclass of RareBook, adds `signedBy` and `provenance`" — is expressed by single-parent `subClassOf`. The "exactly one author" axiom is registered as a runtime invariant (`signedFirstEditionIsSoloAuthored`) on the schema, surfaced through the same `ValidationErrors` shape as structural errors. Single-authorship is a predicate over `authors`, not a distinct OWL class identity, so it deliberately stays out of the TBox.

<<< ../../examples/docs/bookstore/entities/SignedFirstEdition.ts

### Example 3: disjoint classes

`PrintBook` is a `Book` that **cannot also be** an `EBook` — a single book copy is either a physical artefact or a digital download, never both at once.

<<< ../../examples/docs/bookstore/entities/PrintBook.ts

In the OWL TBox:

```turtle
urn:bookstore:PrintBook  owl:disjointWith  urn:bookstore:EBook .
```

### Example 4: complement class

`OutOfPrintBook` is the negation of `InPrintBook`, bounded to the `Book` universe via the body's `allOf: [{ $ref: Book }]`.

<<< ../../examples/docs/bookstore/entities/OutOfPrintBook.ts

In the OWL TBox:

```turtle
urn:bookstore:OutOfPrintBook  owl:complementOf  urn:bookstore:InPrintBook .
urn:bookstore:OutOfPrintBook  rdfs:subClassOf   urn:bookstore:Book .
```

JSON Schema runtime: validates as `Book AND NOT InPrintBook` — only `Book`-shaped values that fail the `InPrintBook` constraint pass.

## Comparison

::: code-group

```ts [json-tology]
const EBook = Compose.subClassOf(BookSchema, {
  $id: 'urn:bookstore:EBook',
  type: 'object',
  properties: { fileFormat: { type: 'string', enum: ['epub', 'pdf', 'mobi'] } },
});
```

```ts [Zod]
// Zod has no native subclass concept; structural extension is the closest analog.
const EBook = BookSchema.extend({ fileFormat: z.enum(['epub', 'pdf', 'mobi']) });
// Limitation: no OWL TBox emission, no multi-parent support.
```

```ts [Effect Schema]
import { Schema } from 'effect';
const EBook = Schema.extend(BookSchema, Schema.Struct({ fileFormat: Schema.Literal('epub', 'pdf', 'mobi') }));
// Limitation: no taxonomic vs property-merge distinction.
```

```ts [TypeBox]
import { Type } from '@sinclair/typebox';
const EBook = Type.Composite([
  BookSchema,
  Type.Object({ fileFormat: Type.Union([Type.Literal('epub'), Type.Literal('pdf'), Type.Literal('mobi')]) }),
]);
// Limitation: no semantic distinction between extension and subclassing.
```

```ts [io-ts]
import * as t from 'io-ts';
const EBook = t.intersection([BookCodec, t.type({ fileFormat: t.union([t.literal('epub'), t.literal('pdf'), t.literal('mobi')]) })]);
// Limitation: structural intersection only; no class identity.
```

```ts [Valibot]
import * as v from 'valibot';
const EBook = v.intersect([
  BookSchema,
  v.object({ fileFormat: v.picklist(['epub', 'pdf', 'mobi']) }),
]);
// Limitation: no inheritance model; no OWL output.
```

```py [Pydantic]
class EBook(Book):
    file_format: Literal['epub', 'pdf', 'mobi']
# Pydantic's Python class hierarchy is the natural taxonomic mechanism,
# but it does not emit OWL or JSON Schema axioms by default.
```


```ts [AJV]
// Limitation: feature not directly supported in AJV. See /comparisons for the matrix.
```

```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

## Related / See also

- [`Compose.extend`](/composition/extend) - property-merging extension (single parent, allOf+$ref shape, no explicit "subclass" semantic)
- [`Compose.equivalent`](/composition/equivalent) - `owl:equivalentClass` for structurally identical types
- [`Compose.intersection`](/composition/intersection) - generic `allOf` over multiple schemas
- [OWL TBox output](/advanced/ontology#entities-totbox)
- [Graph-native authoring](/advanced/graph-native-authoring)
