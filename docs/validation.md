# Validation

> This guide covers `validate`, `is`, `errors`, `coerce`, `validateAt`, and the `ValidationErrors` views (`messages`, `format`, `flatten`, `aggregate`, `report`). All examples use the [bookstore domain](/bookstore-domain). See [Type Inference](/types) for how `InferType` works.

json-tology validates data against registered JSON Schemas via a compiled graph engine. All validation methods accept either a schema `$id` string or a schema object with `$id`.

---

## validate

Returns error messages as plain strings. Empty array means valid.

### Signature

```ts
public validate<K extends keyof TMap & string>(schemaId: K, data: unknown): string[]
```

### When to use

Use `validate` when you want a quick list of human-readable error messages for display or logging, and you don't need the full `ValidationErrors` collection. Use `errors()` when you need structured error data (paths, keywords, params). Use `is()` when you only need a boolean type guard.

### Examples

#### Example 1: Valid data returns empty array

```ts
import { JsonTology } from 'json-tology';

// jt is pre-built with all bookstore schemas (see /bookstore-domain)
const messages = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Chen',
});
console.log(messages); // []
```

#### Example 2: Missing required fields

```ts
const messages = jt.validate(CustomerSchema.$id, {
  email: 'alice@bookstore.example',
  // id and name are missing
});
console.log(messages);
// ["root: must have required property 'id'", "root: must have required property 'name'"]
```

#### Example 3: Nested schema validation

`Order` contains an array of `OrderLine` via `$ref`. Nested errors include the JSON Pointer path.

```ts
const messages = jt.validate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      -5,       // must be > 0
  items: [
    { bookIsbn: '9780140449136', quantity: 0, unitPrice: 12.99 }, // quantity < 1
  ],
});
console.log(messages);
// ["/total: must be > 0", "/items/0/quantity: must be >= 1"]
```

### Comparison

::: code-group

```ts [json-tology]
const errors = jt.validate(CustomerSchema.$id, data);
// string[] — empty if valid
```

```ts [Zod]
const result = CustomerSchema.safeParse(data);
if (!result.success) {
  const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
}
```

```ts [TypeBox]
import Ajv from 'ajv';
const ajv = new Ajv();
const validate = ajv.compile(CustomerSchema);
if (!validate(data)) {
  const messages = validate.errors?.map(e => `${e.instancePath}: ${e.message}`) ?? [];
}
```

```ts [AJV]
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv();
addFormats(ajv);
const valid = ajv.validate(customerSchema, data);
if (!valid) {
  const messages = ajv.errors?.map(e => `${e.instancePath}: ${e.message}`) ?? [];
}
```

```py [Pydantic]
from pydantic import ValidationError

try:
    customer = Customer(**data)
except ValidationError as e:
    messages = [f"{err['loc']}: {err['msg']}" for err in e.errors()]
```

:::

### Related

- `errors` — structured `ValidationErrors` with path/keyword/params
- `is` — boolean type guard
- `coerce` — validate + apply defaults + strip unknowns

---

## is

Type guard that returns `true` if data satisfies the schema. Narrows the TypeScript type in conditional branches.

### Signature

```ts
public is<K extends keyof TMap & string>(schemaId: K, data: unknown): data is TMap[K]
```

### When to use

Use `is` when you need a boolean answer and want TypeScript to narrow the type inside the `if` block. Use `validate` when you need the error strings. Use `errors` when you need the full structured error collection.

### Examples

#### Example 1: Type narrowing in a conditional

```ts
function describeCustomer(data: unknown): string {
  if (jt.is(CustomerSchema.$id, data)) {
    // data is narrowed to Customer here
    return `${data.name} <${data.email}>`;
  }
  return 'unknown';
}
```

#### Example 2: Filtering an array of unknowns

```ts
const mixed: unknown[] = fetchFromApi();
const customers = mixed.filter(
  (item): item is Customer => jt.is(CustomerSchema.$id, item)
);
// customers is Customer[]
```

#### Example 3: Invariants apply to `is`

If the `Order` schema has an invariant that `total` must equal `sum(items[].unitPrice * quantity)`, `is` returns `false` when the invariant fails.

```ts
const order = {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      99.00,       // wrong — items sum to 12.99
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 12.99 }],
};
console.log(jt.is(OrderSchema.$id, order)); // false (if invariant is registered)
```

