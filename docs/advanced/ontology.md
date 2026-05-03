# Ontology and Graphs

> You only need this section if you want to emit or consume **RDF/OWL/SHACL** output, perform graph-based reasoning, or round-trip data through an RDF store. If you are building a TypeScript application that validates and coerces data, the core guides (Schemas, Validation, Composition, Transforms) are all you need. The ontology features are fully tree-shakable — importing from `json-tology/ontology` does not increase the bundle of consumers who only import from `json-tology`, `json-tology/value`, or `json-tology/types`.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used throughout these examples. The same canonical graph used for validation is the source of truth for all ontology output — there is no second semantic model.

---

## `jt.ontology` {#jt-ontology}

**Declaration.** Returns an `OntologyBuilder` derived from all registered schemas. The result is cached — subsequent calls return the same builder until a new schema is registered. The `OntologyBuilder` exposes methods for JSON-LD, SHACL, raw quads, and the prefix context.

**Use this when** you need TBox output (class definitions, property declarations, domain/range assertions) from your schemas for use in an OWL reasoner, a semantic knowledge graph, or an API that consumes JSON-LD.

### Examples

#### Example 1: Generate OWL JSON-LD for all bookstore schemas

```ts
import { jt } from './bookstore/schemas.js';

const builder = jt.ontology();

// OWL JSON-LD string
console.log(builder.jsonLd());

// OWL JSON-LD as a JS object
const owl = builder.jsonLdObject();

// SHACL shapes JSON-LD
const shacl = builder.shaclObject();

// Prefix map
const ctx = builder.context();
console.log(ctx.owl); // 'http://www.w3.org/2002/07/owl#'
```

#### Example 2: OWL and SHACL from cross-referenced schemas

`CustomerSchema` has `addresses: [Address]` via `$ref`. The ontology output produces `rdfs:domain` and `rdfs:range` relations between the Customer class and the Address class.

```ts
import { JsonTology } from 'json-tology';
import { AddressSchema, CustomerSchema } from './bookstore/schemas.js';

const localJt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  prefixes: { bs: 'https://bookstore.example/' },
  schemas:  [AddressSchema, CustomerSchema] as const,
});

const owl    = localJt.ontology().jsonLdObject();
const shacl  = localJt.ontology().shaclObject();
```

---

## `jt.toQuads` {#jt-toquads}

**Declaration.** Projects instance data into RDF quads (ABox individuals) and returns an `OntologyBuilder` containing the projected nodes. Validates the data against the schema before projecting — throws `MaterializationError` if validation fails. Inverse of [`fromQuads`](#jt-fromquads).

**Use this when** you want to produce ABox (instance-level) RDF triples from validated domain objects — for storage in an RDF triplestore, for input to a reasoner, or for export as Linked Data.

### Examples

#### Example 1: Project a customer to ABox quads

```ts
import { JsonTology } from 'json-tology';
import { AddressSchema, CustomerSchema } from './bookstore/schemas.js';

const localJt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas:  [AddressSchema, CustomerSchema] as const,
});

const abox = localJt.toQuads(CustomerSchema, {
  id:        'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email:     'alice@bookstore.example',
  name:      'Alice Chen',
  addresses: [{ street: '12 Elm Lane', city: 'Bookham', postalCode: '94107' }],
});

const jsonLd = abox.jsonLdObject();
const raw    = abox.raw();  // raw quad nodes
```

#### Example 2: Combine TBox and ABox

```ts
const tbox = localJt.ontology();         // TBox — class/property definitions
const abox = localJt.toQuads(CustomerSchema, customerData); // ABox — individuals

// Merge for a complete JSON-LD document:
const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...tbox.raw(),
    ...abox.raw(),
  ],
};
```

---

## `jt.fromQuads` {#jt-fromquads}

**Declaration.** Lifts RDF quads back into typed JS objects. Inverse of `toQuads`. Given quads produced by `toQuads`, a reasoning engine, or any RDF source, recovers plain JS objects matching the target schema. Each returned object is validated through `coerce` to apply defaults, transforms, and type safety. Returns `Array<TMap[K]>`.

**Use this when** you have RDF quads from an external source (a triplestore query result, a reasoner output) and need to recover validated domain objects.

### Examples

#### Example 1: Round-trip a customer through quads

```ts
// Project to quads
const abox = localJt.toQuads(CustomerSchema, customerData);
const quads = abox.raw();

// Lift back to typed objects
const customers = localJt.fromQuads(CustomerSchema.$id, quads);
// customers: Customer[] — each element validated through coerce
console.log(customers[0].name); // 'Alice Chen'
```

---

## `jt.toSchema`

See [`jt.toSchema`](/serialization/toSchema) in the Serialization guide — it reconstructs a JSON Schema from the canonical graph and is useful for verifying round-trip fidelity, but is not specific to the RDF/ontology use case.

---

## Direct serializer access

For advanced use cases without the `JsonTology` facade, serializers are importable from `json-tology/ontology`:

```ts
import {
  GraphOntologySerializer,
  GraphShaclSerializer,
  GraphSchemaSerializer,
  OntologyBuilder,
} from 'json-tology/ontology';
import { SchemaRegistry } from 'json-tology/schema';

const registry = new SchemaRegistry();
registry.register(BookSchema);

const graphs = registry.listGraphs();

// OWL
const owlSerializer = new GraphOntologySerializer();
const owlNodes = owlSerializer.serialize(graphs);

const builder = new OntologyBuilder({
  baseIRI:      'https://bookstore.example',
  graphSources: [owlNodes],
  prefixes:     { bs: 'https://bookstore.example/' },
});
console.log(builder.jsonLd());

// SHACL
const shaclSerializer = new GraphShaclSerializer();
const shaclNodes = shaclSerializer.serialize(graphs);
builder.addShacl(shaclNodes);
console.log(JSON.stringify(builder.shaclObject(), null, 2));

// Reconstruct schema from a single graph
const schemaSerializer = new GraphSchemaSerializer();
const graph = registry.graph('https://bookstore.example/Book');
if (graph) {
  const schema = schemaSerializer.serialize(graph);
  console.log(schema);
}
```

## Custom prefixes and vocabulary plugins

```ts
import type { VocabularyPluginInterface } from 'json-tology/interfaces';

const myVocabulary: VocabularyPluginInterface = {
  prefixes: { myns: 'https://myorg.io/ns#' },
  extractRelations(node, semantics, graph) {
    return [];
  },
  project(relation, emit) {
    // Emit custom quads for non-core predicates
  },
};

const jt = JsonTology.create({
  baseIRI:     'https://bookstore.example',
  schemas:     [BookSchema] as const,
  vocabularies: [myVocabulary],
});
```

## Related

- [Bookstore domain](/bookstore-domain) — schemas used in examples
- [Schemas](/schemas) — schema registration
- [Serialization](/serialization/dump) — `dump` / `dumpJson` for non-RDF serialization

## See also

- [Architecture Plan](/architecture-plan) — internal design of the canonical graph
