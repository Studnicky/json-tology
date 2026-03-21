# Materialization

Materialization builds fully-populated instances from schemas by applying defaults and filling implicit properties. ABox projection converts validated instances into RDF quads for ontology serialization.

## Simple

`materialize()` populates an empty object with all schema defaults.

```ts
import { JsonTology, type InferType } from 'json-tology';

const ConfigSchema = {
  $id: 'https://app.io/Config',
  type: 'object',
  properties: {
    theme:    { type: 'string', default: 'dark' },
    locale:   { type: 'string', default: 'en-US' },
    pageSize: { type: 'integer', default: 25 },
    debug:    { type: 'boolean', default: false },
  },
  required: ['theme', 'locale', 'pageSize', 'debug'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://app.io',
  schemas: [ConfigSchema] as const,
});

type Config = InferType<typeof ConfigSchema>;

// Materialize with no partial input — all defaults applied
const config = jt.materialize(ConfigSchema);
console.log(config);
// => { theme: 'dark', locale: 'en-US', pageSize: 25, debug: false }
```

## Typical

`materialize()` fills gaps in partial input with schema defaults. Unlike `value.create()`, which synthesizes zero values for required properties that lack defaults, `materialize()` validates the partial and merges with declared defaults.

```ts
import { JsonTology, type InferType } from 'json-tology';

const UserSchema = {
  $id: 'https://app.io/User',
  type: 'object',
  properties: {
    name:    { type: 'string' },
    email:   { type: 'string', format: 'email' },
    role:    { type: 'string', default: 'viewer' },
    active:  { type: 'boolean', default: true },
  },
  required: ['name', 'email', 'role', 'active'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://app.io',
  schemas: [UserSchema] as const,
});

type User = InferType<typeof UserSchema>;

// materialize — merge partial data with schema defaults
const user = jt.materialize(UserSchema, {
  name: 'Alice',
  email: 'alice@example.com',
});
console.log(user);
// => { name: 'Alice', email: 'alice@example.com', role: 'viewer', active: true }

// value.create — synthesize zero-value defaults for ALL required properties
// Properties with explicit defaults get those defaults.
// Properties without defaults get zero values ('' for string, 0 for number, false for boolean).
const blank = jt.value.create(UserSchema.$id);
console.log(blank);
// => { name: '', email: '', role: 'viewer', active: true }

// Key difference:
// - materialize(schema, partial) validates the partial and merges with defaults
// - value.create(schemaId) builds a zero-value skeleton without validation input
```

## Advanced

`toQuads()` validates data against a schema and projects it into RDF quads, returning an `OntologyBuilder` for JSON-LD output. Schemas with `$ref` relationships produce linked ABox nodes.

```ts
import { JsonTology, type InferType } from 'json-tology';

const AddressSchema = {
  $id: 'https://app.io/Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city:   { type: 'string' },
    zip:    { type: 'string' },
  },
  required: ['street', 'city', 'zip'],
} as const;

const PersonSchema = {
  $id: 'https://app.io/Person',
  type: 'object',
  properties: {
    name:    { type: 'string' },
    age:     { type: 'integer' },
    address: { $ref: 'https://app.io/Address' },
  },
  required: ['name'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://app.io',
  schemas: [AddressSchema, PersonSchema] as const,
});

// ABox projection — validate data, project to RDF, get JSON-LD
const personData = {
  name: 'Alice',
  age: 30,
  address: {
    street: '123 Main St',
    city: 'Springfield',
    zip: '62701',
  },
};

const abox = jt.toQuads(PersonSchema, personData);
const jsonLd = abox.jsonLdObject();
console.log(JSON.stringify(jsonLd, null, 2));
// {
//   "@context": { ... prefixes ... },
//   "@graph": [
//     ... ABox individuals for Person and nested Address ...
//   ],
//   "@id": "https://app.io/ontology/",
//   "@type": "owl:Ontology",
//   "rdfs:label": "Generated Ontology"
// }

// Multiple schemas projected to ABox independently
const OrderSchema = {
  $id: 'https://app.io/Order',
  type: 'object',
  properties: {
    orderId:  { type: 'string' },
    total:    { type: 'number' },
    customer: { $ref: 'https://app.io/Person' },
  },
  required: ['orderId', 'total'],
} as const;

jt.register(OrderSchema);

const orderData = {
  orderId: 'ORD-001',
  total: 99.50,
  customer: {
    name: 'Bob',
    address: {
      street: '456 Oak Ave',
      city: 'Shelbyville',
      zip: '62702',
    },
  },
};

const orderAbox = jt.toQuads(OrderSchema, orderData);
const orderJsonLd = orderAbox.jsonLd(); // JSON string
console.log(orderJsonLd);

// Combine TBox ontology with ABox data
const tbox = jt.ontology();
const tboxJsonLd = tbox.jsonLdObject();
console.log(tboxJsonLd);
// TBox contains class definitions (owl:Class) and property shapes
// ABox contains individual instances projected from validated data
```
