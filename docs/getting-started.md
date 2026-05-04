# Getting Started

json-tology is an ontology-native type system for TypeScript. Declare schemas once in JSON Schema, get TypeScript types, runtime validation, defaults, transforms, and serialization from one canonical graph.

## Install

```bash
npm install json-tology
```

## Define a schema

Schemas are plain JSON Schema objects with `$id` and `as const`. The bookstore domain used in all examples follows the one-file-per-concept pattern. See the [Bookstore Domain](/bookstore-domain) page for the full folder layout and all schemas.

Primitives are named, reusable schemas with a `urn:` IRI:

```ts
// entities/CustomerId.ts
import { CustomerIdSchema } from './entities/CustomerId.js';
export const CustomerIdSchema = {
  $id: 'urn:bookstore:CustomerId',
  type: 'string',
  format: 'uuid',
} as const;
```

Entities compose primitives via `$ref: SourceSchema.$id` — never bare string literals:

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

See [Validation](/validation/coerce) for `is()`, `errors()`, `validateAt()`, and the five error views.

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

See [Composition](/composition/extend) for `extend`, `omit`, `required`, `intersection`, and `discriminatedUnion`.

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

See [Serialization](/serialization/dump) for filtering options (`exclude`, `include`, `excludeDefaults`).

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
| Validation and coercion | [Validation](/validation/coerce) |
| Composing schemas | [Composition](/composition/extend) |
| Value operations | [Value Operations](/value/clone-hash) |
| Transforms and brands | [Transforms](/transforms/decode-encode) |
| Serialization | [Serialization](/serialization/dump) |
| Computed fields | [Computed Fields](/registry/computed) |
| Cross-field invariants | [Invariants](/registry/invariants) |
| RDF/OWL (advanced) | [Ontology and Graphs](/advanced/ontology) |

## All `JsonTology.create` options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `baseIRI` | `string` | _(required)_ | Base URI for the canonical graph and ontology output. |
| `schemas` | `readonly Schema[]` | `[]` | Schemas to register at construction. Order matters when using `$ref` — register referenced schemas before referencing schemas. |
| `prefixes` | `Record<string, string>` | `DEFAULT_PREFIXES` | Vocabulary prefix → IRI mappings, merged with built-in defaults. |
| `formats` | `Record<string, FormatValidatorFn>` | `{}` | Custom format validators. Keys are format names (`'isbn'`), values are `(value: unknown) => boolean`. |
| `enableTypeCast` | `boolean` | `false` | Enable string→number/boolean coercion at validation time. |
| `enableStrictTypes` | `boolean` | `false` | Reject implicit coercions globally. Per-field `jt:strict` overrides. Different from `enableStrictGraph`. |
| `enableDefaults` | `boolean` | `true` | Fill schema `default` values during `coerce`. Set `false` to validate without mutating missing fields. |
| `enableInlineWarnings` | `boolean` | `false` | Surface inline-object, inline-primitive, and inline-array-items warnings via `logger.warn` at registration. Implied by `enableStrictGraph`. See [graph-native authoring](/advanced/graph-native-authoring). |
| `enableDuplicateDetection` | `boolean` | `false` | Run `findDuplicates()` at registration and warn on structural duplicates. Implied by `enableStrictGraph`. |
| `enableStrictGraph` | `boolean` | `false` | Promote inline warnings and duplicate detection to `SchemaError` throws. Requires all sub-schemas to be standalone `$id` schemas or `$defs` entries. See [graph-native authoring](/advanced/graph-native-authoring#enablestrictgraph). |
| `keywords` | `KeywordDefinitionInterface[]` | `[]` | Custom keyword handlers for unrecognized JSON Schema vocabulary. |
| `vocabularies` | `VocabularyPluginInterface[]` | `[]` | Vocabulary plugins for custom RDF output (DCAT, FOAF, etc.). |
| `materializer` | `MaterializerInterface` | _(built-in)_ | Override the default materializer (rare). |
| `maxDepth` | `number` | _(no limit)_ | Maximum schema-graph traversal depth. Protects against pathological schemas. |
| `logger` | `LoggerInterface` | `SILENT_LOGGER` | Logger for warnings (`enableInlineWarnings`, `enableDuplicateDetection`). Must be set for warnings to surface. |
| `invariants` | `Record<string, InvariantInterface[]>` | `{}` | Cross-field invariant functions, keyed by schema `$id`. |
| `computeds` | `Record<string, Record<string, ComputedFnType>>` | `{}` | Computed-field functions, keyed by schema `$id` then property name. |
