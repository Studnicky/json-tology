---
title: Bookstore OWL taxonomy
---

# Bookstore OWL taxonomy

This page extends the bookstore domain with OWL-style class taxonomy - subClassOf, disjointWith, and registration patterns for the book hierarchy. Prerequisite: [Bookstore domain](/bookstore-domain) and [Graph concepts](/advanced/graph-concepts).

## Book taxonomy and OWL axioms

Beyond the structural entities, the bookstore registry carries seven additional schemas plus one ABox identity assertion that together exercise every `Compose` class-axiom and OWL restriction the library supports. These are the declarations that drive the live `BookstoreGraph` visualization shown on [Your Types Are a Graph](/your-types-are-a-graph) and the home page.

| Schema | Surface used | Edge in graph |
|---|---|---|
| `EBookSchema`         | `Compose.subClassOf(Book)`                                                                  | `subClassOf` → Book |
| `PrintBookSchema`     | `Compose.subClassOf(Book)` + `Compose.disjointWith(EBook)`                                   | `subClassOf` → Book, `disjointWith` ↔ EBook |
| `RareBookSchema`      | `Compose.subClassOf(PrintBook)` + `Compose.someValuesFrom` + `Compose.maxCardinality`        | `subClassOf` → PrintBook, two `restriction` edges |
| `SoloAuthoredBookSchema` | `Compose.subClassOf(Book)` + `Compose.cardinality`                                        | `subClassOf` → Book, `restriction` |
| `AnthologyBookSchema` | `Compose.subClassOf(Book)` + `Compose.minCardinality` + `Compose.allValuesFrom`              | `subClassOf` → Book, two `restriction` edges |
| `InPrintBookSchema`   | `Compose.subClassOf(Book)` + `Compose.hasValue`                                              | `subClassOf` → Book, `restriction` |
| `OutOfPrintBookSchema`| `Compose.complementOf(InPrintBook)` with body `allOf` bounding to Book                       | `subClassOf` → Book, `complementOf` → InPrintBook |
| `bookstoreEntities.sameAs(a, b)` | `JsonTology.prototype.sameAs` (ABox)                                              | `sameAs` |

Each `entities/*.ts` file is the single source of truth for one schema.

### `entities/EBook.ts`: `subClassOf`

**In plain English:** an `EBook` is a `Book` with three extra fields (`fileFormat`, `downloadUrl`, `fileSizeBytes`). Validation against `EBookSchema` accepts only values that already validate against `BookSchema` and additionally carry the new fields. Tooling that reads the OWL output (RDF stores, reasoners) sees `EBook` as a kind of `Book`.

**Use this when:**
- You want to derive a new type that adds fields to an existing one.
- You want downstream RDF / OWL consumers to see the parent-child relationship.

**Don't use this when:**
- You want to remove fields - use [`Compose.omit`](/composition/pick-omit).
- You want every field to become optional - use [`Compose.partial`](/composition/partial-required).
- You only want a structural alias (no parent-child semantic) - use [`Compose.equivalent`](/composition/equivalent).

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './Book.js';

