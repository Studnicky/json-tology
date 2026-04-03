# Ontology

json-tology generates OWL and SHACL ontologies from the same canonical graph used for validation. No separate semantic model -- ontology output is a serialization of the graph.

## API

**Via `JsonTology` facade:**

- `jt.ontology()` -- returns an `OntologyBuilder` from all registered schemas (cached)
- `jt.toQuads(schema, data)` -- projects instance data to RDF quads, returns an `OntologyBuilder`
- `jt.toSchema(schemaId)` -- reconstructs a JSON Schema document from the canonical graph

**`OntologyBuilder` methods:**

- `builder.jsonLd()` -- OWL JSON-LD as a string
- `builder.jsonLdObject()` -- OWL JSON-LD as a JS object
- `builder.shaclObject()` -- SHACL JSON-LD as a JS object
- `builder.context()` -- prefix-to-IRI map
- `builder.raw()` -- raw graph nodes array

**Direct serializers** (import from `'json-tology/ontology'`):

- `GraphOntologySerializer` -- serialize schema graphs to OWL JSON-LD nodes
- `GraphShaclSerializer` -- serialize schema graphs to SHACL JSON-LD nodes
- `GraphSchemaSerializer` -- reconstruct JSON Schema from a single schema graph

Serializer constructors accept optional `CurieInterface` and `VocabularyPluginInterface[]`:

```ts
import { Curie } from 'json-tology';
import { GraphOntologySerializer, GraphShaclSerializer } from 'json-tology/ontology';

const curie = new Curie({ ex: 'https://example.com/' });
const owlSerializer = new GraphOntologySerializer({ curie, vocabularies: [myPlugin] });
const shaclSerializer = new GraphShaclSerializer({ curie, vocabularies: [myPlugin] });
```

**CURIE expansion:**

All RDF projections emit full IRIs instead of CURIE shortcuts. The `Curie` class
(implementing `CurieInterface`) handles expansion and compaction:

```ts
import { Curie } from 'json-tology';

const curie = new Curie({ sh: 'http://www.w3.org/ns/shacl#' });
curie.expand('sh:property');  // 'http://www.w3.org/ns/shacl#property'
curie.compact('http://www.w3.org/ns/shacl#property');  // 'sh:property'
```

**Custom prefixes:**

```ts
JsonTology.create({
  baseIRI: 'https://example.com',
  prefixes: { ex: 'https://example.com/ns#' },
  schemas: [] as const,
});
```

Default prefixes include `owl`, `rdf`, `rdfs`, `xsd`, `sh`, `dct`, `dcat`, `foaf`,
`skos`, `dash`, `prov`, `vann`, `schema`.

**Vocabulary plugins:**

Extend ontology output with custom RDF vocabularies:

```ts
import type { VocabularyPluginInterface } from 'json-tology/interfaces';

const myVocabulary: VocabularyPluginInterface = {
  prefixes: {
    myns: 'https://myorg.io/ns#',
  },
  extractRelations(node, semantics, graph) {
    // Extract custom relations from schema extensions
    return [];
  },
  project(relation, emit) {
    // Emit custom quads for non-core predicates
  },
};

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [MySchema] as const,
  vocabularies: [myVocabulary],
});
```

Plugin prefixes are merged into the active `Curie` instance. `extractRelations` runs
after core relation extraction for each graph node. `project` emits quads for
relations with predicates outside the core set.

## Simple

`ontology()` generates OWL JSON-LD from all registered schemas.

```ts
import { JsonTology } from 'json-tology';

const PersonSchema = {
  $id: 'https://example.com/Person',
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
  },
  required: ['name'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [PersonSchema] as const,
});

const builder = jt.ontology();
console.log(builder.jsonLd());
// {
//   "@context": { ... },
//   "@graph": [ ... ],
//   "@id": "https://example.com/ontology/",
//   "@type": "owl:Ontology",
//   "rdfs:label": "Generated Ontology"
// }
```

## Typical

### OWL and SHACL together

`ontology()` generates both OWL and SHACL. Schemas with `$ref` produce `rdfs:domain` and `rdfs:range` relations.

