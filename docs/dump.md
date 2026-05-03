# Dump

`jt.dump()` serializes a validated JS value back to its wire form — the Pydantic `model_dump()` equivalent.

It walks the canonical graph for the schema, applies any registered `Transform` encoder at each node, and filters the result according to the supplied options.

## Signature

```ts
jt.dump(schemaId, value, options?)   // returns unknown (wire-form JS value)
jt.dumpJson(schemaId, value, options?) // returns string (JSON)
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'wire' \| 'json'` | `'wire'` | `'json'` converts `Date` values to ISO strings and returns a `JSON.stringify`-safe tree. |
| `exclude` | `readonly string[]` | — | Property names to drop. Ignored when `include` is set. |
| `include` | `readonly string[]` | — | Property names to keep (all others dropped). Takes precedence over `exclude`. |
| `excludeUnset` | `boolean` | `false` | Drop properties whose runtime value is `undefined`. |
| `excludeDefaults` | `boolean` | `false` | Drop properties whose value strictly equals the schema `default`. |

## Example

```ts
import { JsonTology, Transform } from 'json-tology';

const UserSchema = {
  $id: 'https://example.com/User',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    role:  { type: 'string', default: 'viewer' },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['name'],
} as const;

const jt = JsonTology.create({ baseIRI: 'https://example.com', schemas: [UserSchema] as const });

const user = jt.coerce(UserSchema.$id, { name: 'Alice', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' });

// Wire form — structurally identical to the coerced value
jt.dump(UserSchema.$id, user);

// Drop properties with schema defaults
jt.dump(UserSchema.$id, user, { excludeDefaults: true });
// → { name: 'Alice', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' }

// JSON string, safe to send over the wire
jt.dumpJson(UserSchema.$id, user);
// → '{"name":"Alice","role":"admin","createdAt":"2026-01-01T00:00:00.000Z"}'
```

## Transform integration

If the schema has a `Transform` decoder registered, `dump()` applies its `encode` function to project the decoded value back to wire form. A `coerce()` → `dump()` round-trip recovers the original wire value.

```ts
const DateSchema = Transform.create(
  { $id: 'https://example.com/Date', type: 'string', format: 'date-time' } as const,
  { decode: (s: string) => new Date(s), encode: (d: Date) => d.toISOString() },
);

const date = jt.coerce(DateSchema.$id, '2026-06-01T00:00:00.000Z'); // Date
jt.dump(DateSchema.$id, date); // '2026-06-01T00:00:00.000Z'
```