See [Invariants](/invariants) for how to register cross-field rules.

### Comparison

::: code-group

```ts [json-tology]
if (jt.is(CustomerSchema.$id, data)) {
  data.name; // typed as string
}
```

```ts [Zod]
if (CustomerSchema.safeParse(data).success) {
  // data is not narrowed automatically — need a type predicate wrapper
}
// Or: CustomerSchema.safeParse(data).data gives the parsed (typed) value
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
import { TypeCompiler } from '@sinclair/typebox/compiler';

const C = TypeCompiler.Compile(CustomerSchema);
if (C.Check(data)) {
  data; // narrowed to Customer
}
```

```ts [AJV]
// ajv.validate returns boolean but does not narrow the TypeScript type.
// A type predicate wrapper is needed:
function isCustomer(data: unknown): data is Customer {
  return ajv.validate('Customer', data) as boolean;
}
```

```py [Pydantic]
# Python uses try/except rather than a boolean type guard.
try:
    customer = Customer.model_validate(data)
    # customer is typed as Customer
except ValidationError:
    pass
```

:::

### Related

- `validate` — returns error strings
- `errors` — returns structured `ValidationErrors`
- `coerce` — validate + mutate + return typed value

---

## errors

Returns a `ValidationErrors` collection. Empty (`.ok === true`) when data is valid.

### Signature

```ts
public errors<K extends keyof TMap & string>(schemaId: K, data: unknown): ValidationErrors
```

### When to use

Use `errors` when you need structured access to error data — paths, keywords, params — rather than just strings. `ValidationErrors` has five views: `messages`, `format`, `flatten`, `aggregate`, `report`. All five are covered below.

### Examples

#### Example 1: Check validity and iterate errors

```ts
const errs = jt.errors(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      -5,
  items:      [],       // minItems: 1 violated
});

console.log(errs.ok);      // false
console.log(errs.length);  // 2

for (const err of errs) {
  console.log(err.path);    // '/total', '/items'
  console.log(err.keyword); // 'exclusiveMinimum', 'minItems'
  console.log(err.message); // human-readable description
  console.log(err.params);  // { limit: 0 }, { limit: 1 }
}
```

#### Example 2: Valid data returns empty collection

```ts
const errs = jt.errors(BookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
});
console.log(errs.ok);     // true
console.log(errs.length); // 0
```

### Comparison

::: code-group

```ts [json-tology]
const errs = jt.errors(OrderSchema.$id, data);
// ValidationErrors — .ok, .length, .messages(), .format(), etc.
```

```ts [Zod]
const result = OrderSchema.safeParse(data);
if (!result.success) {
  result.error.issues; // ZodIssue[] — path, code, message per issue
}
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
const errors = [...Value.Errors(OrderSchema, data)];
// ValueError[] — path, message, schema, value per error
```

```ts [AJV]
ajv.validate(orderSchema, data);
const errors = ajv.errors; // ErrorObject[] | null
```

```py [Pydantic]
try:
    Order(**data)
except ValidationError as e:
    e.errors()  # List[ErrorDetails] — loc, msg, type per error
```

:::

### Related

- `messages` / `format` / `flatten` / `aggregate` / `report` — views on `ValidationErrors`
- `validate` — just the string array
- `coerce` — throw `CoercionError` with the same `ValidationErrors` on failure

---

## coerce

Validates data, applies `default` values, strips unknown properties, runs `Transform` decoders, and returns a fully typed value. Throws `CoercionError` on failure.

### Signature

```ts
public coerce<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K]
```

### When to use

Use `coerce` at the entry point to your application — API request handlers, CLI argument parsing, message queue consumers — anywhere untrusted data enters and must become a typed domain object. Unlike `validate()` which only checks, `coerce()` mutates a deep clone of the input, fills defaults, strips extras, and returns a clean typed value. Throws on failure so you don't silently continue with invalid data.

### Examples

#### Example 1: Coerce a customer from form input

Defaults (`addresses: []`) are filled. Unknown properties are stripped. The returned type is `Customer`.

```ts
import { JsonTology, CoercionError } from 'json-tology';

const customer = jt.coerce(CustomerSchema.$id, {
  id:           'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email:        'alice@bookstore.example',
  name:         'Alice Chen',
  internalFlag: true,   // stripped — not in schema
  // addresses omitted — filled with default []
});
// { id: '...', email: '...', name: 'Alice Chen', addresses: [] }
```

