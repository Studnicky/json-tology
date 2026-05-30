# Error class hierarchy

> Validation modes: [Validation modes reference](/validation-modes)

Every json-tology error extends `BaseError`. The base class carries a machine-readable `code`, a human `message`, a `retryable` flag, an optional `cause` chain, and two structured projections (`toJson()`, `flatten()`). Every subclass adds domain-specific fields - schema IDs, JSON Pointers, validation errors.

Error constructors follow the universal DX convention: required arguments are positional in canonical order; every optional or contextual field travels in a single trailing options bag typed by an `Interface` or `Type` alias. The instance fields described below are unchanged - only the constructor argument shape collapsed into a single options object.

> Never throw a bare `new Error()` from json-tology code. Pick the appropriate subclass.

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) appear in the catch examples.

---

## `BaseError`

**Defined in.** `src/errors/BaseError.ts`.

**Constructor.** `new BaseError(code, message, options?: BaseErrorOptionsType)` where `BaseErrorOptionsType = { cause?: Error; retryable?: boolean }`. `retryable` defaults to `false` when omitted.

<RunnableExample src="examples/docs/errors/24-base-error-constructor" />

**Public surface.**

| Member        | Type                          | Notes                                                  |
|---------------|-------------------------------|--------------------------------------------------------|
| `code`        | `string`                      | Stable, machine-readable identifier                    |
| `message`     | `string`                      | Inherited from `Error`                                 |
| `retryable`   | `boolean`                     | Hint to callers about retry safety; set via `options.retryable` (default `false`) |
| `cause`       | `Error \| undefined`          | Standard cause chain; set via `options.cause`          |
| `toJson()`    | `ErrorJsonInterface`          | JSON-safe object including the cause chain             |
| `flatten()`   | `ErrorJsonInterface[]`        | Root-first array of every error in the cause chain     |

The `code` values are exported as constants from `src/constants/ERROR_CODES.ts` for each subclass.

<RunnableExample src="examples/docs/errors/15-base-error-shape" />

## `SchemaError` <Badge type="tip" text="Runtime" />

**Thrown for.** Schema registration and structural problems - missing `$id`, duplicate anchors, unsupported dialect, structure validation failures.

**Constructor.** `new SchemaError(code, message, options?: SchemaErrorOptionsType)` where `SchemaErrorOptionsType = { cause?: Error; schemaId?: string }`.

<RunnableExample src="examples/docs/errors/25-schema-error-constructor" />

**Adds.** `schemaId?: string` (the offending schema, when known) - exposed as an instance field and set via `options.schemaId`.

**Codes.**

| Constant                                | Value                          | Notes |
|-----------------------------------------|--------------------------------|-------|
| `SchemaErrorCode.MISSING_ID`            | `SCHEMA_MISSING_ID`            | |
| `SchemaErrorCode.INVALID_INPUT`         | `SCHEMA_INVALID_INPUT`         | |
| `SchemaErrorCode.NOT_REGISTERED`        | `SCHEMA_NOT_REGISTERED`        | |
| `SchemaErrorCode.STRUCTURE_INVALID`     | `SCHEMA_STRUCTURE_INVALID`     | |
| `SchemaErrorCode.DUPLICATE_ANCHOR`      | `SCHEMA_DUPLICATE_ANCHOR`      | |
| `SchemaErrorCode.DIALECT_UNSUPPORTED`   | `SCHEMA_DIALECT_UNSUPPORTED`   | |
| `SchemaErrorCode.VALIDATOR_MISSING`     | `SCHEMA_VALIDATOR_MISSING`     | |
| `SchemaErrorCode.COMPUTED_FN_MISSING`   | `COMPUTED_FN_MISSING`          | |
| `SchemaErrorCode.COMPUTED_INPUT_FORBIDDEN` | `COMPUTED_INPUT_FORBIDDEN`  | |
| _(direct string)_                       | `SCHEMA_DUPLICATE_ID`          | Thrown by `SchemaRegistry` when two schemas with the same `$id` are registered. Detected during `set()` with `enableDuplicateDetection` enabled. See `src/types/ErrorCodes.ts`. |
| _(direct string)_                       | `SCHEMA_DUPLICATE_SHAPE`       | Thrown by `SchemaRegistry` when a schema with a duplicate canonical shape (same structural hash) is registered. See `src/types/ErrorCodes.ts`. |