```ts
import { JsonTology } from 'json-tology';

const DepartmentSchema = {
  $id: 'https://example.com/Department',
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
} as const;

const EmployeeSchema = {
  $id: 'https://example.com/Employee',
  type: 'object',
  properties: {
    name: { type: 'string' },
    department: { $ref: 'https://example.com/Department' },
  },
  required: ['name'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  prefixes: { ex: 'https://example.com/' },
  schemas: [DepartmentSchema, EmployeeSchema] as const,
});

const builder = jt.ontology();

// OWL output -- classes, object properties with domain/range
const owl = builder.jsonLdObject();
console.log(JSON.stringify(owl, null, 2));

// SHACL output -- node shapes with property constraints
const shacl = builder.shaclObject();
console.log(JSON.stringify(shacl, null, 2));

// Prefix map
console.log(builder.context());
// { ex: 'https://example.com/', owl: '...', rdfs: '...', ... }
```

### Custom prefixes

The `prefixes` option overrides or extends the default prefix map.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://myorg.io',
  prefixes: {
    org: 'https://myorg.io/ns#',
    schema: 'https://schema.org/',
  },
  schemas: [EmployeeSchema] as const,
});

const ctx = jt.ontology().context();
console.log(ctx.org);    // 'https://myorg.io/ns#'
console.log(ctx.schema); // 'https://schema.org/'
```

## Advanced

### ABox projection — objects to quads

`toQuads()` projects instance data into RDF quads (ABox individuals).

```ts
import { JsonTology } from 'json-tology';

const PersonSchema = {
  $id: 'https://example.com/Person',
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer' },
  },
  required: ['name'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [PersonSchema] as const,
});

const aboxBuilder = jt.toQuads(PersonSchema, { name: 'Alice', age: 30 });
const nodes = aboxBuilder.raw();
console.log(nodes);
// Individual nodes with rdf:type, property assertions

const jsonLd = aboxBuilder.jsonLdObject();
console.log(JSON.stringify(jsonLd, null, 2));
```

### ABox lifting — quads to objects

`fromQuads()` is the inverse of `toQuads()`. Given quads from ABox projection, a
reasoning engine, or any RDF source, it recovers validated JS objects matching
the target schema:

```ts
const aboxBuilder = jt.toQuads(PersonSchema, { name: 'Alice', age: 30 });
const quads = aboxBuilder.raw(); // QuadInterface[]

// Lift quads back to typed objects
const people = jt.fromQuads(PersonSchema.$id, quads);
// → [{ name: 'Alice', age: 30 }]
```

Each returned object passes through `coerce()` for defaults, transforms, and type safety.

### Schema roundtrip via toSchema

`toSchema()` reconstructs a JSON Schema from the canonical graph. This verifies that the graph preserves all schema semantics.

```ts
import { JsonTology } from 'json-tology';

const OrderSchema = {
  $id: 'https://example.com/Order',
  type: 'object',
  properties: {
    id: { type: 'string' },
    total: { type: 'number', minimum: 0 },
    items: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['id', 'total'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [OrderSchema] as const,
});

const reconstructed = jt.toSchema('https://example.com/Order');
console.log(JSON.stringify(reconstructed, null, 2));
// Matches the original schema structure
```

### Direct serializer use

Serializers work directly without the `JsonTology` facade, consuming schema graphs from a `SchemaRegistry`.

```ts
import {
  GraphOntologySerializer,
  GraphShaclSerializer,
  GraphSchemaSerializer,
  OntologyBuilder,
} from 'json-tology/ontology';
import { SchemaRegistry } from 'json-tology/schema';

const registry = new SchemaRegistry();
registry.register({
  $id: 'https://example.com/Thing',
  type: 'object',
  properties: { label: { type: 'string' } },
});

const graphs = registry.listGraphs();

// OWL
const owlSerializer = new GraphOntologySerializer();
const owlNodes = owlSerializer.serialize(graphs);

const builder = new OntologyBuilder({
  baseIRI: 'https://example.com',
  graphSources: [owlNodes],
  prefixes: { ex: 'https://example.com/' },
});
console.log(builder.jsonLd());

// SHACL
const shaclSerializer = new GraphShaclSerializer();
const shaclNodes = shaclSerializer.serialize(graphs);
builder.addShacl(shaclNodes);
console.log(JSON.stringify(builder.shaclObject(), null, 2));

// Reconstruct schema from a single graph
const schemaSerializer = new GraphSchemaSerializer();
const graph = registry.graph('https://example.com/Thing');
if (graph) {
  const schema = schemaSerializer.serialize(graph);
  console.log(schema);
}
```