#### Example 2: Error handling with CoercionError

```ts
try {
  jt.coerce(CustomerSchema.$id, { email: 'not-an-email', name: 42 });
} catch (err) {
  if (err instanceof CoercionError) {
    console.log(err.message);             // joined error messages
    console.log(err.errors.length);       // number of ValidationError items
    console.log(err.errors.messages());   // ["root: must have required property 'id'", ...]
    console.log(err.errors.format());     // grouped by path
  }
}
```

#### Example 3: Coerce a nested schema with $ref

`OrderLineSchema` items inside `OrderSchema` are each coerced independently through the graph engine.

```ts
const order = jt.coerce(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      27.98,
  items: [
    { bookIsbn: '9780140449136', quantity: 2, unitPrice: 12.99 },
    { bookIsbn: '9780062316110', quantity: 1, unitPrice:  1.00, extra: 'gone' },
  ],
  unexpectedField: 'stripped',
});
// order is typed as Order
// order.currency === 'USD'  (default applied)
// order.items[1].extra is gone (stripped)
```

#### Example 4: Coerce with Transform decoder

If a schema has a `Transform` decoder registered (see [Transforms](/transforms)), `coerce` automatically applies the decode function after validation.

```ts
import { Transform } from 'json-tology';

const PlacedAtSchema = Transform.create(
  { $id: 'https://bookstore.example/PlacedAt', type: 'string', format: 'date-time' } as const,
  {
    decode: (s: string) => new Date(s),
    encode: (d: Date) => d.toISOString(),
  },
);

const jt2 = jt.register(PlacedAtSchema);
const date = jt2.coerce(PlacedAtSchema.$id, '2026-01-15T10:30:00Z');
console.log(date instanceof Date); // true
```

### Comparison

::: code-group

```ts [json-tology]
const customer = jt.coerce(CustomerSchema.$id, rawData);
// throws CoercionError on failure
// typed as Customer
// defaults applied, unknowns stripped
```

```ts [Zod]
const customer = CustomerSchema.parse(rawData);
// throws ZodError on failure
// typed as Customer
// no automatic defaults unless .default() was declared
// unknown keys stripped with .strict() or .strip() mode
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
// TypeBox Value.Decode() applies defaults and cleans unknown keys:
const customer = Value.Decode(CustomerSchema, Value.Default(CustomerSchema, rawData));
// Manual two-step; throws on failure with no CoercionError type
```

```ts [AJV]
// AJV validates + applies defaults (with useDefaults: true option)
// but does not strip unknowns automatically or throw typed errors.
const ajv = new Ajv({ useDefaults: true, removeAdditional: true });
const valid = ajv.validate(customerSchema, rawData);
if (!valid) throw new Error(ajv.errorsText());
// rawData is mutated in place — no typed return value
```

```py [Pydantic]
# model_validate is Pydantic's coerce equivalent
customer = Customer.model_validate(raw_data)
# raises ValidationError on failure
# typed as Customer
# defaults applied, extra fields ignored (by default) or forbidden with extra='forbid'
```

:::

### Related

- `validate` — validation without mutation
- `errors` — structured error collection
- `materialize` — build instances from partial data with defaults
- [Transforms](/transforms) — decode/encode pipelines applied by `coerce`
- [Invariants](/invariants) — cross-field rules that also run during `coerce`

---

## validateAt

Validates data against a sub-schema identified by a JSON Pointer within a registered schema.

### Signature

```ts
public validateAt<K extends keyof TMap & string>(
  schemaId: K,
  pointer: string,
  data: unknown
): string[]
```

### When to use

Use `validateAt` to validate partial data against one field's sub-schema — for example, validating a single form field on blur without running the full schema. The JSON Pointer syntax is `'/properties/fieldName'` or `'/properties/fieldName/items'` for arrays.

### Examples

#### Example 1: Validate a single Book field

```ts
const errors = jt.validateAt(
  BookSchema.$id,
  '/properties/isbn',
  '978014044913',   // 12 digits — pattern requires exactly 13
);
console.log(errors);
// ['/isbn: must match pattern "^\\d{13}$"']
```

#### Example 2: Validate an array item sub-schema

