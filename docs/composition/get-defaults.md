# `Compose.getDefaults`

**Declaration.** Extracts declared `default` values from a schema's `properties`, returning a plain object containing only the properties that have a `default` keyword declared. Properties without defaults are omitted. Nested object properties with their own `default`-bearing children are recursively traversed.

**Use this when** you want to pre-populate form fields with schema defaults before the user has provided any input — without running a full coerce that would fail on missing required fields. This is the lightweight alternative to `jt.materialize(schema)` when you only want explicit defaults and not zero-value synthesis.

**Don't use this when** you want zero-values for all required fields (use [`jt.value.create`](/value/create)). Don't use it when you want a full materialized instance (use [`jt.materialize`](/registry/materialize)).

## Examples

### Example 1: Pre-populate a new Book form

`BookSchema` has `currency: 'USD'` and `inStock: true`. `isbn`, `title`, `authors`, and `price` have no declared defaults — they are omitted from the result.

```ts
import { Compose } from 'json-tology';
import { BookSchema } from './bookstore/index.js';

const defaults = Compose.getDefaults(BookSchema);
console.log(defaults);
// { currency: 'USD', inStock: true }

// Initialize form state with defaults pre-filled, others empty:
const formState = {
  ...defaults,
  isbn:    '',
  title:   '',
  authors: [],
  price:   0,
};
```

### Example 2: Pre-populate an Order form

```ts
import { Compose } from 'json-tology';
import { OrderSchema } from './bookstore/index.js';

const defaults = Compose.getDefaults(OrderSchema);
console.log(defaults);
// { currency: 'USD' }
// id, customerId, items, total, placedAt have no defaults — absent from result
```

### Example 3: Nested defaults are traversed

```ts
import { Compose } from 'json-tology';

const SettingsSchema = {
  $id: 'https://bookstore.example/Settings',
  type: 'object',
  properties: {
    theme: { type: 'string', default: 'light' },
    notifications: {
      type: 'object',
      properties: {
        email:  { type: 'boolean', default: true },
        push:   { type: 'boolean', default: false },
      },
    },
  },
} as const;

const defaults = Compose.getDefaults(SettingsSchema);
// { theme: 'light', notifications: { email: true, push: false } }
```

## Bad examples — what NOT to do

### Anti-pattern 1: Using getDefaults as a substitute for coerce/materialize

```ts
// ⊥ Don't do this — getDefaults returns only declared defaults, not all fields
const partial = Compose.getDefaults(CustomerSchema);
// partial === {} — Customer has no declared defaults (addresses has default [])
// This is NOT a valid Customer object

// ✓ Do this for a blank Customer form:
const blank = jt.value.create(CustomerSchema.$id);
// → { id: '', email: '', name: '', addresses: [] }
```

## Comparison

::: code-group

```ts [json-tology]
Compose.getDefaults(BookSchema)
// { currency: 'USD', inStock: true }
// Only properties with declared `default` values
```

```ts [Zod]
// Not directly supported — Zod doesn't expose a getDefaults utility.
// Workaround: schema.parse({}) — but fails on missing required fields.
// Manual extraction:
const defaults = { currency: 'USD', inStock: true };
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
// Value.Default fills ALL fields including zero-values, not just declared defaults:
Value.Default(BookSchema, {})
// → { isbn: undefined, title: undefined, ..., currency: 'USD', inStock: true }
// More fields than getDefaults
```

```ts [AJV]
// Not directly supported.
// AJV applies defaults during validation but doesn't expose a standalone getter.
```

```py [Pydantic]
# Extract defaults from model fields:
from pydantic._internal._fields import PydanticUndefined

defaults = {
    name: field.default
    for name, field in Book.model_fields.items()
    if field.default is not PydanticUndefined
}
# { 'currency': 'USD', 'in_stock': True }
```

:::

## Related

- [`jt.materialize`](/registry/materialize) — build a full instance from partial data + defaults
- [`jt.value.create`](/value/create) — synthesize zero-values for all required fields + explicit defaults

## See also

- [Bookstore domain](/bookstore-domain) — `BookSchema` and `OrderSchema` defaults
- [Composition index](/composition/) — overview of all composition operations
