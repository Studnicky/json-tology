# Migration to 0.4.0

0.4.0 is a pre-1.0 release. The breaking changes listed here follow the project's clean-break policy: removed symbols are gone with no shims or deprecation wrappers.

## Node.js requirement

`engines.node` is now `>=24.0.0`. Node 16, 18, and 20 are no longer supported.

Update your deployment environment and CI matrix before upgrading.

## Renamed options

### `subjectIRI` → `iriFor`

The `subjectIRI` option on `toQuads` / `fromQuads` call sites is removed. Use `iriFor` instead.

The string, `'blank-node'`, and `SkolemizeFnType` overloads are identical - only the option name changes.

```ts
// Before
jt.toQuads(CustomerSchema, data, { subjectIRI: 'https://example.com/customers/' });

// After
jt.toQuads(CustomerSchema, data, { iriFor: 'https://example.com/customers/' });
```

The same rename applies to the `JsonTology.create` constructor option:

```ts
// Before
JsonTology.create({ baseIRI: '...', subjectIRI: myFn });

// After
JsonTology.create({ baseIRI: '...', iriFor: myFn });
```

### `maxDepth` → `maxSchemaDepth`

The `maxDepth` option alias is removed. Use `maxSchemaDepth`. The semantics are identical - the rename aligns the option name with its scope.

```ts
// Before
JsonTology.create({ baseIRI: '...', maxDepth: 10 });

// After
JsonTology.create({ baseIRI: '...', maxSchemaDepth: 10 });
```

## Removed options

### `maxDataDepth`

`maxDataDepth` is removed entirely. The option was declared in `JsonTologyOptionsInterface` but was never wired into the execution path. Any assignment to `maxDataDepth` in your configuration can be deleted - the field was a no-op.

The `MaterializationError` code `DATA_DEPTH_EXCEEDED` is removed alongside it.

## Renamed error types and constants

### `CoercionErrorCodeType` → `InstantiationErrorCodeType`

The `CoercionErrorCodeType` union type is removed. Use `InstantiationErrorCodeType`.

```ts
// Before
import type { CoercionErrorCodeType } from 'json-tology/types';

// After
import type { InstantiationErrorCodeType } from 'json-tology/types';
```

### `CoercionErrorCode` constant removed

The `CoercionErrorCodeType` *type* is removed and replaced by `InstantiationErrorCodeType`. The `CoercionError` *class* continues to exist and throws code `'COERCION_FAILED'`: it has not been removed. No `CoercionErrorCode` constant object ever existed in the public API; use `InstantiationErrorCode` for code lookup if needed.

```ts
// Before
import type { CoercionErrorCodeType } from 'json-tology/types';
// (no CoercionErrorCode constant was ever exported)

// After
import { InstantiationErrorCode } from 'json-tology';
if (err.code === InstantiationErrorCode.EXTRA_FORBIDDEN) { ... }
```

## Renamed factory functions

The `make*Schema` free functions are removed. The `BaseTypes` namespace replaces them.

| Removed | Replacement |
|---------|-------------|
| `makeResponseSchema(dataSchema)` | `BaseTypes.response(dataSchema)` |
| `makeResultSchema(dataSchema)` | `BaseTypes.result(dataSchema)` |
| `makePageSchema(dataSchema)` | `BaseTypes.page(dataSchema)` |

```ts
// Before
import { makeResponseSchema, makeResultSchema, makePageSchema } from 'json-tology';
const ApiResponse = makeResponseSchema(UserSchema);

// After
import { BaseTypes } from 'json-tology';
const ApiResponse = BaseTypes.response(UserSchema);
```

## Static facade generics

`JsonTology.dump`, `JsonTology.fromQuads`, `JsonTology.instantiate`, and `JsonTology.materialize` are now generic over the supplied schema and return the inferred type instead of `unknown`. Callers that previously cast the return value can remove the cast.

```ts
// Before — return was `unknown`, cast required
const user = JsonTology.instantiate(UserSchema, raw) as User;

// After — return type is inferred from the schema
const user = JsonTology.instantiate(UserSchema, raw); // typed as InferType<typeof UserSchema>
```

No call-site changes are required for TypeScript to pick up the narrower return type - the generics are inferred automatically. Only remove casts that previously worked around `unknown`.

## Related

- [Getting started](/getting-started) - updated option table reflecting current names
- [Validation modes](/validation-modes) - the badge system introduced in 0.4.0
- [Constraint brands](/constraint-brands) - 25 new named format brands