```ts
const errors = jt.validateAt(
  OrderSchema.$id,
  '/properties/items/items',
  { bookIsbn: '9780140449136', quantity: 0, unitPrice: 12.99 },
);
console.log(errors);
// ['/quantity: must be >= 1']
```

### Comparison

::: code-group

```ts [json-tology]
jt.validateAt(OrderSchema.$id, '/properties/items/items', data);
// validates data against the OrderLine sub-schema at that pointer
```

```ts [Zod]
// Zod doesn't directly support JSON Pointer sub-schema validation.
// Access nested schema via .shape:
OrderSchema.shape.items.element.parse(data);
// Items schema must be defined as a named variable for this to work.
```

```ts [TypeBox]
// Not directly supported via JSON Pointer.
// Access sub-schema manually and compile separately.
const itemSchema = OrderSchema.properties.items.items;
ajv.validate(itemSchema, data);
```

```ts [AJV]
// AJV supports JSON Schema's $ref internally but not arbitrary JSON Pointer
// sub-schema extraction without manual traversal.
// Not directly supported.
```

```py [Pydantic]
# Pydantic validates at the model level only.
# Sub-field validation uses field validators:
from pydantic import field_validator

class OrderLine(BaseModel):
    quantity: int

    @field_validator('quantity')
    def check_qty(cls, v):
        if v < 1:
            raise ValueError('must be >= 1')
        return v
```

:::

### Related

- `validate` — full schema validation
- `errors` — structured error collection from full validation

---

## Error views on ValidationErrors {#error-views}

`ValidationErrors` has five methods for accessing the same error data in different formats. Choose the one that matches where you're sending the data.

### messages

Returns `string[]` — one `"path: message"` string per error.

#### Signature

```ts
public messages(): string[]
```

#### When to use

Quick console output, simple error display, logging with a `join('\n')`. All the information is in the string already.

#### Example

```ts
const errs = jt.errors(ReviewSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  bookIsbn:   '9780140449136',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  rating:     6,        // max is 5
  body:       'short',  // minLength: 10
  postedAt:   '2026-01-15T10:30:00Z',
});

console.log(errs.messages());
// ["/rating: must be <= 5", "/body: must NOT have fewer than 10 characters"]
```

### format

Groups error messages by JSON Pointer path. Root-level errors are keyed as `"_root"`.

#### Signature

```ts
public format(): Record<string, string[]>
```

#### When to use

Form field highlighting — map each path to the corresponding input element and display the messages beside it.

#### Example

```ts
const grouped = errs.format();
// {
//   '/rating': ['must be <= 5'],
//   '/body':   ['must NOT have fewer than 10 characters'],
// }

// Display alongside a form field:
Object.entries(grouped).forEach(([path, msgs]) => {
  const fieldName = path.slice(1); // '/rating' → 'rating'
  console.log(`Field '${fieldName}': ${msgs.join(', ')}`);
});
```

### flatten

Separates errors into `fieldErrors` (keyed by path) and `formErrors` (no path).

#### Signature

```ts
public flatten(): { fieldErrors: Record<string, string[]>; formErrors: string[] }
```

#### When to use

When integrating with form libraries that expect a Zod-compatible error shape — `{ fieldErrors, formErrors }` matches the convention established by `zod-form-data` and similar adapters.

#### Example

```ts
const { fieldErrors, formErrors } = errs.flatten();
// fieldErrors: { '/rating': ['must be <= 5'], '/body': ['...'] }
// formErrors:  []  (would contain root-level errors like missing required props)

// Zod-compatible form library integration:
setFormErrors(fieldErrors);
if (formErrors.length > 0) showBanner(formErrors.join(', '));
```

::: code-group

```ts [json-tology]
const { fieldErrors, formErrors } = jt.errors(ReviewSchema.$id, data).flatten();
```

```ts [Zod]
const result = ReviewSchema.safeParse(data);
if (!result.success) {
  const { fieldErrors, formErrors } = result.error.flatten();
}
```

```ts [TypeBox]
// Not directly supported — TypeBox Value.Errors returns an iterator of ValueError.
// Manual grouping required.
```

```ts [AJV]
// Not directly supported — AJV errors must be grouped manually.
```

```py [Pydantic]
try:
    Review(**data)
except ValidationError as e:
    field_errors = {str(err['loc']): [err['msg']] for err in e.errors()}
```

:::

### aggregate

