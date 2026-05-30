# Graph-native authoring

This page is about **schema drift**. The graph framing is one consequence of avoiding drift, not the primary motivation.

## The drift problem

When the same concept is defined in multiple places, every place becomes its own source of truth. An application that defines email validation six times has six versions of "what counts as a valid email." Fix a bug in one, and the other five keep producing the same bug. Tighten the constraint in one, and a value that's valid in five places suddenly fails in the sixth. The bugs that come out of this are hard to trace because the symptom (rejection at one boundary, acceptance at another) doesn't point at the cause (two divergent definitions of the same concept).

This is not a graph problem. It is a duplication problem. Every type system that lets you inline constraints has it: TypeScript, Pydantic, Zod, TypeBox, JSON Schema authored by hand. The mitigation is the same in all of them: define each concept once and reference it everywhere it appears.

json-tology happens to model the consequences of duplication explicitly. When you inline `{ type: 'string', pattern: '^[^@]+@[^@]+$' }` six times, the canonical graph contains six separate, unrelated property nodes. Each carries its own copy of the constraint. The OWL TBox output emits six anonymous DatatypeProperty ranges. The SHACL output emits six unrelated `sh:pattern` constraints. Reasoning queries traversing the graph cannot link them. They are the same fact written six times, and the system treats them as six different facts.

The fix is to extract the concept to a named schema and reference it. This page calls that pattern **graph-native authoring** because the graph makes the cost of duplication visible. The same pattern is good practice in any type system; the graph is the diagnostic, not the reason.

The rest of this page covers:

- How to detect duplicate inline shapes ([`SchemaRegistry.findDuplicates`](/registry/find-duplicates))
- How to enforce the named-entity pattern at registration time ([strict graph mode](/advanced/strict-graph-mode))
- The structural equivalence operator ([`Compose.equivalent`](/composition/equivalent)) for two domain-distinct concepts that share validation rules
- What "graph-native" actually means in the OWL TBox / SHACL output

## Why named primitives matter {#why-named-primitives-matter}

### The divergence problem

When you write the same constrained shape inline in two different schemas, the graph sees them as two separate, unrelated nodes:

<RunnableExample src="examples/docs/advanced/81-graph-native-antipattern-inline" />

The OWL output produces two anonymous DatatypeProperty ranges. Fix the ISBN regex once, and you have to find and update every copy. SHACL constraint propagation and rdfs:range reasoning work per-node - the two "isbn" properties have no declared relationship.

### The named-entity solution

<RunnableExample src="examples/docs/advanced/82-graph-native-named-entity" />

Now:
- Change the ISBN pattern in one place - both schemas update.
- OWL output emits `urn:bookstore:Isbn` as a named `rdfs:Datatype`.
- SHACL output links `sh:datatype` through the named type.
- `findDuplicates()` returns an empty array.

## The per-entity file convention {#per-entity-file-convention}

A predictable file layout makes graph-native authoring easy to follow. One file per `$id` segment:

```
entities/
  Isbn.ts            # $id: urn:bookstore:Isbn
  Author.ts          # $id: urn:bookstore:Author
  Book.ts            # $id: urn:bookstore:Book
  Order.ts           # $id: urn:bookstore:Order
  OrderLine.ts       # $id: urn:bookstore:OrderLine
```

Inside `Book.ts`:

<RunnableExample src="examples/docs/advanced/83-graph-native-per-entity-file" />

Always show the import that defines the referenced shape - never use a bare string `$ref` pointing to an undocumented IRI.

## Structural equivalence

When two schemas describe the same data but represent distinct domain concepts, use `Compose.equivalent` to give the second a name without duplicating the structure. See [`Compose.equivalent`](/composition/equivalent) for the operator declaration; the relevant fact for graph authoring is that it produces a thin `$ref` alias which the OWL projection emits as `owl:equivalentClass`.

## Structural extension

See [`Compose.extend`](/composition/extend) for the operator declaration; the relevant fact for graph authoring is that `extend` produces `allOf + $ref` rather than flattening properties, which preserves the parent class as a real graph node and emits as `rdfs:subClassOf` in the OWL projection.

## Detection and enforcement

Detection has on-demand ([`findDuplicates`](/registry/find-duplicates)), warning ([`enableInlineWarnings`](/advanced/strict-graph-mode), [`enableDuplicateDetection`](/advanced/strict-graph-mode)), and enforcement ([`enableStrictGraph`](/advanced/strict-graph-mode)) modes.

## When inline is OK {#when-inline-is-ok}

Not every project needs strict graph mode. Inline shapes are fine when:

- The schema has a single consumer and will never be reused.
- It's a throwaway script or one-off data validation utility.
- You're prototyping and the ontology contract isn't relevant yet.

The cost of inline shapes is borne only by graph users: OWL/SHACL output is less precise, `findDuplicates()` reports noise, and global type changes require manual find-and-replace. If you're not using the ontology output, inline shapes have no runtime cost.

---

*Cross-references: [Ontology output](/advanced/ontology#jt-ontology) · [toQuads](/advanced/ontology#jt-toquads) · [toTbox](/advanced/ontology#jt-totbox) · [toShacl](/advanced/ontology#jt-toshacl)*

## See also

- [Bookstore domain](/bookstore-domain) - the running example domain
- [Your types are already a graph](/your-types-are-a-graph) - conceptual introduction to the graph model
- [Graph concepts](/advanced/graph-concepts) - TBox/ABox, OWA, equivalentClass
