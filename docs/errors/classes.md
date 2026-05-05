# Error class hierarchy

Every json-tology error extends `BaseError`. The base class carries a machine-readable `code`, a human `message`, a `retryable` flag, an optional `cause` chain, and two structured projections (`toJson()`, `flatten()`). Every subclass adds domain-specific fields - schema IDs, JSON Pointers, file paths, validation errors.

> Never throw a bare `new Error()` from json-tology code. Pick the appropriate subclass.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) appear in the catch examples.

---

## `BaseError`

**Defined in.** `src/errors/BaseError.ts`.

**Public surface.**

| Member        | Type                          | Notes                                                  |
|---------------|-------------------------------|--------------------------------------------------------|
| `code`        | `string`                      | Stable, machine-readable identifier                    |
| `message`     | `string`                      | Inherited from `Error`                                 |
| `retryable`   | `boolean`                     | Hint to callers about retry safety                     |
| `cause`       | `Error \| undefined`          | Standard cause chain                                   |
| `toJson()`    | `ErrorJsonInterface`          | JSON-safe object including the cause chain             |
| `flatten()`   | `ErrorJsonInterface[]`        | Root-first array of every error in the cause chain     |

The `code` values are exported as constants from `src/constants/ERROR_CODES.ts` for each subclass.

```ts
import { BaseError } from 'json-tology';

try {
  // ...
} catch (err) {
  if (err instanceof BaseError) {
    console.log(err.code);          // "INSTANTIATION_FAILED"
    console.log(err.toJson());      // structured for logging
    console.log(err.flatten());     // root-first cause chain
  }
}
```

## `SchemaError`

**Thrown for.** Schema registration and structural problems - missing `$id`, duplicate anchors, unsupported dialect, structure validation failures.

**Adds.** `schemaId?: string` (the offending schema, when known).

**Codes.**

| Constant                                | Value                          |
|-----------------------------------------|--------------------------------|
| `SchemaErrorCode.MISSING_ID`            | `SCHEMA_MISSING_ID`            |
| `SchemaErrorCode.INVALID_INPUT`         | `SCHEMA_INVALID_INPUT`         |
| `SchemaErrorCode.NOT_REGISTERED`        | `SCHEMA_NOT_REGISTERED`        |
| `SchemaErrorCode.STRUCTURE_INVALID`     | `SCHEMA_STRUCTURE_INVALID`     |
| `SchemaErrorCode.DUPLICATE_ANCHOR`      | `SCHEMA_DUPLICATE_ANCHOR`      |
| `SchemaErrorCode.DIALECT_UNSUPPORTED`   | `SCHEMA_DIALECT_UNSUPPORTED`   |
| `SchemaErrorCode.VALIDATOR_MISSING`     | `SCHEMA_VALIDATOR_MISSING`     |
| `SchemaErrorCode.COMPUTED_FN_MISSING`   | `COMPUTED_FN_MISSING`          |
| `SchemaErrorCode.COMPUTED_INPUT_FORBIDDEN` | `COMPUTED_INPUT_FORBIDDEN`  |

```ts
import { JsonTology, SchemaError } from 'json-tology';

try {
  JsonTology.create({
    baseIRI: 'https://bookstore.example',
    schemas: [{ type: 'object' }] as const, // missing $id
  });
} catch (err) {
  if (err instanceof SchemaError) {
    console.log(err.code);       // "SCHEMA_MISSING_ID"
    console.log(err.schemaId);   // undefined
  }
}
```

## `GraphError`

**Thrown for.** Pointer resolution failures, anchor lookup failures, ref resolution failures, dialect or vocabulary issues, recursion-limit hits.

**Adds.** `pointer?: string` (the JSON Pointer involved in the failure, when applicable).

**Codes.**

| Constant                              | Value                       |
|---------------------------------------|-----------------------------|
| `GraphErrorCode.POINTER_INVALID`      | `POINTER_INVALID`           |
| `GraphErrorCode.POINTER_NOT_FOUND`    | `POINTER_NOT_FOUND`         |
| `GraphErrorCode.POINTER_NOT_SCHEMA`   | `POINTER_NOT_SCHEMA`        |
| `GraphErrorCode.ANCHOR_NOT_FOUND`     | `ANCHOR_NOT_FOUND`          |
| `GraphErrorCode.REF_UNRESOLVED`       | `REF_UNRESOLVED`            |
| `GraphErrorCode.RECURSION_LIMIT`      | `RECURSION_LIMIT`           |
| `GraphErrorCode.DIALECT_UNSUPPORTED`  | `DIALECT_UNSUPPORTED`       |
| `GraphErrorCode.VOCABULARY_UNSUPPORTED` | `VOCABULARY_UNSUPPORTED`  |
| `GraphErrorCode.BOOLEAN_SCHEMA_FRAGMENT` | `BOOLEAN_SCHEMA_FRAGMENT`|
| `GraphErrorCode.ARTIFACT_INVALID`     | `ARTIFACT_INVALID`          |
| `GraphErrorCode.ARTIFACT_STALE`       | `ARTIFACT_STALE`            |

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';
import { GraphError } from 'json-tology';