export const EBookSchema = Compose.subClassOf(BookSchema, {
  $id: 'urn:bookstore:EBook',
  type: 'object',
  properties: {
    fileFormat:    { type: 'string', enum: ['epub', 'pdf', 'mobi'] },
    downloadUrl:   { type: 'string', format: 'uri' },
    fileSizeBytes: { type: 'integer', minimum: 0 },
  },
  required: ['fileFormat', 'downloadUrl'],
} as const);
// Wire: { $id, allOf: [{ $ref: 'urn:bookstore:Book' }, body] }
// TBox: urn:bookstore:EBook  rdfs:subClassOf  urn:bookstore:Book
```

→ See: [`Compose.subClassOf` reference](/composition/sub-class-of) · [`Compose.extend`](/composition/extend) (property-merge alternative) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `entities/PrintBook.ts`: `subClassOf` + `disjointWith`

**In plain English:** a `PrintBook` is a physical-format `Book` with binding, page count, and weight. The `disjointWith` declaration asserts that no single value can be both a `PrintBook` and an `EBook` at the same time - they are mutually exclusive formats. `JsonTology.validate(PrintBookSchema, value)` enforces the constraint at runtime: after a value passes `PrintBook`'s structural check, the registry runs `EBookSchema` against it; if both succeed it surfaces a `disjointWith` violation. Reasoners and OWL-aware query engines see the same assertion in the TBox.

**Use this when:**
- Two classes are siblings under a parent and a single individual cannot belong to both at once (hardcover vs ebook, fiction vs non-fiction in your domain rules, etc.).

**Don't use this when:**
- The two classes overlap intentionally - use plain `Compose.subClassOf` for both without `disjointWith`.
- You want one class to be the negation of another - use [`Compose.complementOf`](/composition/sub-class-of) instead.

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './Book.js';
import { EBookSchema } from './EBook.js';

const PrintBookBase = Compose.subClassOf(BookSchema, {
  $id: 'urn:bookstore:PrintBook',
  type: 'object',
  properties: {
    binding:     { type: 'string', enum: ['hardcover', 'paperback'] },
    pageCount:   { type: 'integer', minimum: 1 },
    weightGrams: { type: 'number',  minimum: 0 },
  },
  required: ['binding', 'pageCount'],
} as const);

export const PrintBookSchema = Compose.disjointWith(EBookSchema, PrintBookBase);
// Wire: { $id, disjointWith: 'urn:bookstore:EBook', allOf: [...] }
// TBox: urn:bookstore:PrintBook  owl:disjointWith  urn:bookstore:EBook
```

→ See: [`Compose.disjointWith` reference](/composition/sub-class-of) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `entities/RareBook.ts`: `someValuesFrom` + `maxCardinality`

**In plain English:** a `RareBook` is a `PrintBook` with two extra rules about its `authors` array. `someValuesFrom(authors, AuthorName)` asserts that at least one value in the array is an `AuthorName` (rather than some other type). `maxCardinality(authors, 1)` says there is at most one author. Together: a rare book has exactly the right kind of author and never more than one. These are TBox (schema-level) rules; the reasoner uses them to derive facts and find contradictions, while JSON Schema validation handles structural checks.

**Use this when:**
- You want to express "at least one value of property P is of class C" - that's `Compose.someValuesFrom`.
- You want to cap how many values a property can have - that's `Compose.maxCardinality`.

**Don't use this when:**
- You only want to enforce array length at validation time - JSON Schema's native `minItems` / `maxItems` already cover that. Restrictions are for TBox semantic content that reasoners read.
- You want to require *every* value to satisfy a class - use [`Compose.allValuesFrom`](/composition/restrictions) (see `AnthologyBook` below).

```ts
import { Compose } from 'json-tology';
import { AuthorNameSchema } from './AuthorName.js';
import { PrintBookSchema } from './PrintBook.js';

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

export const RareBookSchema = Compose.subClassOf(
  Compose.maxCardinality(AUTHORS_PROP, 1),
  Compose.subClassOf(
    Compose.someValuesFrom(AUTHORS_PROP, AuthorNameSchema.$id),
    Compose.subClassOf(PrintBookSchema, {
      $id: 'urn:bookstore:RareBook',
      type: 'object',
      properties: {
        firstEditionYear:  { type: 'integer', minimum: 1450, maximum: 2100 },
        estimatedAgeYears: { type: 'integer', minimum: 0 },
      },
      required: ['firstEditionYear'],
    } as const),
  ),
);
// Wire: { $id, allOf: [...PrintBook chain..., body],
//         'jt:restrictions': [
//           { kind: 'someValuesFrom', onProperty: '...#authors', value: 'AuthorName' },
//           { kind: 'maxCardinality', onProperty: '...#authors', value: 1 }
//         ] }
// TBox: two anonymous owl:Restriction blank nodes referenced via rdfs:subClassOf.
```

→ See: [OWL class restrictions](/composition/restrictions) · [`Compose.subClassOf` reference](/composition/sub-class-of) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `entities/SoloAuthoredBook.ts`: `cardinality` (exact)

**In plain English:** a `SoloAuthoredBook` is a `Book` whose `authors` array contains exactly one entry - no fewer, no more. `Compose.cardinality(prop, n)` is the TBox version of "exactly n values".

**Use this when:**
- You need an *exact* count constraint on a property (exactly 2 parents, exactly 1 primary author, etc.).

**Don't use this when:**
- You want a range - use `Compose.minCardinality` and/or `Compose.maxCardinality` instead.
- The constraint is purely a runtime input check - JSON Schema's `minItems`/`maxItems` are simpler.

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './Book.js';

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

