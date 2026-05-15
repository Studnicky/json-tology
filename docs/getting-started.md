# Getting Started

json-tology is an ontology-native type system for TypeScript. Declare schemas once in JSON Schema, get TypeScript types, runtime validation, defaults, transforms, and serialization from one canonical graph.

## Install

```bash
npm install json-tology
```

Requires Node.js `>=24.0.0`.

Supported dialect: JSON Schema draft 2020-12 (`https://json-schema.org/draft/2020-12/schema`).

Upgrading from 0.3.x? See [Migration to 0.4.0](/migration-0.4.0) for the breaking changes.

## Define a schema

Schemas are plain JSON Schema objects with `$id` and `as const`. They are interoperable with the wider JSON Schema ecosystem - for example, [sourcemeta/jsonschema](https://github.com/sourcemeta/jsonschema) will lint, bundle, and format the same files. The bookstore domain used in all examples follows the one-file-per-concept pattern. See the [Bookstore Domain](/bookstore-domain) page for the full folder layout and all schemas.

Primitives are named, reusable schemas with a `urn:` IRI:

```ts
// entities/CustomerId.ts
export const CustomerIdSchema = {
  $id: 'urn:bookstore:CustomerId',
  type: 'string',
  format: 'uuid',
} as const;
```

Entities compose primitives via `$ref: SourceSchema.$id` - never bare string literals:

```ts
// entities/Customer.ts
import { CustomerIdSchema } from './CustomerId.js';
import { EmailSchema } from './Email.js';
import { PersonNameSchema } from './PersonName.js';

const CustomerSchema = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:    { $ref: CustomerIdSchema.$id },
    email: { $ref: EmailSchema.$id },
    name:  { $ref: PersonNameSchema.$id },
  },
  required: ['id', 'email', 'name'],
} as const;
```

`as const` is required. Without it TypeScript widens every string literal and `InferType<T>` cannot produce the right type.

## Derive the TypeScript type

```ts
import type { InferType } from 'json-tology/types';

type Customer = InferType<typeof CustomerSchema>;
// {
//   readonly id: string & FormatBrand<'uuid'>;
//   readonly email: string & FormatBrand<'email'>;
//   readonly name: string;
// }
```

No code generation. No separate type declaration file. The type comes directly from the schema literal at compile time.

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

`validate()` returns a `ValidationErrors` collection. An empty collection (`errs.ok === true`) means valid.

```ts
// Valid customer
const errs = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});
console.log(errs.ok); // true

// Missing required field
const bad = jt.validate(CustomerSchema.$id, { email: 'alice@bookstore.example' });
console.log(bad.length); // 2
for (const err of bad) {
  console.log(err.path, err.keyword, err.message);
}
```

See [Validation](/validation/instantiate) for `is()`, `validate()`, `subschemaAt()`, and the structured error views.

## Instantiate

`instantiate()` validates, applies defaults, strips unknown properties, and returns a typed value. Throws `InstantiationError` on failure.

```ts
import { InstantiationError } from 'json-tology';

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

const jt2 = jt.set(AddressSchema);

const address = jt2.instantiate(AddressSchema.$id, {
  street:     '12 Elm Lane',
  city:       'Bookham',
  postalCode: '94107',
  extra:      'ignored',       // stripped
  // country omitted  - default 'US' applied
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

The full set of combinators (`extend`, `omit`, `required`, `intersection`, `discriminatedUnion`) is covered in [Composition](/composition/extend).

## Serialize back to wire form

`dump()` walks the validation graph and applies any registered `Transform` encoders. It is the Pydantic `model_dump()` equivalent.

```ts
const customer = jt.instantiate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});

const wire = jt.dumpJson(CustomerSchema.$id, customer);
// '{"id":"c1a2b3d4-e5f6-7890-abcd-ef1234567890","email":"alice@bookstore.example","name":"Alice Chen","addresses":[]}'
```

Filtering options (`exclude`, `include`, `excludeDefaults`) are documented in [Serialization](/serialization/dump).

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

| Feature | Method(s) | Mode |
|---------|-----------|------|
| Type inference | `InferType<T>`, `InferSchemaType<T, Root>` | <Badge type="info" text="Compile-time" /> |
| Validation | `validate`, `is`, `subschemaAt` | <Badge type="tip" text="Runtime" /> |
| Coercion + defaults | `instantiate` | <Badge type="warning" text="Compile-time + Runtime" /> |
| Error views | `aggregate`, `report` | <Badge type="tip" text="Runtime" /> |
| Composition | `Compose.extend`, `pick`, `omit`, `partial`, `required`, `intersection`, `equivalent`, `discriminatedUnion` | <Badge type="warning" text="Compile-time + Runtime" /> |
| Value utilities | `Operations.clone`, `Hash.value`, `Value.diff`, `Operations.patch`, `value.cast`, `clean`, `convert`, `create` | <Badge type="tip" text="Runtime" /> |
| Transforms | `Transform.create`, `brand`, `pipe`, `jt.encode` | <Badge type="warning" text="Compile-time + Runtime" /> |
| Serialization | `dump`, `dumpJson` | <Badge type="tip" text="Runtime" /> |
| Computed fields | `addComputed`, `removeComputed` | <Badge type="tip" text="Runtime" /> |
| Cross-field invariants | `addInvariant`, `removeInvariant` | <Badge type="tip" text="Runtime" /> |
| Materialization | `materialize` | <Badge type="warning" text="Compile-time + Runtime" /> |
| RDF/Ontology _(advanced, opt-in)_ | `ontology`, `toQuads`, `fromQuads`, `toSchema` | <Badge type="tip" text="Runtime" /> |

## Configuring `JsonTology.create`

The full option reference lives at [Static helpers](/static-helpers#jsontology-create-options). Briefly, you supply `baseIRI` (string), `schemas` (array `as const`), and optional dialect / format-registry / strict / coercion controls.

## Next steps

| Topic | Guide |
|-------|-------|
| The running example domain | [Bookstore Domain](/bookstore-domain) |
| TypeScript type inference | [Type Inference](/types/infer) |
| Validation and instantiation | [Validation](/validation/instantiate) |
| Composing schemas | [Composition](/composition/extend) |
| Serialization | [Serialization](/serialization/dump) |
| Static helpers and create options | [Static helpers](/static-helpers) |
