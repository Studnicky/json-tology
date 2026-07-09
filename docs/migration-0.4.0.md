# Migration to 0.4.0

0.4.0 is a pre-1.0 release. The breaking changes listed here follow the project's clean-break policy: removed symbols are gone with no shims or deprecation wrappers.

## Node.js requirement

`engines.node` is now `>=24.0.0`. Node 16, 18, and 20 are no longer supported.

Update your deployment environment and CI matrix before upgrading.

## Renamed options

### `subjectIRI` → `iriFor`

The `subjectIRI` option on `toQuads` / `fromQuads` call sites is removed. Use `iriFor` instead.

The string, `'blank-node'`, and `SkolemizeFnType` overloads are identical - only the option name changes.

<!-- inline-ts-ok: demonstrates removed/legacy subjectIRI option on toQuads; preserved as migration context. -->
```ts
// Before
jt.toQuads(CustomerSchema, data, { subjectIRI: 'https://example.com/customers/' });

// After
jt.toQuads(CustomerSchema, data, { iriFor: 'https://example.com/customers/' });
```

The same rename applies to the `JsonTology.create` constructor option:

<!-- inline-ts-ok: demonstrates removed/legacy subjectIRI option on JsonTology.create; preserved as migration context. -->
```ts
// Before
JsonTology.create({ baseIRI: '...', subjectIRI: myFn });

// After
JsonTology.create({ baseIRI: '...', iriFor: myFn });
```

### `maxDepth` → `maxSchemaDepth`

The `maxDepth` option alias is removed. Use `maxSchemaDepth`. The semantics are identical - the rename aligns the option name with its scope.

<!-- inline-ts-ok: demonstrates removed/legacy maxDepth alias on JsonTology.create; preserved as migration context. -->
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

<!-- inline-ts-ok: demonstrates removed/legacy CoercionErrorCodeType union type; compile-time import rename, not a runnable expression. -->
```ts
// Before
import type { CoercionErrorCodeType } from 'json-tology/types';

// After
import type { InstantiationErrorCodeType } from 'json-tology/types';
```

### `COERCION_ERROR_CODE` constant

The `CoercionErrorCodeType` *type* union from before 0.4.0 is removed and replaced by `InstantiationErrorCodeType` for instantiation codes. The `CoercionError` *class* continues to exist and throws code `'COERCION_FAILED'`: it has not been removed. `COERCION_ERROR_CODE` is now a first-class exported constant for matching against `'COERCION_FAILED'`.

<!-- inline-ts-ok: demonstrates removed/legacy CoercionErrorCodeType union type; preserved as migration context alongside current COERCION_ERROR_CODE usage. -->
```ts
// Before
import type { CoercionErrorCodeType } from 'json-tology/types';

// After
import { COERCION_ERROR_CODE } from 'json-tology';
if (err.code === COERCION_ERROR_CODE.COERCION_FAILED) { ... }
```

## Renamed factory functions

The `make*Schema` free functions are removed. The `BaseTypes` namespace replaces them.

| Removed | Replacement |
|---------|-------------|
| `makeResponseSchema(dataSchema)` | `BaseTypes.response(dataSchema)` |
| `makeResultSchema(dataSchema)` | `BaseTypes.result(dataSchema)` |
| `makePageSchema(dataSchema)` | `BaseTypes.page(dataSchema)` |

<!-- inline-ts-ok: demonstrates removed/legacy makeResponseSchema/makeResultSchema/makePageSchema factory functions; BaseTypes.response now requires two arguments (body schema + $id string), so the After snippet is also not directly runnable as shown. -->
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

<!-- inline-ts-ok: demonstrates removed/legacy unknown return type requiring manual cast; both Before/After shown as migration context illustrating the static generic inference introduced in 0.4.0. -->
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
