# `ValidationErrors` <Badge type="tip" text="Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** `validate()` returns `ValidationErrors` (not `string[]`). See [`validate()`](/validation/validate) for the method reference. This page covers the `ValidationErrors` collection shape and usage patterns.

The `ValidationErrors` collection is also carried on `InstantiationError.errors` and `CoercionError.errors`, so the same patterns apply when you catch those exceptions.

**Use this when** you need programmatic access to the structured error list - paths, keywords, params - without wanting an exception. This is the right collection for API validation where you collect errors, then decide what to do with them (return a 422, log, display in a form). The collection is iterable with `for...of`.

**Don't use this when** you only need a boolean (use [`is`](/validation/is)). Don't use it when you want the coerced typed value on success (use [`instantiate`](/validation/instantiate)).

## Public surface

| Member | Type | Purpose |
|--------|------|---------|
| `items` | `readonly ValidationErrorType[]` | Raw error list with JSON Pointer paths |
| `length` | `number` | Number of errors |
| `ok` | `boolean` | `true` when `length === 0` |
| `aggregate()` | `AggregateViewType` | `{ count, paths, keywords }` rollup for logs and metrics |
| `report(overrides?)` | `ProblemDetailsType` | RFC 7807 Problem Details payload |
| `[Symbol.iterator]()` | `Iterator<ValidationErrorType>` | Enables `for...of` |

Each `ValidationErrorType` carries:

<!-- inline-ts-ok: shape declaration mirroring the canonical type alias in src/types/Errors; documenting it here keeps the reference table self-contained. -->
```ts
type ValidationErrorType = {
  path:    string;                 // JSON Pointer path
  keyword: string;                 // e.g. 'required', 'type', 'jt:invariant'
  message: string;                 // human-readable
  params:  Record<string, unknown> // keyword-specific params
};
```

## Examples

### Example 1: Check validity, iterate errors

<RunnableExample src="examples/docs/validation/17-errors-iterate" />

### Example 2: Valid data returns empty collection

<RunnableExample src="examples/docs/validation/18-errors-ok-empty" />

### Example 3: Combine with the structured views

See [`Error views`](/errors/views) for full documentation of each view.

<RunnableExample src="examples/docs/validation/19-errors-views" />

## Bad examples - what NOT to do

### Anti-pattern 1: Calling validate() and then instantiate() separately

<RunnableExample src="examples/docs/validation/20-errors-antipattern-double-validate" />

### Anti-pattern 2: Re-implementing a built-in view

<RunnableExample src="examples/docs/validation/21-errors-antipattern-manual-grouping" />

## Comparison

::: code-group

```ts [json-tology]
const errs = bookstoreEntities.validate(OrderSchema.$id, data);
// ValidationErrors  - .ok, .length, iterable, .items, .aggregate(), .report()
```

```ts [Zod]
const result = OrderSchema.safeParse(data);
if (!result.success) {
  result.error.issues; // ZodIssue[]  - path (array), code, message per issue
  result.error.flatten(); // { fieldErrors, formErrors }  - Zod-native flatten
}
```

```ts [Valibot]
import * as v from 'valibot';
const result = v.safeParse(OrderSchema, data);
if (!result.success) {
  result.issues; // Issue[] - .message, .path, .expected, .received per issue
  // Limitation: no built-in aggregate() or report() views; project manually.
  v.flatten(result.issues); // { root, nested } summary
}
```

```ts [io-ts]
import { isLeft } from 'fp-ts/Either';
import { PathReporter } from 'io-ts/PathReporter';
const result = OrderCodec.decode(data);
if (isLeft(result)) {
  result.left;                       // ValidationError[] - context + value per node
  PathReporter.report(result);       // string[] - flattened messages
  // Limitation: no aggregate() or report() RFC 7807 views; project manually
  // from the ValidationError context array.
}
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
const errors = [...Value.Errors(OrderSchema, data)];
// ValueError[]  - path, message, schema, value per error
// No built-in views
```

```ts [AJV]
ajv.validate(orderSchema, data);
const errors = ajv.errors ?? [];
// ErrorObject[]  - instancePath, keyword, message, params per error
// No built-in views
```

```py [Pydantic]
try:
    Order(**data)
except ValidationError as e:
    e.errors()          # list of dicts: loc, msg, type
    e.error_count()     # int
    e.json()            # JSON string of errors
    # No aggregate() or report() equivalent built in
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

## Related

- [`JsonTology.validate`](/validation/validate) - method that returns `ValidationErrors`
- [`JsonTology.is`](/validation/is) - boolean type guard
- [`JsonTology.instantiate`](/validation/instantiate) - throws `InstantiationError` which carries the same `ValidationErrors` on `.errors`
- [Error views](/errors/views) - `aggregate`, `report` in full detail

## See also

- [Invariants](/registry/invariants) - cross-field rules that produce `ValidationErrorType` items with `keyword: 'jt:invariant'`
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
