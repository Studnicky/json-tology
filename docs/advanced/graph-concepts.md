# Graph Concepts

> Validation modes: [Validation modes reference](/validation-modes)

json-tology represents every schema as a node in a directed graph. This page explains the key
concepts of that graph model - what lives where, how relationships work, and how standard semantic
web vocabulary maps onto JSON Schema constructs.

## TBox vs ABox

The semantic web distinguishes two kinds of knowledge:

- **TBox** (Terminological Box) - the schema layer: class declarations, property declarations,
  domain and range constraints. Describes the *shape* of the world.
- **ABox** (Assertional Box) - the data layer: typed individuals, property assertions.
  Describes *instances* of that shape.

In json-tology:

```ts
// TBox  - what a Book looks like
import { IsbnSchema } from './entities/Isbn.js';
import { TitleSchema } from './entities/Title.js';

const BookSchema = {
  $id: 'urn:bookstore:Book',
  type: 'object',
  properties: {
    isbn:   { $ref: IsbnSchema.$id },
    title:  { $ref: TitleSchema.$id }
  }
} as const;

// TBox output  - OWL class + property declarations
const tbox = entities.toTbox();

// ABox  - a specific book
const book = { isbn: '9780140449136', title: 'The Odyssey', ... };

// ABox output  - RDF quads about that instance
const abox = entities.toQuads(BookSchema, book);
```

`entities.toTbox()` emits the TBox.
`entities.toQuads(schema, data)` emits the ABox for a given data instance.
`entities.fromQuads(schemaId, quads)` lifts ABox quads back to typed objects.

**Bookstore example:**
- `BookSchema` lives in the TBox - it describes the class `urn:bookstore:Book`.
- `{ isbn: '9780140449136', title: 'The Odyssey', authors: [...], ... }` is an ABox assertion
  about a specific individual of that class.

---

## Open-world assumption

JSON Schema describes what is *required* and *constrained*, not what is *exhaustively listed*.
This is the **open-world assumption (OWA)**: a schema does not claim to enumerate all properties
that may ever exist on an instance.

```ts
import { CustomerIdSchema } from './entities/CustomerId.js';
import { CustomerNameSchema } from './entities/CustomerName.js';
import { EmailSchema } from './entities/Email.js';

const CustomerSchema = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:    { $ref: CustomerIdSchema.$id },
    email: { $ref: EmailSchema.$id },
    name:  { $ref: CustomerNameSchema.$id }
  },
  required: ['id', 'email', 'name']
} as const;
```

This schema says: every Customer *must* have `id`, `email`, and `name`. It does not say those
are the *only* properties allowed.

Whether additional properties are permitted depends on `additionalProperties` (JSON Schema) or
`jt:config.extra` (json-tology extension):

| Setting | Behavior |
|---|---|
| `additionalProperties` omitted (default) | Additional properties allowed |
| `additionalProperties: false` | Additional properties rejected |
| `jt:config.extra: 'allow'` | Additional properties passed through silently |
| `jt:config.extra: 'forbid'` | Additional properties raise a validation error |
| `jt:config.extra: 'ignore'` | Additional properties stripped from output |

**Contrast with closed-world (Pydantic-style):**
A Pydantic model lists all fields and rejects extras unless `extra='allow'` is set. Pydantic's
default is closed-world for extras. JSON Schema's default is open-world. json-tology follows
JSON Schema's convention - the OWA is the default unless you explicitly restrict it.

---

## Specificity and `rdfs:subClassOf`

More constraints = more specific type = subclass.

Every `PremiumCustomer` schema that extends `Customer` describes a *narrower* set of valid
instances. In OWL terms: the class `PremiumCustomer` is a subclass of `Customer`.

```ts
const PremiumCustomerSchema = Compose.extend(CustomerSchema, {
  $id: 'urn:bookstore:PremiumCustomer',
  properties: {
    tier: { type: 'string', enum: ['gold', 'platinum'] }
  },
  required: ['tier']
});
```

In the TBox, this emits:

```turtle
urn:bookstore:PremiumCustomer rdfs:subClassOf urn:bookstore:Customer .
```

`Compose.extend()` produces an `allOf + $ref` shape: the parent is referenced via `$ref` and
the additions live in a second `allOf` member. This preserves the merged type at compile time
and maps cleanly to `rdfs:subClassOf` in the graph.

**Design pattern - "author the most common ancestor first":**
Define the base schema first, then layer specializations with `Compose.extend()`. This keeps
the subclass hierarchy explicit and the TBox traversable.

See [Compose.extend](../composition/extend.md) for full API documentation.

---

## Equivalence and `owl:equivalentClass`

Two schemas can describe structurally identical data while carrying domain-distinct names.

```ts
const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  $id: 'urn:bookstore:PrimaryIsbn',
  description: 'The canonical ISBN used for indexing'
});
```

In the TBox, this emits:

```turtle
urn:bookstore:PrimaryIsbn owl:equivalentClass urn:bookstore:Isbn .
```

`Compose.equivalent()` creates a thin `$ref` alias. Instances that satisfy `Isbn` also satisfy
`PrimaryIsbn` and vice versa - they are logically interchangeable.

**Use case:** when a domain concept needs a distinct name for clarity but shares an existing
structure. For example, `OrderId` and `ReturnOrderId` might share the same string pattern but
represent different domain concepts. Equivalence avoids structural duplication while keeping
names meaningful.

---

See also [Graph internals](./graph-internals) for $ref resolution, serializer behavior, ABox projection, $id conventions, and the irreducible jt:* set.

## Related

- [Graph-native authoring](/advanced/graph-native-authoring) - how to write schemas that produce clean graphs
- [Ontology and Graphs](/advanced/ontology) - `toTbox`, `toShacl`, `ontology`, `toQuads`, `fromQuads`
- [RDF round-trip](/advanced/quads) - operator-level `toQuads` / `fromQuads` reference
- [SPARQL queries](/usage-examples/sparql-queries) - querying the TBox

## See also

- [Bookstore domain](/bookstore-domain) - the running example domain for all graph examples
- [Your types are already a graph](/your-types-are-a-graph) - conceptual introduction
