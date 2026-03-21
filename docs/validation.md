# Validation

json-tology validates data against registered JSON Schemas via a compiled graph engine. All validation methods accept either a schema `$id` string or a schema object with `$id`.

## Simple

`validate()` returns error strings. `is()` returns a boolean type guard.

```ts
import { JsonTology } from 'json-tology';

const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'integer', minimum: 0 },
  },
  required: ['name', 'age'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [UserSchema] as const,
});

// validate() returns error strings, empty array if valid
const errors = jt.validate(UserSchema.$id, { name: 'Alice', age: 30 });
console.log(errors); // []

const bad = jt.validate(UserSchema.$id, { name: 42 });
console.log(bad); // ["/name: must be string", ...]

// is() returns a boolean type guard
if (jt.is(UserSchema.$id, data)) {
  // data is narrowed to { name: string; age: number }
  console.log(data.name);
}
```

## Typical

`coerce()` validates data, applies defaults, and strips unknown properties. It throws `CoercionError` on failure. `is()` narrows the type in conditional branches.

```ts
import { JsonTology, CoercionError } from 'json-tology';

const ConfigSchema = {
  $id: 'https://example.com/Config',
  type: 'object',
  properties: {
    host: { type: 'string', default: 'localhost' },
    port: { type: 'integer', default: 3000 },
    debug: { type: 'boolean', default: false },
  },
  required: ['host', 'port'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [ConfigSchema] as const,
});

// coerce() validates, applies defaults, strips unknown properties.
// Returns a typed value on success, throws CoercionError on failure.
const config = jt.coerce(ConfigSchema.$id, { port: 8080 });
// config = { host: 'localhost', port: 8080, debug: false }

try {
  jt.coerce(ConfigSchema.$id, { port: 'not-a-number' });
} catch (err) {
  if (err instanceof CoercionError) {
    console.log(err.message);         // joined error messages
    console.log(err.errors.length);   // number of validation errors
    console.log(err.errors.messages()); // ["root: ...", "/port: ..."]
  }
}

// is() as a type guard in conditionals
function handleInput(data: unknown) {
  if (jt.is(ConfigSchema.$id, data)) {
    // data is typed as { host: string; port: number; debug?: boolean }
    console.log(`Connecting to ${data.host}:${data.port}`);
  }
}
```

## Advanced

`validateAt()` validates data against a sub-schema at a JSON Pointer. `ValidationErrors` exposes `.path`, `.keyword`, `.message`, and `.params` on each error.

```ts
import { JsonTology } from 'json-tology';

const OrderSchema = {
  $id: 'https://example.com/Order',
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sku: { type: 'string', minLength: 1 },
          qty: { type: 'integer', minimum: 1 },
        },
        required: ['sku', 'qty'],
      },
      minItems: 1,
    },
    total: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['id', 'items', 'total'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [OrderSchema] as const,
});

// validateAt() targets a sub-schema by JSON Pointer
const nameErrors = jt.validateAt(
  OrderSchema.$id,
  '/properties/items/items',
  { sku: '', qty: 0 },
);
console.log(nameErrors);
// ["/sku: must NOT have fewer than 1 characters", "/qty: must be >= 1"]

// errors() returns a ValidationErrors collection
const errs = jt.errors(OrderSchema.$id, {
  id: 'bad-uuid',
  items: [],
  total: -5,
});

console.log(errs.ok);     // false
console.log(errs.length); // number of errors

// Iterate individual error objects
for (const err of errs) {
  console.log(err.path);    // e.g. "/id", "/items", "/total"
  console.log(err.keyword); // e.g. "format", "minItems", "exclusiveMinimum"
  console.log(err.message); // human-readable description
  console.log(err.params);  // keyword-specific parameters
}

// format() groups error messages by JSON Pointer path
const grouped = errs.format();
// { "/id": ["must match format \"uuid\""], "/items": ["..."], "/total": ["..."] }

// flatten() separates field-level and form-level errors
const { fieldErrors, formErrors } = errs.flatten();
// fieldErrors: { "/id": [...], "/items": [...] }
// formErrors: ["must have required property 'id'"]
```