<RunnableExample src="examples/docs/errors/16-schema-error" />

## `GraphError` <Badge type="tip" text="Runtime" />

**Thrown for.** Pointer resolution failures, anchor lookup failures, ref resolution failures, dialect or vocabulary issues, recursion-limit hits.

**Constructor.** `new GraphError(code, message, options?: GraphErrorOptionsType)` where `GraphErrorOptionsType = { cause?: Error; pointer?: string }`.

<RunnableExample src="examples/docs/errors/26-graph-error-constructor" />

**Adds.** `pointer?: string` (the JSON Pointer involved in the failure, when applicable) - exposed as an instance field and set via `options.pointer`.

**Codes.**

| Constant                              | Value                       | Notes |
|---------------------------------------|-----------------------------|-------|
| `GraphErrorCode.POINTER_INVALID`      | `POINTER_INVALID`           | |
| `GraphErrorCode.POINTER_NOT_FOUND`    | `POINTER_NOT_FOUND`         | |
| `GraphErrorCode.POINTER_NOT_SCHEMA`   | `POINTER_NOT_SCHEMA`        | |
| `GraphErrorCode.ANCHOR_NOT_FOUND`     | `ANCHOR_NOT_FOUND`          | |
| `GraphErrorCode.REF_UNRESOLVED`       | `REF_UNRESOLVED`            | Cross-schema `$ref` points to an IRI not in the registry. Thrown on first use of a schema entry. |
| `GraphErrorCode.RECURSION_LIMIT`      | `RECURSION_LIMIT`           | |
| `GraphErrorCode.DIALECT_UNSUPPORTED`  | `DIALECT_UNSUPPORTED`       | |
| `GraphErrorCode.VOCABULARY_UNSUPPORTED` | `VOCABULARY_UNSUPPORTED`  | |
| `GraphErrorCode.ARTIFACT_INVALID`     | `ARTIFACT_INVALID`          | |
| `GraphErrorCode.ARTIFACT_STALE`       | `ARTIFACT_STALE`            | |
| _(direct string)_                     | `GRAPH_INVALID_RESTRICTION` | Thrown by `OwlProjection` when a restriction entry is missing a required `kind`, `onProperty`, or `value` field. See `src/types/ErrorCodes.ts`. |

<RunnableExample src="examples/docs/errors/17-graph-error" />

## `InstantiationError` <Badge type="tip" text="Runtime" />

**Thrown for.** Validation failure inside `instantiate()` - the trust-boundary entry point. Carries the full structured error list.

**Adds.** `errors: ValidationErrors` (the full `ValidationErrors` collection).

**Codes.** Always `INSTANTIATION_FAILED` at the wrapper level; per-error `keyword` values appear inside `errors.items`. Additional keyword codes recorded inside `errors.items`:

| Constant | Value | When recorded |
|----------|-------|---------------|
| `InstantiationErrorCode.EXTRA_FORBIDDEN` | `EXTRA_FORBIDDEN` | `jt:config.extra: 'forbid'` rejects unknown properties |

<RunnableExample src="examples/docs/errors/19-instantiation-error" />

The `errors` collection is the same `ValidationErrors` used by `validate()` - see [ValidationErrors views](/errors/views) for the full surface.

## `CoercionError` <Badge type="tip" text="Runtime" />

**Thrown for.** Coercion failure, raised by `value.cast()`, `value.convert()`, and their registry equivalents (`registry.cast`, `registry.convert`) when the coerced data does not satisfy the schema. Carries the full structured error list.

**Adds.** `errors: ValidationErrors` (the full `ValidationErrors` collection describing every constraint that coercion could not satisfy).

**Codes.**

