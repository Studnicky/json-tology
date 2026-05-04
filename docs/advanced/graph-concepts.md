# Graph Concepts

json-tology represents every schema as a node in a directed graph. This page explains the key
concepts of that graph model — what lives where, how relationships work, and how standard semantic
web vocabulary maps onto JSON Schema constructs.

## TBox vs ABox

The semantic web distinguishes two kinds of knowledge:

- **TBox** (Terminological Box) — the schema layer: class declarations, property declarations,
  domain and range constraints. Describes the *shape* of the world.
- **ABox** (Assertional Box) — the data layer: typed individuals, property assertions.
  Describes *instances* of that shape.

In json-tology:

```ts
// TBox — what a Book looks like
const BookSchema = {
  $id: 'urn:bookstore:Book',
  type: 'object',
  properties: {
    isbn:   { $ref: 'urn:bookstore:Isbn' },
    title:  { $ref: 'urn:bookstore:Title' }
  }
} as const;

// TBox output — OWL class + property declarations
const tbox = entities.toTbox();

// ABox — a specific book
const book = { isbn: '9780140449136', title: 'The Odyssey', ... };

// ABox output — RDF quads about that instance
const abox = entities.toQuads(BookSchema, book);
```

`entities.toTbox()` emits the TBox.
`entities.toQuads(schema, data)` emits the ABox for a given data instance.
`entities.fromQuads(schemaId, quads)` lifts ABox quads back to typed objects.

**Bookstore example:**
- `BookSchema` lives in the TBox — it describes the class `urn:bookstore:Book`.
- `{ isbn: '9780140449136', title: 'The Odyssey', authors: [...], ... }` is an ABox assertion
  about a specific individual of that class.

---

## Open-world assumption

JSON Schema describes what is *required* and *constrained*, not what is *exhaustively listed*.
This is the **open-world assumption (OWA)**: a schema does not claim to enumerate all properties
that may ever exist on an instance.

```ts
const CustomerSchema = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:    { $ref: 'urn:bookstore:CustomerId' },
    email: { $ref: 'urn:bookstore:Email' },
    name:  { $ref: 'urn:bookstore:PersonName' }
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
JSON Schema's convention — the OWA is the default unless you explicitly restrict it.

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

**Design pattern — "author the most common ancestor first":**
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
`PrimaryIsbn` and vice versa — they are logically interchangeable.

**Use case:** when a domain concept needs a distinct name for clarity but shares an existing
structure. For example, `OrderId` and `ReturnOrderId` might share the same string pattern but
represent different domain concepts. Equivalence avoids structural duplication while keeping
names meaningful.

---

## JSON Pointer canonical identifiers

Every node in the schema graph has a stable identifier derived from JSON Pointer syntax.

**Schema-level IRI:** `$id` directly — `urn:bookstore:Book`.

**Sub-schema IRI:** `$id` + fragment — `urn:bookstore:Book#/properties/isbn`.

These stable pointers are used internally for:
- `$ref` resolution: `{ $ref: 'urn:bookstore:Isbn' }` resolves via the registry to the schema
  whose `$id` matches that string.
- Anchor lookup: `$anchor` values establish named pointer aliases within a schema.
- `validateAt` sub-schema selection: `jt.validateAt(schema, data, '/properties/isbn')` applies
  the `isbn` sub-schema to a value.

**Instance paths vs schema paths:** JSON Pointer appears in two distinct contexts:

| Context | Example | Points at |
|---|---|---|
| Schema path | `urn:bookstore:Book#/properties/isbn` | A *sub-schema* node in the schema graph |
| Instance path | `/isbn` | A *value* in a data object |

Schema paths are used for internal graph navigation and programmatic use.
Instance paths appear in validation error messages.

---

## Domain and range

Properties in OWL have `rdfs:domain` (the class the property belongs to) and `rdfs:range`
(the class or datatype of its value).

json-tology derives these from the schema graph:

```ts
// Book has isbn, which is of type Isbn
const BookSchema = {
  $id: 'urn:bookstore:Book',
  properties: {
    isbn: { $ref: 'urn:bookstore:Isbn' }
  }
} as const;
```

This emits (in the TBox):

```turtle
urn:bookstore:Book#isbn  rdfs:domain  urn:bookstore:Book .
urn:bookstore:Book#isbn  rdfs:range   urn:bookstore:Isbn .
```

For primitive string properties with a `format` hint, the range is an XSD datatype:

```ts
const ArticleSchema = {
  $id: 'urn:example:Article',
  properties: {
    publishedAt: { type: 'string', format: 'date' },
    permalink:   { type: 'string', format: 'uri' }
  }
} as const;
```

This emits:

```turtle
urn:example:Article#publishedAt  rdfs:range  xsd:date .
urn:example:Article#permalink    rdfs:range  xsd:anyURI .
```

Supported format → XSD mappings include: `date` → `xsd:date`, `date-time` → `xsd:dateTime`,
`time` → `xsd:time`, `duration` → `xsd:duration`, `uri`/`iri`/`uri-reference` → `xsd:anyURI`.
Formats without an XSD equivalent (`email`, `uuid`, `hostname`, etc.) stay `xsd:string`.

---

## `$ref` resolution

The schema graph is a **directed graph**, not a tree. `$ref` creates edges between nodes.

```ts
// Book → isbn → Isbn (cross-schema $ref)
const BookSchema = {
  $id: 'urn:bookstore:Book',
  properties: {
    isbn: { $ref: 'urn:bookstore:Isbn' }
  }
} as const;
```

