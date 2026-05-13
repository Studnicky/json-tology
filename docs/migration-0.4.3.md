# Migration to 0.4.3

0.4.3 is a pre-1.0 release. The breaking changes listed here follow the project's clean-break policy: removed symbols are gone with no shims or deprecation wrappers.

## `Transform.pipe` renamed to `Transform.chain`

The `pipe` method name conflicted with the Node.js stream `.pipe()` convention. The semantic is chaining transform stages sequentially — `chain` reads correctly.

### Method rename

```ts
// Before
const schema = Transform.pipe(BaseSchema, [stage1, stage2] as const);

// After
const schema = Transform.chain(BaseSchema, [stage1, stage2] as const);
```

### Type renames

The supporting compile-time types are similarly renamed:

| Before | After |
|--------|-------|
| `PipeChainMismatchInterface` | `ChainMismatchInterface` |
| `PipeChainSchemaMismatchInterface` | `ChainSchemaMismatchInterface` |
| `ValidatePipeChainType` | `ValidateChainType` |
| `PipeChainOutputType` | `ChainOutputType` |
| `PipeChainRecursionCap` | `ChainRecursionCap` |

Update any type imports accordingly:

```ts
// Before
import type { PipeChainMismatchInterface, PipeChainSchemaMismatchInterface } from 'json-tology/types';

// After
import type { ChainMismatchInterface, ChainSchemaMismatchInterface } from 'json-tology/types';
```

### Migration steps

1. Replace every `Transform.pipe(` call with `Transform.chain(`.
2. Rename type imports as shown in the table above.
3. Update any IDE hover text or error message references that cite `PipeChainMismatch` — they now read `ChainMismatch`.

No runtime behaviour changes — the composed decode (left-to-right) and encode (right-to-left) semantics are identical.
