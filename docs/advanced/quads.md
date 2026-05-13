# RDF round-trip with `toQuads` / `fromQuads`

> You only need this section if you want to project typed instance data **out** as RDF quads, run reasoning or graph queries over it, and then **lift** the resulting quads back into typed JS objects. This is unique to json-tology - no other validator on the comparison list offers a symmetric ABox round-trip.

The same canonical graph used for validation drives both directions. `toQuads` lowers a typed value into ABox quads; `fromQuads` lifts quads back through `instantiate`, applying defaults, transforms, and validation on the way in.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used throughout these examples.

---

## Quad / SubjectGroup {#quad-shape}

A `Quad` is the atomic unit of RDF data produced and consumed by `toQuads` / `fromQuads`. Each quad is a plain object with four fields:

- `subject` — the IRI or blank-node identifier of the resource being described
- `predicate` — the property IRI
- `object` — the value (IRI, blank node, or typed literal)
- `graph` — the named-graph IRI, or the default graph when omitted

A `SubjectGroup` is a convenience wrapper that groups all quads sharing the same subject, making it easier to reconstruct a single typed object from a quad array. `fromQuads` uses subject groups internally when lifting quads back into typed JS values via [`instantiate`](/validation/instantiate).

---

## `jt.toQuads` {#jt-toquads}

**Declaration.** Projects instance data through the canonical graph and returns a fresh `OntologyBuilder` containing the projected ABox quads. The first argument is a schema object with `$id` (registers the schema if it is not already registered). The second argument is the typed value, normally the output of `instantiate()`. The return value can be serialized via `jsonLd()`, `jsonLdObject()`, or `raw()`.

**Use this when** you want to publish a validated value as Linked Data, push it into a triple store, hand it to an OWL or SHACL reasoner, or merge it into a knowledge graph that already contains the matching TBox.

**Don't use this when** you only need a wire-form payload (use [`dump`](/serialization/dump)). Don't use it as a generic "to JSON" helper - quads carry RDF semantics, not display formatting.

### Examples

#### Example 1: Project an order to ABox quads

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';

const order = entities.instantiate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      35.97,
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99 },
    { bookIsbn: '9780062316110', quantity: 1, unitPrice:  9.99 },
  ],
});

const quads = entities.toQuads(OrderSchema, order);

console.log(quads.length);  // count of RDF quads
console.log(quads[0]);      // { subject, predicate, object, graph }

// For richer output (JSON-LD, SHACL composition) pass the quads through
// the ontology builder:
const ontology = entities.ontology().addQuads(quads);
console.log(ontology.jsonLd());       // JSON-LD string
console.log(ontology.jsonLdObject()); // JSON-LD object
```

#### Example 2: Merge ABox with TBox in a single document

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';

const tbox = entities.toTbox();
const abox = entities.toQuads(OrderSchema, order);

const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...tbox.raw(),  // class and property declarations
    ...abox,        // individual assertions (Quad[])
  ],
};
```

### Subject minting with `iriFor`

The default minter assigns `<baseIRI>/instances/<classId>-<contentHash>` to every projected object. To override that, pass `iriFor` to `toQuads`:

