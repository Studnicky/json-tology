# RDF round-trip with `toQuads` / `fromQuads`

> You only need this section if you want to project typed instance data **out** as RDF quads, run reasoning or graph queries over it, and then **lift** the resulting quads back into typed JS objects. This is unique to json-tology - no other validator on the comparison list offers a symmetric ABox round-trip.

The same canonical graph used for validation drives both directions. `toQuads` lowers a typed value into ABox quads; `fromQuads` lifts quads back through `instantiate`, applying defaults, transforms, and validation on the way in.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used throughout these examples.

---

## Quad / SubjectGroup {#quad-shape}

A `Quad` is the atomic unit of RDF data produced and consumed by `toQuads` / `fromQuads`. Each quad is a plain object with four fields:

- `subject`: the IRI or blank-node identifier of the resource being described
- `predicate`: the property IRI
- `object`: the value (IRI, blank node, or typed literal)
- `graph`: the named-graph IRI, or the default graph when omitted

A `SubjectGroup` is a convenience wrapper that groups all quads sharing the same subject, making it easier to reconstruct a single typed object from a quad array. `fromQuads` uses subject groups internally when lifting quads back into typed JS values via [`instantiate`](/validation/instantiate).

---

## `jt.toQuads` {#jt-toquads}

**Declaration.** Projects instance data through the canonical graph and returns a `QuadInterface[]` array of the projected ABox quads. The first argument is a schema object with `$id` (registers the schema if it is not already registered). The second argument is the typed value, normally the output of `instantiate()`. To serialize the quads as JSON-LD, pass them to an `OntologyBuilder` via `addFromQuads(quads)` and call `jsonLd()`, `jsonLdObject()`, or `shaclObject()` on the builder.

**Use this when** you want to publish a validated value as Linked Data, push it into a triple store, hand it to an OWL or SHACL reasoner, or merge it into a knowledge graph that already contains the matching TBox.

**Don't use this when** you only need a wire-form payload (use [`dump`](/serialization/dump)). Don't use it as a generic "to JSON" helper - quads carry RDF semantics, not display formatting.

### Examples

#### Example 1: Project an order to ABox quads

<RunnableExample src="examples/docs/advanced/34-toquads-order-abox" />

#### Example 2: Merge ABox with TBox in a single document

<RunnableExample src="examples/docs/advanced/35-toquads-merge-tbox-abox-order" />

### Subject minting with `iriFor`

The default minter assigns `<baseIri>/instances/<classId>-<contentHash>` to every projected object. To override that, pass `iriFor` to `toQuads`:

<RunnableExample src="examples/docs/advanced/36-toquads-irifor-strategies" />

See [skolemization](/advanced/skolemization) for the strategy reference.

### Blank-node subjects with `BLANK_NODE_IRI_FOR`

Pass `{ iriFor: BLANK_NODE_IRI_FOR }` to produce anonymous blank-node subjects instead of IRI-named nodes. Useful for transient quads (e.g. SHACL validation input) where no persistent identity is needed.

<RunnableExample src="examples/docs/advanced/112-blank-node-iri" />

### Graph IRI

Set the `graph` field on every emitted quad with `graphIri`:

<RunnableExample src="examples/docs/advanced/37-toquads-graph-iri" />