`$defs` entries live in the **same namespace** as their parent schema. They are part of
that schema's ontology surface:

```ts
const OrderSchema = {
  $id: 'urn:bookstore:Order',
  $defs: {
    LineItem: {
      type: 'object',
      properties: { qty: { type: 'integer' } }
    }
  },
  properties: {
    line: { $ref: '#/$defs/LineItem' }
  }
} as const;
```

Here `LineItem` is accessible as `urn:bookstore:Order#/$defs/LineItem` — a node in the graph
whose parent is `urn:bookstore:Order`.

Cross-schema `$ref` values resolve through the registry. A `$ref` is looked up by its IRI
against all registered schemas. The graph edges connect nodes across schema boundaries.

---

## The serializer trio

json-tology exposes three serialization entry points:

| Method | Output | Use when |
|---|---|---|
| `jt.toTbox()` | OWL classes and properties only | Feeding a reasoner; querying class hierarchy |
| `jt.toShacl()` | SHACL shapes only | Validating external data against your schema |
| `jt.ontology()` | OWL TBox + SHACL combined | Generating a complete ontology document |

```ts
// OWL only — class declarations, domain/range, subClassOf
const tbox  = entities.toTbox();

// SHACL only — node shapes, property shapes, cardinality
const shacl = entities.toShacl();

// Both combined
const ont   = entities.ontology();

// Render to JSON-LD string
console.log(ont.jsonLd());

// Inspect raw JSON-LD graph
const nodes = tbox.raw();

// Get SHACL-specific representation
const shapes = shacl.shaclObject();
```

**Decision guide:**
- Integrating with an OWL reasoner (Pellet, EYE, etc.) → `toTbox()`
- Validating third-party data against your schema in a SHACL processor → `toShacl()`
- Publishing a complete ontology document → `ontology()`

---

## ABox projection

ABox projection converts typed JavaScript objects into RDF quads and back.

```ts
const book: Book = {
  isbn: '9780140449136',
  title: 'The Odyssey',
  authors: ['Homer'],
  price: 1299,
  currency: 'USD'
};

// Typed object → RDF quads (ABox)
const quads = entities.toQuads(BookSchema, book);

// RDF quads → typed object (round-trip)
const [restored] = entities.fromQuads('urn:bookstore:Book', quads);
```

`toQuads` produces one quad per property, typed according to the schema's XSD/IRI mappings.
`fromQuads` reconstructs the object by reading quad subjects and predicates.

The round-trip is symmetric: `fromQuads(id, toQuads(schema, obj))` recovers the original object.

---

## `$id` IRI conventions

`$id` values are IRIs. Two conventions are common:

| Prefix | When to use |
|---|---|
| `urn:` | Project-local schemas not published to the web |
| `https://` | Web-resolvable schemas |

The bookstore example uses `urn:bookstore:{PascalCase}` — e.g. `urn:bookstore:Isbn`,
`urn:bookstore:Book`.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: allSchemas
});
```

`baseIRI` is used by the serializers to expand CURIE prefixes and anchor relative IRIs. It does
not need to match the `$id` prefixes of the registered schemas — it is the base for the
ontology document itself.

---

## Query patterns

Once you have a TBox, you can query it with SPARQL. The `toTbox().jsonLd()` output is a valid
JSON-LD document that can be loaded into any RDF store.

```sparql
# Find all subclasses of urn:bookstore:Customer
SELECT ?subclass WHERE {
  ?subclass rdfs:subClassOf <urn:bookstore:Customer> .
}

# Find all properties whose range is urn:bookstore:Isbn
SELECT ?property WHERE {
  ?property rdfs:range <urn:bookstore:Isbn> .
}

# Find all named primitives (classes that are not object schemas)
SELECT ?cls WHERE {
  ?cls a owl:Class .
  FILTER NOT EXISTS { ?cls rdfs:subClassOf ?parent . }
}
```

**Usage with N3.js (example):**

```ts
import { Store, Parser } from 'n3';

const store = new Store();
const parser = new Parser({ format: 'application/ld+json' });

parser.parse(entities.toTbox().jsonLd(), (error, quad) => {
  if (quad) store.addQuad(quad);
});

// Query: all subclass relations
const subclasses = store.getQuads(null, 'http://www.w3.org/2000/01/rdf-schema#subClassOf', null, null);
```

---

## The irreducible `jt:*` set

json-tology emits standard W3C vocabulary wherever possible. A small set of JSON Schema
concepts has no standard counterpart and is represented using the `jt:` prefix:

| Keyword | Why `jt:` is needed |
|---|---|
| `jt:multipleOf` | Divisibility constraint — XSD and SHACL have no modulo predicate |
| `jt:if`, `jt:then`, `jt:else` | JSON Schema conditionals — SHACL Core lacks native if/then/else (SHACL 1.2 draft adds them; not yet finalized) |
| `jt:dependentRequired` | Same SHACL gap — no standard property for co-required fields |
| `jt:alias` | Input-key normalization — a runtime concern for coercion, not an ontology property |
| `jt:computed` | Runtime-derived property — no standard predicate for "computed at materialize time" |
| `jt:strict` | Per-field validation behavior — a runtime coercion control, not an ontology property |
| `jt:frozen` | `Object.freeze` output — a runtime effect, not an ontology concern |
| `jt:config` | Config bag — a composite of the above runtime concerns |

Whenever a JSON Schema concept can be expressed in standard RDFS, OWL, SHACL, or XSD
vocabulary, json-tology emits it that way. The `jt:*` predicates are reserved for the
irreducibles.