export const SoloAuthoredBookSchema = Compose.subClassOf(
  Compose.cardinality(AUTHORS_PROP, 1),
  Compose.subClassOf(BookSchema, {
    $id: 'urn:bookstore:SoloAuthoredBook',
    type: 'object',
  } as const),
);
// TBox: _:b1  a owl:Restriction ; owl:onProperty Book#authors ; owl:cardinality 1 .
```

→ See: [OWL class restrictions](/composition/restrictions) · [`Compose.subClassOf` reference](/composition/sub-class-of)

### `entities/AnthologyBook.ts`: `minCardinality` + `allValuesFrom`

**In plain English:** an `AnthologyBook` is a `Book` with two or more contributing authors, and *every one* of those authors must be an `AuthorName` (not just at least one). `minCardinality(prop, n)` enforces a lower-bound count. `allValuesFrom(prop, class)` says every value of the property is an instance of the named class.

**Use this when:**
- You need "at least n" on a property - that's `Compose.minCardinality`.
- You want a universal type constraint: every element of a property must be of a specific class - that's `Compose.allValuesFrom`.

**Don't use this when:**
- You only need "at least one" of a specific type - use `Compose.someValuesFrom` (the existential counterpart).
- You want exactly n - use `Compose.cardinality`.

```ts
import { Compose } from 'json-tology';
import { AuthorNameSchema } from './AuthorName.js';
import { BookSchema } from './Book.js';

const AUTHORS_PROP = 'urn:bookstore:Book#authors';

export const AnthologyBookSchema = Compose.subClassOf(
  Compose.minCardinality(AUTHORS_PROP, 2),
  Compose.subClassOf(
    Compose.allValuesFrom(AUTHORS_PROP, AuthorNameSchema.$id),
    Compose.subClassOf(BookSchema, {
      $id: 'urn:bookstore:AnthologyBook',
      type: 'object',
    } as const),
  ),
);
// TBox: two owl:Restriction blank nodes — minCardinality 2 + allValuesFrom AuthorName.
```

→ See: [OWL class restrictions](/composition/restrictions) · [`Compose.subClassOf` reference](/composition/sub-class-of)

### `entities/InPrintBook.ts`: `hasValue`

**In plain English:** an `InPrintBook` is a `Book` whose `inStock` property is fixed to the literal value `true`. `Compose.hasValue(prop, literal)` pins a property to a specific scalar (string, number, or boolean). It's the TBox way of saying "every member of this class has property X equal to value Y".

**Use this when:**
- You want a class defined by a fixed scalar value on a property (status flag, fixed currency code, role enum value).

**Don't use this when:**
- The fixed value is a class instance - use `Compose.someValuesFrom` or `Compose.allValuesFrom` (those work with class IRIs, not literals).
- The constraint should only apply at runtime - JSON Schema's native `const` keyword is simpler.

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './Book.js';

const IN_STOCK_PROP = 'urn:bookstore:Book#inStock';

export const InPrintBookSchema = Compose.subClassOf(
  Compose.hasValue(IN_STOCK_PROP, true),
  Compose.subClassOf(BookSchema, {
    $id: 'urn:bookstore:InPrintBook',
    type: 'object',
  } as const),
);
// TBox: _:b1  a owl:Restriction ; owl:onProperty Book#inStock ; owl:hasValue "true"^^xsd:boolean .
```

→ See: [OWL class restrictions](/composition/restrictions) · [`Compose.subClassOf` reference](/composition/sub-class-of)

### `entities/OutOfPrintBook.ts`: `complementOf` bounded to Book

**In plain English:** an `OutOfPrintBook` is the negation of an `InPrintBook`, but only within the world of `Book`s. The `Compose.complementOf` declaration says "this class is everything that is not the other class". The body's `allOf: [{ $ref: Book }]` adds the structural rule "and it must also be a Book" so the complement is bounded - without it, OWL's open-world rules would match anything that isn't an `InPrintBook`, including a customer or an order.

**Use this when:**
- Two classes naturally tile a parent's universe and you want one defined as "the rest" (banned vs. approved books, returnable vs. non-returnable items, etc.). Combine `complementOf` with `subClassOf`/`allOf` to bound the universe explicitly.

