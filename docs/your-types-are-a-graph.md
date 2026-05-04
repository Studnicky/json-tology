---
title: Your Types Are Already a Graph
---

# Your types are already a graph

Every non-trivial type system has a graph hiding in it. Here's the bookstore domain - six entity classes (`Customer`, `Order`, `Book`, `OrderLine`, `Address`, `Review`), seventeen atomic primitives (`Isbn`, `Email`, `Money`, …), every property a typed edge from one entity to another.

You don't need json-tology to have this graph. **You already do** - it's there in your TypeScript interfaces, your Pydantic models, your Zod schemas, your protobuf definitions, your JSON Schema documents. The shape of your domain is a directed graph of types referencing types, whether you draw it or not.

What json-tology adds is **semantic legibility**: the graph becomes machine-queryable. The same `$ref` you use for type inference becomes an `rdfs:subClassOf` edge. The same `enum` you use for unions becomes an `owl:oneOf` set. The same `pattern` you use for input validation becomes a `sh:pattern` constraint. None of these is new information - it's all already in the schema. json-tology just emits it in a vocabulary that machines (reasoners, query engines, other ontology tools) can read.

Below is the bookstore TBox rendered with [Cytoscape](https://js.cytoscape.org/). Click any node to inspect its schema. Edges are property names; arrowheads point from the property's domain (the entity that has the property) to its range (the type the property refers to).

<BookstoreGraph />

---

## Branding: same validation, different concepts

Look at the green dashed edge between `AuthorName` and `CustomerName`. Both validate to `{ type: 'string', minLength: 1, maxLength: 200 }` - they share the same rule. But they are domain-distinct: one belongs to book authorship, the other to customer identity. Mixing them in code would be a type error.

`Compose.equivalent` creates `AuthorName` as a thin `$ref` over `CustomerName`:

```ts
export const AuthorNameSchema = Compose.equivalent(
  CustomerNameSchema,
  {
    $id: 'urn:bookstore:AuthorName',
    description: 'Same validation as CustomerName; semantically a distinct domain concept.'
  }
);
```

The result: one compiled validator (no duplication), two separate class IRIs, and an `owl:equivalentClass` arc in the TBox linking them - visible as the green dashed edge in the graph above. Ontology-aware tools can infer that any `AuthorName` is also a valid `CustomerName` and vice versa, while your TypeScript types keep the two concepts nominally distinct.

---

## What this means

**You don't have to use the graph features to use json-tology.** Most consumers will use `validate()` and `coerce()` and never look at the TBox. That's fine - the graph is metadata, not the runtime.

But the graph is *there* either way. When you decide to query it (with `entities.toTbox()`), or visualize it in a different tool (with `entities.toTbox().jsonLd()`), or reason over it with an OWL inferrer, the same model that drives validation drives those workflows too. You don't get a second model. There's just one.

[See the same graph in WebVOWL →](/advanced/graph-vowl) - the W3C-style ontology viewer used by ontology engineers. Same data, different visual language.

[Read the graph concepts guide →](/advanced/graph-concepts) - TBox/ABox, OWA, subClassOf, equivalentClass, the full conceptual coverage.

---

## Legend

### Nodes

| Color | Meaning |
|---|---|
| Dark blue (`#005a9c`) | Entity schema - has object properties (Book, Customer, Order, ...) |
| Light blue (`#a8d1f0`) | Primitive schema - a named leaf type (Isbn, Email, Money, ...) |

### Edges

| Style | Kind | Meaning |
|---|---|---|
| Solid gray arrow | `subClassOf` | Source is a subclass of target (from `Compose.extend`) |
| Green dashed | `equivalentClass` | Logically identical classes (from `Compose.equivalent`) |
| Solid blue vee | `range` | A property of the source points to the target class |
| Dotted orange | `domain` | Explicit `rdfs:domain` override (rare, usually inferred) |

## Related

- [Graph concepts](/advanced/graph-concepts) - TBox/ABox, OWA, subClassOf, equivalentClass
- [Ontology and Graphs](/advanced/ontology) - `toTbox`, `toShacl`, `ontology`, `toQuads`
- [Graph-native authoring](/advanced/graph-native-authoring) - named primitives and `$ref`

## See also

- [Bookstore domain](/bookstore-domain) - the domain rendered in the graph above
- [WebVOWL viewer](/advanced/graph-vowl) - the same TBox in the W3C-aligned ontology visualizer