try {
  entities.subschemaAt(OrderSchema.$id, '/properties/nope');
} catch (err) {
  if (err instanceof GraphError) {
    console.log(err.code);     // "POINTER_NOT_FOUND"
    console.log(err.pointer);  // "/properties/nope"
  }
}
```

## `LoadError`

**Thrown for.** File-loading failures when `stopOnError` is set - missing files, invalid JSON, duplicate `$id` across files, schema parse failures.

**Adds.** `filePath: string` (the file the loader was processing). Marked `retryable: true` because IO failures are often transient.

**Codes.**

| Constant                          | Value                  |
|-----------------------------------|------------------------|
| `LoadErrorCode.MISSING_ID`        | `LOAD_MISSING_ID`      |
| `LoadErrorCode.INVALID_JSON`      | `LOAD_INVALID_JSON`    |
| `LoadErrorCode.INVALID_SCHEMA`    | `LOAD_INVALID_SCHEMA`  |
| `LoadErrorCode.DUPLICATE_ID`      | `LOAD_DUPLICATE_ID`    |
| `LoadErrorCode.DUPLICATE_ANCHOR`  | `LOAD_DUPLICATE_ANCHOR`|
| `LoadErrorCode.IO_FAILURE`        | `LOAD_IO_FAILURE`      |

```ts
import { LoadError } from 'json-tology';

try {
  // file-loader call site
} catch (err) {
  if (err instanceof LoadError) {
    console.log(err.code);       // e.g. "LOAD_INVALID_JSON"
    console.log(err.filePath);   // "/path/to/Order.schema.json"
    console.log(err.retryable);  // true
  }
}
```

## `InstantiationError`

**Thrown for.** Validation failure inside `instantiate()` - the trust-boundary entry point. Carries the full structured error list.

**Adds.** `errors: ValidationErrors` (the full `ValidationErrors` collection).

**Codes.** Always `INSTANTIATION_FAILED` at the wrapper level; per-error `keyword` values appear inside `errors.items`. The constant `InstantiationErrorCode.EXTRA_FORBIDDEN` (`EXTRA_FORBIDDEN`) is the keyword recorded when `jt:config.extra: 'forbid'` rejects unknown properties.

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';
import { InstantiationError } from 'json-tology';

try {
  entities.instantiate(OrderSchema.$id, {
    id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
    placedAt:   '2026-01-15T10:30:00Z',
    total:      -5,
    items: [{ bookIsbn: '9780140449136', quantity: 0, unitPrice: 12.99 }],
  });
} catch (err) {
  if (err instanceof InstantiationError) {
    console.log(err.code);                 // "INSTANTIATION_FAILED"
    console.log(err.errors.length);        // 2
    for (const item of err.errors) {
      console.log(item.path, item.keyword, item.message);
    }
    // /total          exclusiveMinimum  must be > 0
    // /items/0/quantity  minimum        must be >= 1
  }
}
```

The `errors` collection is the same `ValidationErrors` used by `validate()` - see [ValidationErrors views](/errors/views) for the full surface.

## `CoercionError`

**Thrown for.** Coerce-time validation failure - the same shape as `InstantiationError` but raised by the coercion path.

**Adds.** `errors: ValidationErrors`.

**Codes.** Always `COERCION_FAILED` at the wrapper level. The constant `CoercionErrorCode.EXTRA_FORBIDDEN` (`EXTRA_FORBIDDEN`) appears inside `errors.items` when extras are forbidden.

```ts
import { CoercionError } from 'json-tology';

try {
  // coercion call site
} catch (err) {
  if (err instanceof CoercionError) {
    console.log(err.code);             // "COERCION_FAILED"
    console.log(err.errors.length);    // structural error count
  }
}
```

## `MaterializationError`

**Thrown for.** Materialization failure - the result of `materialize()` (or ABox projection) failed validation.

**Adds.** `schemaId: string` and `validationErrors: string[]` (formatted `path: message` strings).

**Code.** Always `MATERIALIZATION_FAILED`.

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';
import { MaterializationError } from 'json-tology';

try {
  // materialize without enablePartial fails when required has no default
  entities.materialize(OrderSchema, {});
} catch (err) {
  if (err instanceof MaterializationError) {
    console.log(err.code);              // "MATERIALIZATION_FAILED"
    console.log(err.schemaId);          // "https://bookstore.example/Order"
    console.log(err.validationErrors);  // ["root: must have required property 'id'", ...]
  }
}
```

## Inspecting the cause chain

Every error supports `flatten()`, which walks the cause chain and returns a root-first array of plain objects suitable for structured logging.

```ts
import { InstantiationError } from 'json-tology';

try {
  // ...
} catch (err) {
  if (err instanceof InstantiationError) {
    for (const entry of err.flatten()) {
      console.log(entry.code, entry.message, entry.retryable);
    }
  }
}
```

`InstantiationError.flatten()` and `CoercionError.flatten()` additionally append every item in their `errors` collection, so a single call surfaces both the wrapper and each underlying validation issue.

## Related

- [ValidationErrors overview](/errors) - the collection embedded inside `InstantiationError` and `CoercionError`
- [ValidationErrors views](/errors/views) - `aggregate()` and `report()` projections

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in catch examples
