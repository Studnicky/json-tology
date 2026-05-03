# Error Views

`ValidationErrors` exposes five views over the same error data. All five are available on the collection returned by [`jt.errors()`](/validation/errors) and on the `CoercionError.errors` property. Choose the one that matches your output target.

| View | Returns | Best for |
|------|---------|----------|
| [`messages()`](#validationerrors-messages) | `string[]` | Console, logs, simple display |
| [`format()`](#validationerrors-format) | `Record<string, string[]>` | Form field highlighting |
| [`flatten()`](#validationerrors-flatten) | `{ fieldErrors, formErrors }` | Zod-compatible form libraries |
| [`aggregate()`](#validationerrors-aggregate) | `{ count, paths, keywords }` | Structured logs, metric labels |
| [`report()`](#validationerrors-report) | `ProblemDetailsType` | HTTP 422 response bodies |

All examples use the [bookstore domain](/bookstore-domain). Start with [errors()](/validation/errors) for how to obtain the collection.

---

## `ValidationErrors.messages` {#validationerrors-messages}

**Declaration.** Returns an array of `"path: message"` strings — one string per error. Root-level errors (no path) are prefixed with `"root"`.

**Use this when** you want to print errors to a console, write them to a log line, or display a flat list to a developer. The string is pre-formatted — no further transformation needed.

**Don't use this when** you need to map errors to specific form fields (use [`format`](#validationerrors-format) or [`flatten`](#validationerrors-flatten)). Don't parse the strings to extract paths — use `format()` for structured path access.

### Examples

#### Example 1: Console output

```ts
import { jt, ReviewSchema } from './bookstore/schemas.js';

const errs = jt.errors(ReviewSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  bookIsbn:   '9780140449136',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  rating:     6,       // max 5
  body:       'short', // minLength 10
  postedAt:   '2026-01-15T10:30:00Z',
});

console.log(errs.messages());
// ["/rating: must be <= 5", "/body: must NOT have fewer than 10 characters"]
```

#### Example 2: Log all errors as one line

```ts
if (!errs.ok) {
  logger.warn(`Validation failed: ${errs.messages().join('; ')}`);
}
```

### Bad examples — what NOT to do

#### Anti-pattern: Parsing messages to extract field paths

```ts
// ⊥ Don't do this — fragile string parsing
const path = errs.messages()[0].split(':')[0];

// ✓ Do this — use format() for structured path access
const grouped = errs.format();
```

### Comparison

::: code-group

```ts [json-tology]
errs.messages()
// ["/rating: must be <= 5", "/body: must NOT have fewer than 10 characters"]
```

```ts [Zod]
result.error.issues.map(i => `${i.path.join('/')}: ${i.message}`)
```

```ts [TypeBox + Value]
[...Value.Errors(schema, data)].map(e => `${e.path}: ${e.message}`)
```

```ts [AJV]
(ajv.errors ?? []).map(e => `${e.instancePath}: ${e.message}`)
```

```py [Pydantic]
[f"{'/'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()]
```

:::

### Related

- [`format`](#validationerrors-format) — grouped by path, for form field highlighting
- [`aggregate`](#validationerrors-aggregate) — compact rollup, for logging with bounded cardinality

---

## `ValidationErrors.format` {#validationerrors-format}

**Declaration.** Groups error messages by JSON Pointer path. Returns `Record<string, string[]>`. Root-level errors (path is empty string) are keyed as `"_root"`.

**Use this when** building form UIs where you want to display error messages next to the relevant field. The path keys map directly to JSON Pointer paths from the schema — strip the leading `/` to get the field name.

**Don't use this when** you need the `{ fieldErrors, formErrors }` split used by Zod-compatible form libraries (use [`flatten`](#validationerrors-flatten)). Don't use it for logging (use [`aggregate`](#validationerrors-aggregate) for structured log fields).

### Examples

#### Example 1: Map to form field errors

```ts
import { jt, ReviewSchema } from './bookstore/schemas.js';

const errs = jt.errors(ReviewSchema.$id, badReview);
const grouped = errs.format();
// {
//   '/rating': ['must be <= 5'],
//   '/body':   ['must NOT have fewer than 10 characters'],
// }

// Display beside form fields:
Object.entries(grouped).forEach(([path, msgs]) => {
  const fieldName = path.replace(/^\//, '');  // '/rating' → 'rating'
  setFieldError(fieldName, msgs.join(', '));
});
```

#### Example 2: Root-level errors keyed as _root

When a required property is missing, the error has an empty path and appears under `_root`.

```ts
const errs = jt.errors(CustomerSchema.$id, { email: 'alice@bookstore.example' });
const grouped = errs.format();
// { '_root': ["must have required property 'id'", "must have required property 'name'"] }
```

### Comparison

::: code-group

```ts [json-tology]
errs.format()
// Record<string, string[]> — path → messages[]
// Root-level errors keyed as '_root'
```

```ts [Zod]
// Manual — Zod's flatten() has a similar but not identical structure:
const { fieldErrors } = result.error.flatten();
// fieldErrors: { fieldName: string[] } — not JSON Pointer format
```

```ts [TypeBox + Value]
// Manual grouping:
const grouped: Record<string, string[]> = {};
for (const e of Value.Errors(schema, data)) {
  (grouped[e.path] ??= []).push(e.message);
}
```

```ts [AJV]
// Manual grouping:
const grouped: Record<string, string[]> = {};
for (const e of ajv.errors ?? []) {
  (grouped[e.instancePath || '_root'] ??= []).push(e.message ?? '');
}
```

```py [Pydantic]
grouped = {}
for e in exc.errors():
    path = '/' + '/'.join(str(p) for p in e['loc']) if e['loc'] else '_root'
    grouped.setdefault(path, []).append(e['msg'])
```

:::

### Related

- [`flatten`](#validationerrors-flatten) — Zod-compatible `{ fieldErrors, formErrors }` split
- [`messages`](#validationerrors-messages) — flat string array

---

## `ValidationErrors.flatten` {#validationerrors-flatten}

**Declaration.** Separates errors into `fieldErrors` (keyed by JSON Pointer path, `Record<string, string[]>`) and `formErrors` (no path, `string[]`). Returns `{ fieldErrors, formErrors }`.

**Use this when** integrating with form libraries that expect the Zod-compatible `{ fieldErrors, formErrors }` error shape. `formErrors` captures root-level errors (missing required properties at the top level); `fieldErrors` captures everything with a path.

**Don't use this when** you need the path-keyed grouping with `_root` for root errors (use [`format`](#validationerrors-format) instead). Don't use it for HTTP error responses (use [`report`](#validationerrors-report)).

### Examples

#### Example 1: Zod-compatible form library integration

```ts
import { jt, ReviewSchema } from './bookstore/schemas.js';

const errs = jt.errors(ReviewSchema.$id, badReview);
const { fieldErrors, formErrors } = errs.flatten();

// fieldErrors: { '/rating': ['must be <= 5'], '/body': ['...'] }
// formErrors:  [] — would contain root-level missing-required errors

// Pass to form library:
setFormFieldErrors(fieldErrors);
if (formErrors.length > 0) showFormBanner(formErrors);
```

#### Example 2: Separating field vs form errors

```ts
const errs = jt.errors(CustomerSchema.$id, {
  email: 'alice@bookstore.example',
  // id and name missing — these are root-level required errors
});
const { fieldErrors, formErrors } = errs.flatten();
// fieldErrors: {}  — no field-level errors
// formErrors:  ["must have required property 'id'", "must have required property 'name'"]
```

### Comparison

::: code-group

```ts [json-tology]
const { fieldErrors, formErrors } = jt.errors(schema, data).flatten();
// fieldErrors: Record<JSON-Pointer-path, string[]>
// formErrors:  string[]
```

```ts [Zod]
const result = schema.safeParse(data);
if (!result.success) {
  const { fieldErrors, formErrors } = result.error.flatten();
  // fieldErrors: Record<field-name, string[]> (not JSON Pointer format)
}
```

```ts [TypeBox + Value]
// Not built in — manual split:
const fieldErrors: Record<string, string[]> = {};
const formErrors: string[] = [];
for (const e of Value.Errors(schema, data)) {
  if (e.path) (fieldErrors[e.path] ??= []).push(e.message);
  else formErrors.push(e.message);
}
```

```ts [AJV]
// Not built in — manual split.
```

```py [Pydantic]
field_errors = {
    '/' + '/'.join(str(p) for p in e['loc']): [e['msg']]
    for e in exc.errors() if e['loc']
}
form_errors = [e['msg'] for e in exc.errors() if not e['loc']]
```

:::

---

## `ValidationErrors.aggregate` {#validationerrors-aggregate}

**Declaration.** Returns `{ count: number; paths: string[]; keywords: string[] }` — a compact rollup with the total error count, deduplicated sorted JSON Pointer paths, and deduplicated sorted keyword names. The output contains no per-instance `params` values.

**Use this when** logging validation failures as structured data or recording metric labels. Because `paths` and `keywords` are deduplicated and sorted with no unbounded `params` values, the output has bounded cardinality — safe to use as a metric label value without risk of cardinality explosion.

**Don't use this when** you need the individual error messages or the full `params` data (use [`format`](#validationerrors-format) or iterate `errs.items`). Don't use it for user-facing error display.

### Examples

#### Example 1: Structured log

```ts
import { jt, OrderSchema } from './bookstore/schemas.js';

const errs = jt.errors(OrderSchema.$id, badOrder);

if (!errs.ok) {
  const rollup = errs.aggregate();
  // { count: 2, paths: ['/items', '/total'], keywords: ['exclusiveMinimum', 'minItems'] }

  logger.warn('validation.failed', {
    count:    rollup.count,
    keywords: rollup.keywords,
    paths:    rollup.paths,
    schema:   OrderSchema.$id,
  });
}
```

#### Example 2: Metric recording

```ts
const rollup = errs.aggregate();
// paths and keywords are bounded sets — safe as metric labels
metrics.increment('validation.failure', {
  keywords: rollup.keywords.join(','),
  schema:   'Order',
});
```

### Comparison

::: code-group

```ts [json-tology]
errs.aggregate()
// { count: number; paths: string[]; keywords: string[] }
// Deduplicated, sorted, no unbounded params values
```

```ts [Zod]
// Manual derivation:
const issues = result.error.issues;
const count = issues.length;
const paths = [...new Set(issues.map(i => '/' + i.path.join('/')))].sort();
const keywords = [...new Set(issues.map(i => i.code))].sort();
```

```ts [TypeBox + Value]
// Manual derivation from Value.Errors iterator.
```

```ts [AJV]
// Manual derivation from ajv.errors array.
```

```py [Pydantic]
errors = exc.errors()
count = len(errors)
paths = sorted(set('/' + '/'.join(str(p) for p in e['loc']) for e in errors))
keywords = sorted(set(e['type'] for e in errors))
```

:::

### Related

- [`report`](#validationerrors-report) — when you need the full RFC 7807 payload for HTTP responses
- [`format`](#validationerrors-format) — when you need individual messages with path grouping

---

## `ValidationErrors.report` {#validationerrors-report}

**Declaration.** Returns a `ProblemDetailsType` object conforming to RFC 7807 Problem Details. Default values: `type: 'https://json-tology.dev/problems/validation'`, `title: 'Validation failed'`, `status: 422`. Accepts partial overrides for `instance`, `status`, `title`, and `type`. The `errors` array in the payload mirrors `errs.items` with `path`, `keyword`, `message`, and `params` on each entry.

**Use this when** returning HTTP `422 Unprocessable Entity` responses from an API. Set `Content-Type: application/problem+json`. Pass `instance: req.url` to include the request path in the problem details.

**Don't use this when** you need a flat string list (use [`messages`](#validationerrors-messages)) or structured field map (use [`format`](#validationerrors-format)). Don't use it for internal logging — the `errors` array can grow large; use [`aggregate`](#validationerrors-aggregate) for metrics.

### Examples

#### Example 1: Express/Fastify/Hono request handler

```ts
import { jt, ReviewSchema } from './bookstore/schemas.js';

// Any framework with plain object response body:
app.post('/reviews', (req, res) => {
  const errs = jt.errors(ReviewSchema.$id, req.body);

  if (!errs.ok) {
    return res
      .status(422)
      .type('application/problem+json')
      .send(errs.report({ instance: req.url }));
  }

  const review = jt.coerce(ReviewSchema.$id, req.body);
  // ... persist and return 201
});
```

The response body:

```json
{
  "type":     "https://json-tology.dev/problems/validation",
  "title":    "Validation failed",
  "status":   422,
  "detail":   "2 validation errors",
  "instance": "/reviews",
  "errors": [
    { "path": "/rating", "keyword": "maximum",   "message": "must be <= 5",                                   "params": { "limit": 5  } },
    { "path": "/body",   "keyword": "minLength", "message": "must NOT have fewer than 10 characters", "params": { "limit": 10 } }
  ]
}
```

#### Example 2: Override defaults for a custom problem type

```ts
const problem = errs.report({
  type:   'https://api.bookstore.example/problems/validation',
  title:  'Review submission failed',
  status: 400,
});
```

### Bad examples — what NOT to do

#### Anti-pattern: Constructing RFC 7807 manually

```ts
// ⊥ Don't do this — roll-your-own is fragile and inconsistent
const problem = {
  type:   'validation-error',
  status: 422,
  errors: errs.items.map(e => ({ field: e.path, error: e.message })),
};

// ✓ Do this — use report() for RFC 7807 compliance
const problem = errs.report({ instance: req.url });
```

### Comparison

::: code-group

```ts [json-tology]
errs.report({ instance: '/reviews' })
// ProblemDetailsType — RFC 7807 compliant, ready to send as 422 body
```

```ts [Zod]
// Manual RFC 7807 construction — not built in:
const problem = {
  type:   'https://example.com/problems/validation',
  status: 422,
  detail: `${result.error.issues.length} validation errors`,
  errors: result.error.issues.map(i => ({ path: i.path.join('/'), message: i.message })),
};
```

```ts [TypeBox + Value]
// Not built in — manual construction required.
```

```ts [AJV]
// Not built in — manual construction required.
```

```py [Pydantic]
# FastAPI handles this automatically:
# @app.post('/reviews') async def create(body: Review): ...
# Pydantic validation failure → FastAPI returns 422 with detail list.
# For manual: e.errors() gives a list of dicts matching the RFC 7807 error format.
```

:::

### Related

- [`aggregate`](#validationerrors-aggregate) — compact rollup for logging/metrics (not for HTTP responses)
- [`flatten`](#validationerrors-flatten) — Zod-compatible split (for form libraries, not HTTP)

## See also

- [`JsonTology.errors`](/validation/errors) — how to obtain the `ValidationErrors` collection
- [`JsonTology.coerce`](/validation/coerce) — `CoercionError.errors` carries the same collection
- [Bookstore domain](/bookstore-domain) — schema definitions used in examples
