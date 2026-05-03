# Getting Started

json-tology is an ontology-native type system for TypeScript. Declare schemas once in JSON Schema, get TypeScript types, runtime validation, defaults, transforms, and serialization from one canonical graph.

## Install

```bash
npm install json-tology
```

## Define a schema

Schemas are plain JSON Schema objects with `$id` and `as const`. The bookstore domain used in all examples starts here. See the [Bookstore Domain](/bookstore-domain) page for all six schemas defined in full.

```ts
const CustomerSchema = {
  $id: 'https://bookstore.example/Customer',
  type: 'object',
  properties: {
    id:    { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    name:  { type: 'string' },
  },
  required: ['id', 'email', 'name'],
} as const;
```

`as const` is required. Without it TypeScript widens every string literal and `InferType<T>` cannot produce the right type.

## Derive the TypeScript type

```ts
import type { InferType } from 'json-tology';

type Customer = InferType<typeof CustomerSchema>;
// {
//   readonly id: string & FormatBrand<'uuid'>;
//   readonly email: string & FormatBrand<'email'>;
//   readonly name: string;
// }
```

No code generation. No separate type declaration file. The type comes directly from the schema literal at compile time. See [Type Inference](/types) for how `$ref`, enums, brands, and cross-schema references work.

## Create an instance and register schemas

```ts
import { JsonTology } from 'json-tology';

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CustomerSchema] as const,
});
```

`JsonTology.create()` registers all schemas, compiles the validation graph, and builds the type map. Every method that accepts a schema `$id` returns typed results from that map.

## Validate

`validate()` returns error strings. An empty array means valid.

```ts
// Valid customer
const errors = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});
console.log(errors); // []

// Missing required field
const bad = jt.validate(CustomerSchema.$id, { email: 'alice@bookstore.example' });
console.log(bad); // ["root: must have required property 'id'", "root: must have required property 'name'"]
```

See [Validation](/validation) for `is()`, `errors()`, `validateAt()`, and the five error views.

## Coerce

`coerce()` validates, applies defaults, strips unknown properties, and returns a typed value. Throws `CoercionError` on failure.

```ts
import { CoercionError } from 'json-tology';

const AddressSchema = {
  $id: 'https://bookstore.example/Address',
  type: 'object',
  properties: {
    street:     { type: 'string' },
    city:       { type: 'string' },
    postalCode: { type: 'string' },
    country:    { type: 'string', default: 'US' },
  },
  required: ['street', 'city', 'postalCode'],
} as const;

const jt2 = jt.register(AddressSchema);

const address = jt2.coerce(AddressSchema.$id, {
  street:     '12 Elm Lane',
  city:       'Bookham',
  postalCode: '94107',
  extra:      'ignored',       // stripped
  // country omitted — default 'US' applied
});
// { street: '12 Elm Lane', city: 'Bookham', postalCode: '94107', country: 'US' }
```

## Compose schemas

`Compose` derives new schemas from existing ones. All composition runs at compile time and produces correct JSON Schema objects.

```ts
import { Compose } from 'json-tology';

// A PATCH-body schema where every field is optional
const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer',
);

// A read-only summary for list views
const CustomerSummarySchema = Compose.pick(
  CustomerSchema,
  ['id', 'name'] as const,
  'https://bookstore.example/CustomerSummary',
);
```

See [Composition](/composition) for `extend`, `omit`, `required`, `intersection`, and `discriminatedUnion`.

## Serialize back to wire form

`dump()` walks the validation graph and applies any registered `Transform` encoders. It is the Pydantic `model_dump()` equivalent.

```ts
const customer = jt.coerce(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

const wire = jt.dumpJson(CustomerSchema.$id, customer);
// '{"id":"c1a2b3d4-e5f6-7890-abcd-ef1234567890","email":"alice@bookstore.example","name":"Alice Chen","addresses":[]}'
```

See [Serialization](/dump) for filtering options (`exclude`, `include`, `excludeDefaults`).

## Sub-path imports

Import only what you need. Every sub-path is tree-shakable.

```ts
// Everything
import { JsonTology, Compose, Transform, Value } from 'json-tology';

// Value operations only (no validation graph or ontology)
import { Value, Hash, Changeset } from 'json-tology/value';

// Schema registry and format validators
import { SchemaRegistry, FormatRegistry } from 'json-tology/schema';

// Types and interfaces only (compile-time, no runtime cost)
import type { InferType } from 'json-tology/types';
import type { LoggerInterface } from 'json-tology/interfaces';
```

## What's in the box

| Feature | Method(s) |
|---------|-----------|
| Type inference | `InferType<T>`, `InferSchemaType<T, Root>` |
| Validation | `validate`, `is`, `errors`, `validateAt` |
| Coercion + defaults | `coerce` |
| Error views | `messages`, `format`, `flatten`, `aggregate`, `report` |
| Composition | `Compose.extend`, `pick`, `omit`, `partial`, `required`, `intersection`, `discriminatedUnion` |
| Value utilities | `Value.clone`, `hash`, `diff`, `value.cast`, `clean`, `convert`, `create` |
| Transforms | `Transform.create`, `brand`, `pipe`, `jt.encode` |
| Serialization | `dump`, `dumpJson` |
| Computed fields | `addComputed`, `removeComputed` |
| Cross-field invariants | `addInvariant`, `removeInvariant` |
| Materialization | `materialize` |
| RDF/Ontology _(advanced, opt-in)_ | `ontology`, `toQuads`, `fromQuads`, `toSchema` |

## Next steps

| Topic | Guide |
|-------|-------|
| The running example domain | [Bookstore Domain](/bookstore-domain) |
| Schemas and registration | [Schemas](/schemas) |
| TypeScript type inference | [Type Inference](/types) |
| Validation and coercion | [Validation](/validation) |
| Composing schemas | [Composition](/composition) |
| Value operations | [Value Operations](/value) |
| Transforms and brands | [Transforms](/transforms) |
| Serialization | [Serialization](/dump) |
| Computed fields | [Computed Fields](/computed) |
| Cross-field invariants | [Invariants](/invariants) |
| RDF/OWL (advanced) | [Ontology and Graphs](/ontology) |
