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

**Declaration.** Projects instance data through the canonical graph and returns a `QuadInterface[]` array of the projected ABox quads. The first argument is a schema object with `$id` (registers the schema if it is not already registered). The second argument is the typed value, normally the output of `instantiate()`. To serialize the quads as JSON-LD, pass them to an `OntologyBuilder` via `addQuads(quads)` and call `jsonLd()`, `jsonLdObject()`, or `raw()` on the builder.

**Use this when** you want to publish a validated value as Linked Data, push it into a triple store, hand it to an OWL or SHACL reasoner, or merge it into a knowledge graph that already contains the matching TBox.

**Don't use this when** you only need a wire-form payload (use [`dump`](/serialization/dump)). Don't use it as a generic "to JSON" helper - quads carry RDF semantics, not display formatting.

### Examples

#### Example 1: Project an order to ABox quads

<<< ../../examples/docs/advanced/34-toquads-order-abox.ts

#### Example 2: Merge ABox with TBox in a single document

<<< ../../examples/docs/advanced/35-toquads-merge-tbox-abox-order.ts

### Subject minting with `iriFor`

The default minter assigns `<baseIRI>/instances/<classId>-<contentHash>` to every projected object. To override that, pass `iriFor` to `toQuads`:

<<< ../../examples/docs/advanced/36-toquads-irifor-strategies.ts

See [skolemization](/advanced/skolemization) for the strategy reference.

### Graph IRI

Set the `graph` field on every emitted quad with `graphIRI`:

<<< ../../examples/docs/advanced/37-toquads-graph-iri.ts

Both options can be paired with registry-level defaults via `JsonTology.create({ iriFor, defaultGraphIRI })`: see [Static helpers - graph emission options](/static-helpers#graph-emission-options).

## `jt.fromQuads` {#jt-fromquads}

**Declaration.** Inverse of `toQuads`. Given an array of quads and a target schema reference (`$id` string or schema object with `$id`), returns an array of validated typed objects. Each returned value runs through `instantiate`, so defaults are applied, transforms execute, and validation errors throw `InstantiationError`.

**Use this when** quads arrive from an external source - a triple store, a reasoner output, a federated query, an inbound RDF payload - and you want them as typed JS objects. The return is an array because a single subject set can contain multiple instances of the target class.

**Don't use this when** you already have JS objects in hand (use [`instantiate`](/validation/instantiate) directly). Don't use it on quads with no `rdf:type` or no recognizable predicates - lifting needs the property IRIs that match the target schema's graph.

#### Reversible skolemization

Pass `{ deskolemize: true }` to treat IRIs matching the W3C well-known genid pattern (`*/.well-known/genid/<hash>`) as blank nodes during reconstruction. This pairs with `Skolemize.wellKnownGenid` on `toQuads`:

<<< ../../examples/docs/advanced/38-fromquads-deskolemize-roundtrip.ts

The registry-level `defaultDeskolemize: true` flips this on for every `fromQuads` call without per-call overrides.

### Examples

#### Example 1: Round-trip an order

<<< ../../examples/docs/advanced/39-fromquads-order-roundtrip.ts

#### Example 2: Lift quads from a triple store

<<< ../../examples/docs/advanced/40-fromquads-lift-external-books.ts

## Static counterparts

Both methods have static counterparts on `JsonTology` for one-shot use without a long-lived registry. The static variants build an ephemeral registry containing only the supplied schema, run the operation, and discard the registry.

<<< ../../examples/docs/advanced/41-toquads-fromquads-static.ts

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

The quad terms produced by `toQuads`, `toTbox`, and `toShacl` are structurally
compatible with the [rdf/js Data Model Spec](https://rdf.js.org/data-model-spec/):

- `subject` and `predicate` are `NamedNode`-shaped objects (IRI, `.termType: "NamedNode"`, `.equals()`)
- `graph` is a `NamedNode`-, `BlankNode`-, or `DefaultGraph`-shaped object
- `object` is a `NamedNode`, `BlankNode`, or literal-shaped object in the common ABox case

The `@rdfjs/types` package is a `dependency` of json-tology (types-only, zero runtime cost),
so you can import rdf/js interfaces without a separate `npm install @rdfjs/types`.

### Piping to n3.Writer

<!-- inline-ts-ok: ecosystem-interop note — imports n3 and @rdfjs/types which are devDependencies; no runnable example file exists for this cross-package cast pattern -->
```ts
import { Writer } from 'n3';
import type { Quad } from '@rdfjs/types';

const jt = JsonTology.create({ baseIRI: 'https://bookstore.example', schemas: [CustomerSchema] as const });
const quads = jt.toQuads(CustomerSchema, { id: 'cust-1', name: 'Alice', email: 'alice@example.com' });

// The common ABox case (NamedNode/BlankNode/string literals) is directly compatible.
// Cast needed only because LiteralTermType.value is `unknown` (project widening).
const writer = new Writer();
writer.addQuads(quads as unknown as Quad[]);
writer.end((_err, result) => console.log(result));
```

### Terms factory

The in-house `Terms` factory (`src/modules/rdf/Terms.ts`) produces objects that
are structurally identical to the rdf/js spec with zero runtime indirection. It
is a drop-in replacement for `@rdfjs/data-model` for the term types used in this
package. To use a different DataFactory implementation (e.g. `n3.DataFactory`,
`@rdfjs/data-model`), construct quads directly with that factory and pass them
into `jt.fromQuads()` — they are accepted as-is because the project's accepted
shape is the canonical rdf/js term structure.

### Notes on LiteralTermType

`LiteralTermType.value` is typed as `unknown` rather than `string`. This is an
intentional widening: the internal `Terms.literal(value, options)` factory stores
raw JS values (number, boolean, etc.) so that `fromQuads` can lift them back into
typed JS objects without a second coercion step. At the rdf/js boundary, coerce
with `String(literal.value)`.

For quads produced by `toQuads` that will be piped to a triple store or serializer,
the cast `as unknown as Quad[]` is safe: the actual runtime values are correct
rdf/js-shaped objects whose literal `.value` fields contain the serialised string
form appropriate for the declared XSD datatype.

## Related

- [`toTbox`](/advanced/ontology#jt-totbox) - class and property declarations (TBox companion to ABox `toQuads`)
- [`toShacl`](/advanced/ontology#jt-toshacl) - structural shape constraints
- [`ontology`](/advanced/ontology#jt-ontology) - combined TBox + SHACL
- [`instantiate`](/validation/instantiate) - the validator that runs on each lifted object

## See also

- [Graph concepts](/advanced/graph-concepts) - canonical graph structure
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
