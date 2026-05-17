# ValidationErrors views

`ValidationErrors` has two structured views (`aggregate()`, `report()`) plus a raw `items` array. Obtain the collection from [`entities.validate()`](/validation/validate) or from `InstantiationError.errors`.

| Surface | Returns | Best for |
|---------|---------|----------|
| `.items` | `readonly ValidationErrorType[]` | Raw access - path, keyword, message, params |
| [`aggregate()`](#validationerrors-aggregate) | `{ count, paths, keywords }` | Structured logs, metric labels |
| [`report()`](#validationerrors-report) | `ProblemDetailsType` | HTTP 422 response bodies (RFC 7807) |

All examples use the [bookstore domain](/bookstore-domain).

---

## Usage examples

Common shapes for projecting `errs.items` into the format a caller wants.

### Path-prefixed message strings

```ts
errs.items.map(err => `${err.path || 'root'}: ${err.message}`)
// ["/rating: must be <= 5", "/body: must NOT have fewer than 10 characters"]
```

### Group by path

```ts
import type { ValidationErrorType } from 'json-tology/types';

const grouped: Record<string, ValidationErrorType[]> = {};
for (const err of errs) {
  (grouped[err.path || '_root'] ??= []).push(err);
}
// grouped['/rating'] → [{ keyword: 'maximum', message: 'must be <= 5', ... }]
// grouped['_root']   → [{ keyword: 'required', ... }]
```

### Field vs form errors

```ts
import type { ValidationErrorType } from 'json-tology/types';

const fieldErrors: ValidationErrorType[] = [];
const formErrors:  ValidationErrorType[] = [];

for (const err of errs) {
  if (err.path) { fieldErrors.push(err); } else { formErrors.push(err); }
}
// fieldErrors → errors with a non-empty path (field-specific)
// formErrors  → errors without a path (form-level, e.g. required at root)
```

---

## `ValidationErrors.aggregate` {#validationerrors-aggregate}

**Declaration.** Returns `{ count: number; paths: string[]; keywords: string[] }` - a compact rollup with the total error count, deduplicated sorted paths (in **access form**: `items[0].quantity` not `/items/0/quantity`), and deduplicated sorted keyword names. No per-instance `params` values.

**Use this when** logging validation failures as structured data or recording metric labels. Because `paths` and `keywords` are deduplicated and sorted with no unbounded `params` values, the output has bounded cardinality - safe to use as a metric label value without risk of cardinality explosion.

**Don't use this when** you need JSON Pointer paths (use `errs.items.map(e => e.path)`) or individual messages (iterate `errs.items`). Don't use it for user-facing error display.

### Return type

```ts
// aggregate() return type
{
  count:    number;    // total errors (NOT deduplicated)
  paths:    string[];  // deduplicated, sorted, access form (items[0].qty)
  keywords: string[];  // deduplicated, sorted
}
```

### Examples

#### Example 1: Structured log

<<< ../../examples/docs/errors/02-format.ts

#### Example 2: Metric recording

```ts
const rollup = errs.aggregate();
// paths and keywords are bounded sets  - safe as metric labels
metrics.increment('validation.failure', {
  keywords: rollup.keywords.join(','),
  schema:   'Order',
});
```

#### Example 3: JSON Pointer paths (use items, not aggregate)

```ts
// aggregate().paths is access form  - use items for JSON Pointer
const jsonPointerPaths = errs.items.map(err => err.path);
// ['/total', '/items/0/quantity']
```

### Comparison

::: code-group

```ts [json-tology]
errs.aggregate()
// { count: number; paths: string[]; keywords: string[] }
// Deduplicated, sorted, access form paths, no unbounded params values
```

```ts [Zod]
// Manual derivation:
const issues = result.error.issues;
const count = issues.length;
const paths = [...new Set(issues.map(i => i.path.join('.')))].sort();
const keywords = [...new Set(issues.map(i => i.code))].sort();
```

```ts [Valibot]
import * as v from 'valibot';
// Limitation: no aggregate() built in - derive from result.issues:
const result = v.safeParse(schema, data);
const issues = result.success ? [] : result.issues;
const count = issues.length;
const paths = [...new Set(issues.map(i => i.path?.map(p => p.key).join('.') ?? ''))].sort();
const keywords = [...new Set(issues.map(i => i.expected ?? i.type))].sort();
```

```ts [io-ts]
import { isLeft } from 'fp-ts/Either';
// Limitation: no aggregate() built in - derive from result.left:
const result = codec.decode(data);
const errors = isLeft(result) ? result.left : [];
const count = errors.length;
const paths = [...new Set(errors.map(err =>
  err.context.map(node => node.key).filter(Boolean).join('.'),
))].sort();
const keywords = [...new Set(errors.map(err => err.context.at(-1)?.type.name ?? ''))].sort();
```

```ts [TypeBox + Value]
// Manual derivation from Value.Errors iterator:
const errs = [...Value.Errors(schema, value)];
const count = errs.length;
const paths = [...new Set(errs.map(e => e.path))].sort();
const keywords = [...new Set(errs.map(e => e.type))].sort();
```

```ts [AJV]
// Manual derivation from ajv.errors array:
const errs = ajv.validate(schema, data) ? [] : ajv.errors ?? [];
const count = errs.length;
const paths = [...new Set(errs.map(e => e.instancePath))].sort();
const keywords = [...new Set(errs.map(e => e.keyword))].sort();
```

```py [Pydantic]
errors = exc.errors()
count = len(errors)
paths = sorted(set('.'.join(str(p) for p in e['loc']) for e in errors))
keywords = sorted(set(e['type'] for e in errors))
```


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

### Related

- [`report`](#validationerrors-report) - when you need the full RFC 7807 payload for HTTP responses
- Use `.items` to access full error objects with JSON Pointer paths

---

## `ValidationErrors.report` {#validationerrors-report}

**Declaration.** Returns a `ProblemDetailsType` object conforming to RFC 7807 Problem Details. Default values: `type: 'https://json-tology.dev/problems/validation'`, `title: 'Validation failed'`, `status: 422`. Accepts partial overrides for `instance`, `status`, `title`, and `type`. The `errors` array in the payload mirrors `errs.items` with `path`, `keyword`, `message`, and `params` on each entry. `path` values in the payload are JSON Pointer format.

**Use this when** returning HTTP `422 Unprocessable Entity` responses from an API. Set `Content-Type: application/problem+json`. Pass `instance: req.url` to include the request path in the problem details.

**Don't use this when** you need internal logging - the `errors` array can grow large; use [`aggregate`](#validationerrors-aggregate) for metrics.

### Return type

```ts
// ProblemDetailsType
{
  type:     string;    // problem type URI
  title:    string;    // human-readable title
  status:   number;    // HTTP status code (default 422)
  detail:   string;    // "N validation error(s)"
  instance?: string;  // optional request URI
  errors: Array<{
    path:    string;   // JSON Pointer (/items/0/quantity)
    keyword: string;   // JSON Schema keyword
    message: string;   // human-readable message
    params:  Record<string, unknown>;
  }>;
}
```

### Examples

#### Example 1: Express/Fastify/Hono request handler

```ts
import { bookstoreEntities, ReviewSchema } from './bookstore/index.js';

app.post('/reviews', (req, res) => {
  const errs = bookstoreEntities.validate(ReviewSchema.$id, req.body);

  if (!errs.ok) {
    return res
      .status(422)
      .type('application/problem+json')
      .send(errs.report({ instance: req.url }));
  }

  const review = bookstoreEntities.instantiate(ReviewSchema.$id, req.body);
  // ... persist and return 201
});
```

Response body:

```json
{
  "type":     "https://json-tology.dev/problems/validation",
  "title":    "Validation failed",
  "status":   422,
  "detail":   "2 validation errors",
  "instance": "/reviews",
  "errors": [
    { "path": "/rating", "keyword": "maximum",   "message": "must be <= 5",                           "params": { "limit": 5  } },
    { "path": "/body",   "keyword": "minLength", "message": "must NOT have fewer than 10 characters", "params": { "limit": 10 } }
  ]
}
```

#### Example 2: Override defaults

```ts
const problem = errs.report({
  type:   'https://api.bookstore.example/problems/validation',
  title:  'Review submission failed',
  status: 400,
});
```

### Bad examples - what NOT to do

#### Anti-pattern: Constructing RFC 7807 manually

```ts
// ⊥ Don't do this  - roll-your-own is fragile and inconsistent
const problem = {
  type:   'validation-error',
  status: 422,
  errors: errs.items.map(err => ({ field: err.path, error: err.message })),
};

// ✓ Do this  - use report() for RFC 7807 compliance
const problem = errs.report({ instance: req.url });
```

### Comparison

::: code-group

```ts [json-tology]
errs.report({ instance: '/reviews' })
// ProblemDetailsType  - RFC 7807 compliant, ready to send as 422 body
```

```ts [Zod]
// Manual RFC 7807 construction  - not built in:
const problem = {
  type:   'https://example.com/problems/validation',
  status: 422,
  detail: `${result.error.issues.length} validation errors`,
  errors: result.error.issues.map(i => ({ path: i.path.join('/'), message: i.message })),
};
```

```ts [Valibot]
import * as v from 'valibot';
// Limitation: no report() built in - manual RFC 7807 construction:
const result = v.safeParse(schema, data);
const issues = result.success ? [] : result.issues;
const problem = {
  type:   'https://example.com/problems/validation',
  status: 422,
  detail: `${issues.length} validation errors`,
  errors: issues.map(i => ({
    path:    `/${i.path?.map(p => p.key).join('/') ?? ''}`,
    keyword: i.expected ?? i.type,
    message: i.message,
    params:  {},
  })),
};
```

```ts [io-ts]
import { isLeft } from 'fp-ts/Either';
import { PathReporter } from 'io-ts/PathReporter';
// Limitation: no report() built in - manual RFC 7807 construction:
const result = codec.decode(data);
const errors = isLeft(result) ? result.left : [];
const messages = isLeft(result) ? PathReporter.report(result) : [];
const problem = {
  type:   'https://example.com/problems/validation',
  status: 422,
  detail: `${errors.length} validation errors`,
  errors: errors.map((err, idx) => ({
    path:    `/${err.context.map(node => node.key).filter(Boolean).join('/')}`,
    keyword: err.context.at(-1)?.type.name ?? '',
    message: messages[idx] ?? '',
    params:  {},
  })),
};
```

```ts [TypeBox + Value]
// Not built in  - manual construction required.
const errs = [...Value.Errors(schema, value)];
const problem = {
  type: 'https://example.com/problems/validation',
  status: 422,
  errors: errs.map(e => ({ path: e.path, message: e.message, keyword: e.type, params: {} })),
};
```

```ts [AJV]
// Not built in  - manual construction required.
const problem = {
  type: 'https://example.com/problems/validation',
  status: 422,
  errors: (ajv.errors ?? []).map(e => ({
    path: e.instancePath, keyword: e.keyword, message: e.message ?? '', params: e.params
  })),
};
```

```py [Pydantic]
# FastAPI handles this automatically:
# @app.post('/reviews') async def create(body: Review): ...
# Pydantic validation failure → FastAPI returns 422 with detail list.
```


```ts [Yup]
// Limitation: feature not directly supported in Yup. See /comparisons for the matrix.
```

```ts [Joi]
// Limitation: feature not directly supported in Joi. See /comparisons for the matrix.
```

```ts [Effect Schema]
// Limitation: feature not directly supported in Effect Schema. See /comparisons for the matrix.
```

```ts [ArkType]
// Limitation: feature not directly supported in ArkType. See /comparisons for the matrix.
```

```ts [Runtypes]
// Limitation: feature not directly supported in Runtypes. See /comparisons for the matrix.
```

:::

### Related

- [`aggregate`](#validationerrors-aggregate) - compact rollup for logging/metrics (not for HTTP responses)

## See also

- [`entities.validate()`](/validation/validate) - how to obtain the `ValidationErrors` collection
- [`entities.instantiate()`](/validation/instantiate) - `InstantiationError.errors` carries the same collection
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