**Don't use this when:**
- You want the unbounded OWL complement (every non-X in the universe). Pass the body without `allOf` and document the open-world semantic clearly.
- You want a runtime "not these specific values" check - JSON Schema's `not` at the top level (without OWL annotations) is simpler.

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './Book.js';
import { InPrintBookSchema } from './InPrintBook.js';

export const OutOfPrintBookSchema = Compose.complementOf(InPrintBookSchema, {
  $id: 'urn:bookstore:OutOfPrintBook',
  allOf: [{ $ref: BookSchema.$id }],
  type: 'object',
} as const);
// Wire: { $id, not: { $ref: 'urn:bookstore:InPrintBook' },
//         allOf: [{ $ref: 'urn:bookstore:Book' }], type: 'object' }
// TBox: urn:bookstore:OutOfPrintBook  owl:complementOf  urn:bookstore:InPrintBook .
//       urn:bookstore:OutOfPrintBook  rdfs:subClassOf   urn:bookstore:Book .
```

The body's `allOf: [{ $ref: Book }]` is what bounds the OWL complement to the Book universe. Without it, OWL's open-world `complementOf` would match anything that is not an `InPrintBook`: including non-books - which is the right OWL semantic but rarely what authors want.

→ See: [`Compose.complementOf` reference](/composition/sub-class-of) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

### `index.ts`: ABox `owl:sameAs` assertion

**In plain English:** all the schemas above are TBox declarations - they describe *kinds of thing*. `sameAs` is different: it operates on individuals (concrete records, the ABox), and asserts "these two IRIs name the same person/object/thing". In the bookstore the customer "Alice Smith" exists in the current system as `urn:bookstore:customer:AliceSmith`, but a legacy CRM still references her as `urn:bookstore:customer:AliceSmithLegacy`. Recording `sameAs` lets a reasoner merge facts about the two IRIs into one logical individual.

**Use this when:**
- Two IRIs in your data refer to the same real-world entity (records merged after a migration, alias systems, cross-org identifiers).

**Don't use this when:**
- You want class-level identity (two *classes* that have the same instances) - use [`Compose.equivalent`](/composition/equivalent) instead. `sameAs` is for individuals, not classes.
- You want to express "these two records *should* be merged" as a workflow step. `sameAs` is an OWL *assertion* that they already refer to one entity; downstream reasoners will treat their property values as belonging to a single individual.

```ts
import { JsonTology } from 'json-tology';
// ... all schemas registered above ...

export const bookstoreEntities = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: allSchemas,
});

// Two customer IRIs that resolve to the same individual.
bookstoreEntities.sameAs(
  'urn:bookstore:customer:AliceSmith',
  'urn:bookstore:customer:AliceSmithLegacy',
);
// toQuads() emits both directions:
//   <AliceSmith>       owl:sameAs  <AliceSmithLegacy>
//   <AliceSmithLegacy> owl:sameAs  <AliceSmith>
```

→ See: [`sameAs` (ABox identity) reference](/advanced/sameas) · [`Compose.equivalent`](/composition/equivalent) (the class-level counterpart) · [Graph concepts (TBox / ABox)](/advanced/graph-concepts)

## Edge styles in the live graph

| Edge `kind` | Visual | Source |
|---|---|---|
| `subClassOf`       | solid gray with arrow         | `Compose.subClassOf` (single or multi-parent) |
| `equivalentClass`  | green dashed                  | `Compose.equivalent` |
| `disjointWith`     | red dashed                    | `Compose.disjointWith` |
| `complementOf`     | purple with tee terminator    | `Compose.complementOf` |
| `restriction`      | teal dotted, label = `prop ∃` / `∀` / `card =N` / `card ≥N` / `card ≤N` / `prop = literal` | user-authored `jt:restrictions` (any of the six factory methods) |
| `sameAs`           | gold dashed (symmetric)       | `JsonTology.prototype.sameAs` |
| `range`            | blue with vee arrow           | property `$ref` / `items.$ref` |

See:
- [`Compose.subClassOf` / `disjointWith` / `complementOf`](/composition/sub-class-of)
- [OWL class restrictions](/composition/restrictions)
- [`sameAs` (ABox identity)](/advanced/sameas)

## See also

- [Bookstore domain](/bookstore-domain) - the base schema definitions this taxonomy extends
- [Graph concepts](/advanced/graph-concepts) - TBox/ABox, OWL semantics, and graph-native authoring