| Constant | Value | Notes |
|----------|-------|-------|
| `CoercionErrorCode.COERCION_FAILED` | `COERCION_FAILED` | Always emitted at the wrapper level |

<RunnableExample src="examples/docs/errors/20-coercion-error" />

## `TransformError` <Badge type="tip" text="Runtime" />

**Thrown for.** Base class for directional transform failures. Not thrown directly by the library. See `DecodeError` and `EncodeError`.

**Extends.** `BaseError`.

**Adds.**

| Field | Type | Notes |
|-------|------|-------|
| `direction` | `'decode' \| 'encode'` | Which direction the transform was running when it failed |
| `schemaId` | `string \| undefined` | The `$id` of the schema whose transform failed; filled in by the library when absent |
| `path` | `string \| undefined` | JSON Pointer to the field being decoded/encoded, when known |

**Codes.**

| Constant | Value | Subclass |
|----------|-------|----------|
| `TransformErrorCode.TRANSFORM_DECODE_FAILED` | `TRANSFORM_DECODE_FAILED` | `DecodeError` |
| `TransformErrorCode.TRANSFORM_ENCODE_FAILED` | `TRANSFORM_ENCODE_FAILED` | `EncodeError` |

## `DecodeError` <Badge type="tip" text="Runtime" />

**Thrown for.** Failure inside a `decode` transform function, raised by `jt.instantiate()` when the registered decode function throws. The original throw is preserved on `cause`.

**Extends.** `TransformError` → `BaseError`.

**Constructor.** `new DecodeError(message: string, options?: { schemaId?, path?, cause?, retryable? })`.

**Fields.** `code === 'TRANSFORM_DECODE_FAILED'`, `direction === 'decode'`, plus `schemaId?`, `path?`, `cause?` inherited from `TransformError`.

**Consumer use.** Custom decode handlers may `throw new DecodeError('message', { path: '/field' })`. The library propagates the thrown instance unchanged: message, code, `path`, and any other fields set by the caller are preserved. Missing `schemaId` context is filled in automatically.

<<< ../../examples/docs/transforms/13-transform-errors.ts

## `EncodeError` <Badge type="tip" text="Runtime" />

**Thrown for.** Failure inside an `encode` transform function, raised by `jt.encode()` (and `dump`) when the registered encode function throws. The original throw is preserved on `cause`.

**Extends.** `TransformError` → `BaseError`.

**Constructor.** `new EncodeError(message: string, options?: { schemaId?, path?, cause?, retryable? })`.

**Fields.** `code === 'TRANSFORM_ENCODE_FAILED'`, `direction === 'encode'`, plus `schemaId?`, `path?`, `cause?` inherited from `TransformError`.

**Consumer use.** Custom encode handlers may `throw new EncodeError('message')`. The library propagates the thrown instance unchanged.

## `MaterializationError` <Badge type="tip" text="Runtime" />

**Thrown for.** Materialization failure - the result of `materialize()` (or ABox projection) failed validation.

**Adds.** `schemaId: string` and `validationErrors: string[]` (formatted `path: message` strings).

**Codes.**

| Value | When thrown |
|-------|-------------|
| `MATERIALIZATION_FAILED` | Default materialization failure |
| `CYCLIC_DATA` | Circular reference detected during ABox projection (`toQuads`). Thrown by `Projection` when a data object contains a cycle that would loop indefinitely during RDF quad emission. See `src/types/ErrorCodes.ts`. |

<RunnableExample src="examples/docs/errors/21-materialization-error" />

## Inspecting the cause chain

Every error supports `flatten()`, which walks the cause chain and returns a root-first array of plain objects suitable for structured logging.

<RunnableExample src="examples/docs/errors/22-flatten-cause-chain" />

`InstantiationError.flatten()` and `CoercionError.flatten()` additionally append every item in their `errors` collection, so a single call surfaces both the wrapper and each underlying validation issue.

## Related

- [ValidationErrors overview](/errors/) - the collection embedded inside `InstantiationError` and `CoercionError`
- [ValidationErrors views](/errors/views) - `aggregate()` and `report()` projections

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in catch examples