Both options can be paired with registry-level defaults via `JsonTology.create({ iriFor, defaultGraphIri })`: see [Static helpers - graph emission options](/static-helpers#graph-emission-options).

## `jt.fromQuads` {#jt-fromquads}

**Declaration.** Inverse of `toQuads`. Given an array of quads and a target schema reference (`$id` string or schema object with `$id`), returns an array of validated typed objects. Each returned value runs through `instantiate`, so defaults are applied, transforms execute, and validation errors throw `InstantiationError`.

**Use this when** quads arrive from an external source - a triple store, a reasoner output, a federated query, an inbound RDF payload - and you want them as typed JS objects. The return is an array because a single subject set can contain multiple instances of the target class.

**Don't use this when** you already have JS objects in hand (use [`instantiate`](/validation/instantiate) directly). Don't use it on quads with no `rdf:type` or no recognizable predicates - lifting needs the property IRIs that match the target schema's graph.

#### Reversible skolemization

Pass `{ deskolemize: true }` to treat IRIs matching the W3C well-known genid pattern (`*/.well-known/genid/<hash>`) as blank nodes during reconstruction. This pairs with `Skolemize.wellKnownGenid` on `toQuads`:

<RunnableExample src="examples/docs/advanced/38-fromquads-deskolemize-roundtrip" />

The registry-level `defaultDeskolemize: true` flips this on for every `fromQuads` call without per-call overrides.

### Examples

#### Example 1: Round-trip an order

<RunnableExample src="examples/docs/advanced/39-fromquads-order-roundtrip" />

#### Example 2: Lift quads from a triple store

<RunnableExample src="examples/docs/advanced/40-fromquads-lift-external-books" />

### `fromQuads` subject-type dispatch

When a combined quad set contains individuals of more than one class, `fromQuads` uses each subject's `rdf:type` triple to dispatch to the correct schema. Calling `fromQuads` with `EBookSchema.$id` lifts only EBook subjects; calling it with `PrintBookSchema.$id` lifts only PrintBook subjects.

<RunnableExample src="examples/docs/advanced/105-fromquads-subject-type-dispatch" />

---

## Static counterparts

Both methods have static counterparts on `JsonTology` for one-shot use without a long-lived registry. The static variants build an ephemeral registry containing only the supplied schema, run the operation, and discard the registry.

<RunnableExample src="examples/docs/advanced/41-toquads-fromquads-static" />

Use the static form when:

- The schema is self-contained and does not `$ref` other registered schemas.
- You do not plan to project the same schema repeatedly (each call rebuilds the graph).

For repeated projections, hold onto a `JsonTology` instance.

## Comparison

| Tool | ABox round-trip |
|------|-----------------|
| json-tology `toQuads` / `fromQuads` | Symmetric round-trip through the canonical graph |
| Zod | No equivalent |
| TypeBox + Value | No equivalent |
| AJV | No equivalent |
| Pydantic | No equivalent |

This capability is unique to json-tology because the runtime representation is already a graph - validation, materialization, and ABox projection all consume the same node and relation structure.

## rdf/js ecosystem interop {#rdfjs-interop}

json-tology produces rdf/js-spec quads directly. No conversion required.

`QuadInterface` is a re-export of [`@rdfjs/types#Quad`](https://rdf.js.org/data-model-spec/#quad-interface).
Quads carry the rdf/js-spec `termType: 'Quad'`, `value: ''`, and `equals(other)`.

- `subject` is a `NamedNode` or `BlankNode`
- `predicate` is a `NamedNode`
- `object` is a `NamedNode`, `BlankNode`, or `Literal`
- `graph` is a `NamedNode`, `BlankNode`, or `DefaultGraph`
- `Literal.value` is `string` per the rdf/js spec; the JS type tag is carried
  in `Literal.datatype.value` (`xsd:integer`, `xsd:boolean`, `xsd:dateTime`, etc.)

`@rdfjs/types` is a runtime dependency of json-tology (types-only, zero runtime
cost), so you can `import type { Quad } from '@rdfjs/types'` without a separate
install.

### Piping to n3.Writer

<!-- inline-ts-ok: cross-package interop pattern - imports `n3` (a devDependency for this docs example); no runnable file because n3 is not in runtime dependencies -->
```ts
import { Writer } from 'n3';

const jt = JsonTology.create({ baseIri: 'https://bookstore.example', schemas: [CustomerSchema] as const });
const quads = jt.toQuads(CustomerSchema, { id: 'cust-1', name: 'Alice', email: 'alice@example.com' });

// No cast required — QuadInterface is @rdfjs/types#Quad.
const writer = new Writer();
writer.addQuads(quads);
writer.end((_err, result) => console.log(result));
```

### Terms factory

The in-house `Terms` factory (`src/modules/rdf/Terms.ts`) produces rdf/js-spec
term objects (`NamedNode`, `BlankNode`, `Literal`, `DefaultGraph`) and quads
(`@rdfjs/types#Quad`) without requiring `@rdfjs/data-model` at runtime. To use
a different DataFactory (e.g. `n3.DataFactory`, `@rdfjs/data-model`), construct
quads with that factory and pass them into `jt.fromQuads()`. They are accepted
as-is because the project's accepted shape is the canonical rdf/js spec.

### Recovering typed JS values from literals

`Literal.value` is `string` per the rdf/js spec. The original JS type
(number, boolean, Date) is carried in `Literal.datatype.value`
(`xsd:integer`, `xsd:boolean`, `xsd:dateTime`, …). To recover the typed JS
value, call `Terms.decodeLiteral(literal)`:

<RunnableExample src="examples/docs/advanced/98-decode-literal-typed-values" />

`fromQuads`, the internal `Lift` pipeline, and the OWL import dispatchers call
`Terms.decodeLiteral` automatically, so consumers using those entry points never have
to hand-decode.

### RDF lists

RDF lists (used by `owl:unionOf`, `owl:oneOf`, `sh:or`, `sh:in`, etc.) are
emitted as the standard `rdf:first` / `rdf:rest` / `rdf:nil` triple chain.
There is no project-internal "list term". The list head (a `BlankNode`) appears
in the parent triple's object position and the chain materialises as additional
quads.

Use `Lists.build(items)` to assemble a list as the object of a quad, and
`Lists.collect(head, allQuads)` to walk the chain back into an item array:

<RunnableExample src="examples/docs/advanced/99-lists-build-and-collect" />

## Related

- [`toTbox`](/advanced/ontology#jt-totbox) - class and property declarations (TBox companion to ABox `toQuads`)
- [`toShacl`](/advanced/ontology#jt-toshacl) - structural shape constraints
- [`ontology`](/advanced/ontology#jt-ontology) - combined TBox + SHACL
- [`instantiate`](/validation/instantiate) - the validator that runs on each lifted object

## See also

- [Graph concepts](/advanced/graph-concepts) - canonical graph structure
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