Compact rollup with deduplicated, sorted paths and keywords plus a count.

#### Signature

```ts
public aggregate(): { count: number; paths: string[]; keywords: string[] }
```

#### When to use

Structured logging and metric labels. The output has bounded cardinality — no per-instance `params` data — so it is safe to use as a metric label value without risk of cardinality explosion.

#### Example

```ts
const rollup = errs.aggregate();
// { count: 2, paths: ['/body', '/rating'], keywords: ['maximum', 'minLength'] }

// Structured log:
logger.warn('validation failed', {
  count:    rollup.count,
  keywords: rollup.keywords,
  paths:    rollup.paths,
  schema:   ReviewSchema.$id,
});

// Metric:
metrics.increment('validation.failure', {
  keywords: rollup.keywords.join(','),
  schema:   'Review',
});
```

::: code-group

```ts [json-tology]
const { count, paths, keywords } = jt.errors(ReviewSchema.$id, data).aggregate();
```

```ts [Zod]
// Not directly supported — manual derivation from ZodError.issues:
const issues = result.error.issues;
const count = issues.length;
const paths = [...new Set(issues.map(i => '/' + i.path.join('/')))].sort();
const keywords = [...new Set(issues.map(i => i.code))].sort();
```

```ts [TypeBox]
// Not directly supported.
```

```ts [AJV]
// Not directly supported — manual derivation from ajv.errors:
const paths = [...new Set(ajv.errors?.map(e => e.instancePath) ?? [])].sort();
```

```py [Pydantic]
# Manual derivation:
errors = e.errors()
count = len(errors)
paths = sorted(set(str(err['loc']) for err in errors))
```

:::

### report

Produces an RFC 7807 Problem Details payload for HTTP `422` responses.

#### Signature

```ts
public report(overrides?: Partial<ProblemDetailsType>): ProblemDetailsType
```

#### When to use

HTTP API error responses. Attach directly to a `422 Unprocessable Entity` response body with `Content-Type: application/problem+json`.

#### Example

```ts
// Express / Fastify / Hono / any framework with plain object bodies:
app.post('/reviews', (req, res) => {
  const errs = jt.errors(ReviewSchema.$id, req.body);

  if (!errs.ok) {
    return res
      .status(422)
      .type('application/problem+json')
      .send(errs.report({ instance: req.url }));
  }

  const review = jt.coerce(ReviewSchema.$id, req.body);
  // ... persist review
});
```

The default payload structure:

```json
{
  "type": "https://json-tology.dev/problems/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "2 validation errors",
  "instance": "/reviews",
  "errors": [
    {
      "path":    "/rating",
      "keyword": "maximum",
      "message": "must be <= 5",
      "params":  { "limit": 5 }
    },
    {
      "path":    "/body",
      "keyword": "minLength",
      "message": "must NOT have fewer than 10 characters",
      "params":  { "limit": 10 }
    }
  ]
}
```

::: code-group

```ts [json-tology]
const problem = jt.errors(ReviewSchema.$id, data).report({ instance: req.url });
// RFC 7807 ProblemDetailsType
```

```ts [Zod]
// Not directly supported — manual construction:
const result = ReviewSchema.safeParse(data);
const problem = {
  type:   'https://example.com/problems/validation',
  title:  'Validation failed',
  status: 422,
  detail: `${result.error?.issues.length} validation errors`,
  errors: result.error?.issues.map(i => ({ path: i.path.join('/'), message: i.message })),
};
```

```ts [TypeBox]
// Not directly supported — manual construction required.
```

```ts [AJV]
// Not directly supported — manual construction required.
```

```py [Pydantic]
# FastAPI does this automatically:
# from fastapi import FastAPI; app = FastAPI()
# @app.post('/reviews')
# def create_review(body: Review): ...
# FastAPI returns a 422 with detail list on validation failure.
```

:::

### Related

- `validate` — string[] shortcut
- `errors` — the `ValidationErrors` collection
- [Invariants](/invariants) — cross-field rules that produce `ValidationErrors` items with `keyword: 'jt:invariant'`

---

## Field Aliases (`jt:alias`)

A schema property may declare `jt:alias` to accept alternate input key names. During `coerce()`, if the canonical key is absent and an alias key is present, the value is copied to the canonical key. The canonical key always wins when both are supplied.

