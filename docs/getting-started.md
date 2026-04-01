# Getting Started

json-tology is an ontology-native type system for TypeScript. Declare schemas once in JSON Schema, get types, validation, materialization, and ontology output from one canonical graph.

## Install

```bash
npm install json-tology
```

## Define a Schema

Schemas are plain JSON Schema objects with `$id` and `as const` for type inference.

```typescript
const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
    role:  { type: 'string', default: 'viewer' },
  },
  required: ['name', 'email'],
} as const;
```

## Create an Instance

```typescript
import { JsonTology, InferType } from 'json-tology';

type User = InferType<typeof UserSchema>;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [UserSchema] as const,
});
```

`JsonTology.create()` registers all schemas at construction and infers their types into a type map. Every method that accepts a schema ID returns typed results.

## Validate

```typescript
const errors = jt.validate(UserSchema.$id, { name: 'Alice', email: 'alice@co.io' });
// []

const bad = jt.validate(UserSchema.$id, { name: 42 });
// ['At /name: must be string']
```

## Coerce

`coerce()` validates, applies defaults, and strips unknown properties. Throws `CoercionError` on failure.

```typescript
const user = jt.coerce(UserSchema.$id, {
  name: 'Alice',
  email: 'alice@co.io',
  extra: true,
});
// { name: 'Alice', email: 'alice@co.io', role: 'viewer' }
// `extra` stripped, `role` filled from default
```

## Materialize

`materialize()` builds instances from partial data with schema defaults.

```typescript
const blank = jt.materialize(UserSchema, {});
// { role: 'viewer' }

const partial = jt.materialize(UserSchema, { name: 'Bob' });
// { name: 'Bob', role: 'viewer' }
```

## Value Operations

Value operations are available through `jt.value` or as static methods on `Value`.

```typescript
// Schema-aware (through facade)
const cleaned = jt.value.clean(UserSchema.$id, { name: 'Alice', email: 'a@b.co', unknown: true });
// { name: 'Alice', email: 'a@b.co' }

// Pure operations (no registry needed)
import { Value } from 'json-tology';

const copy = Value.clone(user);
const hash = Value.hash(user);
const changes = Value.diff(user, { ...user, role: 'admin' });
// changes.isEmpty === false, changes.length === 1
```

## Ontology

`ontology()` generates OWL and SHACL from the same graph used for validation.

```typescript
console.log(jt.ontology().jsonLd());      // OWL JSON-LD
console.log(jt.ontology().shaclObject()); // SHACL JSON-LD
```

## Imports

Import what you need from sub-path exports:

```typescript
// Everything
import { JsonTology, Value, SchemaRegistry, Curie } from 'json-tology';

// Just value operations (tree-shakes out validation, ontology, etc.)
import { Value, Hash, Changeset } from 'json-tology/value';

// Just schema management
import { SchemaRegistry, SchemaLoader, FormatRegistry } from 'json-tology/schema';

// Just ontology output
import { OntologyBuilder, GraphOntologySerializer } from 'json-tology/ontology';

// Visualization
import { HtmlRenderer, TypeStringEmitter, VizDataCollector } from 'json-tology/viz';

// Types and interfaces
import type { InferType, InferSchemaType } from 'json-tology/types';
import type { LoggerInterface, RegistryOptionsInterface, VocabularyPluginInterface } from 'json-tology/interfaces';
```

## End-to-end examples

Three runnable walkthroughs cover the full value chain using a shared access-control domain:

| Example | Focus |
|---------|-------|
| [`examples/e2e-types.ts`](../examples/e2e-types.ts) | Compile-time inference, branded IDs, transforms, composition |
| [`examples/e2e-validation.ts`](../examples/e2e-validation.ts) | Runtime pipeline: validate, coerce, value ops, sub-schema checks |
| [`examples/e2e-reasoning.ts`](../examples/e2e-reasoning.ts) | TBox/ABox → N3 → EYE reasoner → derived access decisions |

```bash
npm run build && tsx examples/e2e-types.ts
```

## Next Steps

| Topic | Guide |
|-------|-------|
| Validation and coercion | [validation.md](./validation.md) |
| Value operations | [value.md](./value.md) |
| Schema management | [schemas.md](./schemas.md) |
| Schema composition | [composition.md](./composition.md) |
| Transforms | [transforms.md](./transforms.md) |
| Materialization | [materialization.md](./materialization.md) |
| Ontology output | [ontology.md](./ontology.md) |
| Type inference | [types.md](./types.md) |
| Constraint brands | [constraint-brands.md](./constraint-brands.md) |
| CLI tool | [cli.md](./cli.md) |