```ts
import { Skolemize } from 'json-tology';

// Root-only override (depth 0 wins; nested objects fall through):
entities.toQuads(OrderSchema, order, {
  iriFor: 'https://shop.example.com/orders/A-1234'
});

// Anonymous blank-node subjects for every emitted object:
entities.toQuads(OrderSchema, order, { iriFor: 'blank-node' });

// Mint from a property of the value:
entities.toQuads(BookSchema, book, {
  iriFor: Skolemize.fromProperty('isbn', { baseIRI: 'https://books.example.com/isbn' })
});

// W3C RDF 1.1 §3.5 well-known genid pattern (reversible by deskolemize):
entities.toQuads(OrderSchema, order, {
  iriFor: Skolemize.wellKnownGenid('https://shop.example.com')
});

// Custom function. Receives { path, value, depth }; return undefined to fall through.
entities.toQuads(OrderSchema, order, {
  iriFor: (ctx) => ctx.depth === 0
    ? `https://shop.example.com/orders/${(ctx.value as { id: string }).id}`
    : undefined
});
```

See [skolemization](/advanced/skolemization) for the strategy reference.

### Graph IRI

Set the `graph` field on every emitted quad with `graphIRI`:

```ts
entities.toQuads(OrderSchema, order, {
  graphIRI: 'https://shop.example.com/graphs/2026-01'
});
```

Both options can be paired with registry-level defaults via `JsonTology.create({ iriFor, defaultGraphIRI })` — see [getting started](/getting-started#graph-emission).

## `jt.fromQuads` {#jt-fromquads}

**Declaration.** Inverse of `toQuads`. Given an array of quads and a target schema reference (`$id` string or schema object with `$id`), returns an array of validated typed objects. Each returned value runs through `instantiate`, so defaults are applied, transforms execute, and validation errors throw `InstantiationError`.

**Use this when** quads arrive from an external source - a triple store, a reasoner output, a federated query, an inbound RDF payload - and you want them as typed JS objects. The return is an array because a single subject set can contain multiple instances of the target class.

**Don't use this when** you already have JS objects in hand (use [`instantiate`](/validation/instantiate) directly). Don't use it on quads with no `rdf:type` or no recognizable predicates - lifting needs the property IRIs that match the target schema's graph.

#### Reversible skolemization

Pass `{ deskolemize: true }` to treat IRIs matching the W3C well-known genid pattern (`*/.well-known/genid/<hash>`) as blank nodes during reconstruction. This pairs with `Skolemize.wellKnownGenid` on `toQuads`:

```ts
const quads = entities.toQuads(OrderSchema, order, {
  iriFor: Skolemize.wellKnownGenid('https://shop.example.com')
});

const [restored] = entities.fromQuads(OrderSchema.$id, quads, { deskolemize: true });
```

The registry-level `defaultDeskolemize: true` flips this on for every `fromQuads` call without per-call overrides.

### Examples

#### Example 1: Round-trip an order

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';
import { strict as assert } from 'node:assert';

const original = entities.instantiate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      35.97,
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99 },
    { bookIsbn: '9780062316110', quantity: 1, unitPrice:  9.99 },
  ],
});

const quads = entities.toQuads(OrderSchema, original);
const [restored] = entities.fromQuads(OrderSchema.$id, quads);

assert.deepEqual(restored, original);
```

#### Example 2: Lift quads from a triple store

```ts
import { bookstoreEntities as entities, BookSchema } from './bookstore/index.js';

// quads from an external SPARQL CONSTRUCT or DESCRIBE
const quads = await fetchQuadsFromTripleStore('SELECT ... WHERE { ?b a :Book }');

// returns Book[] - validated, typed, defaults applied
const books = entities.fromQuads(BookSchema.$id, quads);

for (const book of books) {
  console.log(book.title, book.price);
}
```

## Static counterparts

Both methods have static counterparts on `JsonTology` for one-shot use without a long-lived registry. The static variants build an ephemeral registry containing only the supplied schema, run the operation, and discard the registry.

```ts
import { JsonTology } from 'json-tology';
import { OrderSchema } from './bookstore/index.js';

const quads = JsonTology.toQuads(OrderSchema, order);

const restored = JsonTology.fromQuads(OrderSchema, quads);
```

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

## Related

- [`toTbox`](/advanced/ontology#jt-totbox) - class and property declarations (TBox companion to ABox `toQuads`)
- [`toShacl`](/advanced/ontology#jt-toshacl) - structural shape constraints
- [`ontology`](/advanced/ontology#jt-ontology) - combined TBox + SHACL
- [`instantiate`](/validation/instantiate) - the validator that runs on each lifted object

## See also

- [Graph concepts](/advanced/graph-concepts) - canonical graph structure
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