```ts
const SnakeCaseOrderSchema = {
  $id: 'https://bookstore.example/SnakeCaseOrder',
  type: 'object',
  properties: {
    customerId: { type: 'string', 'jt:alias': 'customer_id' },
    placedAt:   { type: 'string', 'jt:alias': ['placed_at', 'placed_at_utc'] },
  },
  required: ['customerId', 'placedAt'],
} as const;

jt.register(SnakeCaseOrderSchema);

jt.coerce(SnakeCaseOrderSchema.$id, {
  customer_id: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placed_at:   '2026-01-15T10:30:00Z',
});
// => { customerId: 'c1a2b3d4-...', placedAt: '2026-01-15T10:30:00Z' }
```

Alias normalization runs before `required` property validation, so an alias key satisfies a `required` constraint. Multi-alias lists are tried in declaration order; the first matching alias wins.

## Strict mode and config

### Per-field strict (`jt:strict`)

Add `jt:strict: true` on a property schema to prevent type coercion for that field. When set, the field rejects values whose JS type does not exactly match the declared JSON Schema type — no string→number coercion, no truthy→boolean, no array-of-one unwrapping. Use `jt:strict: false` to opt a single field out of strict mode when the parent schema uses `jt:config.strict: true`.

```ts
const OrderSchema = {
  $id: 'https://example.com/Order',
  type: 'object',
  properties: {
    id:    { type: 'string' },
    total: { type: 'number', 'jt:strict': true },  // rejects "42", accepts 42
  },
  required: ['id', 'total'],
} as const;

const jt = JsonTology.create({ baseIRI: 'https://example.com', schemas: [OrderSchema] as const });

jt.coerce(OrderSchema.$id, { id: 'x', total: 42 });    // ok
jt.coerce(OrderSchema.$id, { id: 'x', total: '42' });   // throws CoercionError — strict field
```

### Frozen output (`jt:frozen`)

Add `jt:frozen: true` on an object schema to make `coerce()` and `materialize()` return a deeply-frozen value. All nested objects and arrays on the result are also frozen. Schemas without `jt:frozen` continue to return mutable values.

```ts
const ConfigSchema = {
  $id: 'https://example.com/Config',
  type: 'object',
  'jt:frozen': true,
  properties: {
    host: { type: 'string', default: 'localhost' },
    port: { type: 'integer', default: 3000 },
  },
} as const;

const config = jt.coerce(ConfigSchema.$id, { port: 8080 });
Object.isFrozen(config);  // true — mutation throws in strict mode (all ESM modules)
```

### Schema-level config (`jt:config`)

`jt:config` sets schema-level defaults that apply to all fields without individual overrides. It accepts three keys:

| Key | Values | Effect |
|-----|--------|--------|
| `strict` | `boolean` | Default strict mode for all fields (per-field `jt:strict` overrides this) |
| `frozen` | `boolean` | Shorthand for `jt:frozen: true` on the same schema |
| `extra` | `'ignore'` \| `'allow'` \| `'forbid'` | How to handle unknown input properties |

`extra: 'ignore'` (default) strips unknown properties from `coerce()` output. `extra: 'allow'` passes them through unchanged. `extra: 'forbid'` raises a `CoercionError` with `EXTRA_FORBIDDEN` errors for each unknown property.

```ts
const ApiInputSchema = {
  $id: 'https://example.com/ApiInput',
  type: 'object',
  'jt:config': {
    strict: true,        // all fields strict by default
    extra: 'forbid',     // reject unknown properties
  },
  properties: {
    name:  { type: 'string' },
    score: { type: 'number', 'jt:strict': false },  // opt out of config-level strict
  },
  required: ['name'],
} as const;
```

### Config merge with `Compose.extend()`

When `Compose.extend()` is called with a parent that has `jt:config`, the child's `jt:config` keys are merged over the parent's — child wins per-key. `Compose.pick()` and `Compose.omit()` carry `jt:config` from the source schema unchanged.

```ts
const Base = {
  $id: 'https://example.com/Base',
  type: 'object',
  'jt:config': { extra: 'allow', strict: false },
  properties: { name: { type: 'string' } },
} as const;

// Child overrides 'extra' but inherits 'strict'
const Child = Compose.extend(Base, { 'jt:config': { extra: 'forbid' } } as const, 'https://example.com/Child');
// Child['jt:config'] => { extra: 'forbid', strict: false }
```
