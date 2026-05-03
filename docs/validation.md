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

// aggregate() — compact rollup for logging and metrics
const rollup = errs.aggregate();
// { count: 3, paths: ["/id", "/items", "/total"], keywords: ["exclusiveMinimum", "format", "minItems"] }

// report() — RFC 7807 Problem Details payload for HTTP error responses
const problem = errs.report({ instance: '/orders/new' });
// {
//   type: 'https://json-tology.dev/problems/validation',
//   title: 'Validation failed',
//   status: 422,
//   detail: '3 validation errors',
//   instance: '/orders/new',
//   errors: [
//     { path: '/id', keyword: 'format', message: 'must match format "uuid"', params: { format: 'uuid' } },
//     ...
//   ]
// }
```

### Picking the right view

| Method | Returns | Use when |
|---|---|---|
| `messages()` | `string[]` — `"path: message"` per error | Quick console output, simple error display |
| `format()` | `Record<string, string[]>` grouped by path | Form field highlighting, client-side display |
| `flatten()` | `{ fieldErrors, formErrors }` | Zod-compatible form libraries, per-field UI |
| `aggregate()` | `{ count, paths, keywords }` | Structured logs, metrics labels, telemetry |
| `report()` | RFC 7807 `ProblemDetailsType` object | HTTP `422` error response bodies |

#### Logging and metrics — `aggregate()`

`aggregate()` returns a compact summary with deduplicated, sorted paths and keywords. Because it omits per-instance `params` values (which can be unbounded), it is safe to use as structured log fields or metric label values without risk of cardinality explosion.

```ts
import { JsonTology } from 'json-tology';

// Somewhere in a request handler or service:
const errs = jt.errors(OrderSchema.$id, body);

if (!errs.ok) {
  const rollup = errs.aggregate();

  logger.warn('validation failed', {
    count: rollup.count,
    keywords: rollup.keywords,
    paths: rollup.paths,
    schema: OrderSchema.$id,
  });

  // rollup.keywords and rollup.paths are bounded sets — safe as metric labels
  metrics.increment('validation.failure', {
    keywords: rollup.keywords.join(','),
    schema: 'Order',
  });
}
```

The payload is a plain object — no class instances, no functions — safe for `JSON.stringify`, message queues, and log files.

#### HTTP responses — `report()`

`report()` produces an [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807) Problem Details object. Attach it directly to a `422 Unprocessable Entity` response.

```ts
import { JsonTology } from 'json-tology';

// Express / Fastify / Hono — any framework that accepts a plain object body
app.post('/orders', (req, res) => {
  const errs = jt.errors(OrderSchema.$id, req.body);

  if (!errs.ok) {
    return res
      .status(422)
      .type('application/problem+json')
      .send(errs.report({ instance: req.url }));
  }

  // ... handle valid order
});
```

Example response body:

```json
{
  "type": "https://json-tology.dev/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "3 validation errors",
  "instance": "/orders",
  "errors": [
    { "path": "/id",    "keyword": "format",           "message": "must match format \"uuid\"",        "params": { "format": "uuid" } },
    { "path": "/items", "keyword": "minItems",          "message": "must NOT have fewer than 1 items", "params": { "limit": 1 } },
    { "path": "/total", "keyword": "exclusiveMinimum",  "message": "must be > 0",                     "params": { "limit": 0 } }
  ]
}
```

The payload is a plain JSON object — no class instances, no functions — safe for `JSON.stringify`, message queues, log aggregators, and files.

### Pattern Safety

The `pattern` keyword and `patternProperties` keys compile user-authored regular expressions
via `new RegExp()`. If schemas come from untrusted sources, malicious patterns with
catastrophic backtracking (e.g. `(a+)+b`) can cause CPU exhaustion.

**Mitigation:**
- Only register schemas from trusted sources
- Review regex patterns for exponential backtracking before registration
- Use anchored patterns (`^...$`) to limit match scope
- Consider validating patterns against a safe-regex library before schema registration

## Field Aliases (`jt:alias`)

A schema property may declare `jt:alias` to accept alternate input key names. During `coerce()`, if the canonical key is absent and an alias key is present on the input object, the value is copied to the canonical key and the alias key is removed. The canonical key always wins when both are supplied.

```ts
const OrderSchema = {
  $id: 'https://example.com/Order',
  type: 'object',
  properties: {
    orderId: { type: 'string', 'jt:alias': 'order_id' },
    lineItems: { type: 'array', 'jt:alias': ['line_items', 'items_legacy'] },
  },
} as const;

const jt = JsonTology.create({ baseIRI: 'https://example.com', schemas: [OrderSchema] as const });

jt.coerce(OrderSchema.$id, { order_id: 'ORD-1', line_items: [] });
// => { orderId: 'ORD-1', lineItems: [] }

jt.coerce(OrderSchema.$id, { orderId: 'ORD-1', lineItems: [] });
// => { orderId: 'ORD-1', lineItems: [] }  (canonical keys pass through unchanged)
```

Alias normalization is applied before required-property validation, so an alias satisfies a `required` constraint. Multi-alias form lists are tried in declaration order; the first matching alias wins.

