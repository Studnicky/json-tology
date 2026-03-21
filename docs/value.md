# Value Operations

`Value` provides pure static methods for cloning, hashing, and diffing arbitrary values, plus schema-aware instance methods for coercion, casting, and cleaning data against registered schemas.

## Simple

`Value.clone()` deep-copies objects, `Value.hash()` produces deterministic hashes, and `Value.diff()` computes structural diffs.

```ts
import { Value } from 'json-tology';

const original = { name: 'Alice', scores: [10, 20] };

// Deep clone via structuredClone
const copy = Value.clone(original);
copy.scores.push(30);
console.log(original.scores.length); // 2 — original unchanged

// Deterministic FNV-1a hash (sorted keys, hex string)
const h1 = Value.hash({ b: 2, a: 1 });
const h2 = Value.hash({ a: 1, b: 2 });
console.log(h1 === h2); // true — key order does not matter

// Structural diff
const before = { name: 'Alice', role: 'user' };
const after = { name: 'Alice', role: 'admin', active: true };
const changes = Value.diff(before, after);

console.log(changes.isEmpty);  // false
console.log(changes.length);   // 2 — one set (role), one set (active)
console.log(changes.operations);
// [
//   { op: 'set', path: '/role', value: 'admin' },
//   { op: 'set', path: '/active', value: true }
// ]
```

## Typical

The `jt.value` instance provides schema-aware operations. `cast()` coerces types and fills defaults. `clean()` strips unknown properties. `create()` synthesizes a zero-value instance.

```ts
import { JsonTology, type InferType } from 'json-tology';

const ProductSchema = {
  $id: 'https://shop.io/Product',
  type: 'object',
  properties: {
    name:     { type: 'string' },
    price:    { type: 'number' },
    currency: { type: 'string', default: 'USD' },
    active:   { type: 'boolean', default: true },
  },
  required: ['name', 'price'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://shop.io',
  schemas: [ProductSchema] as const,
  castTypes: true,
});

type Product = InferType<typeof ProductSchema>;

// cast — coerce types + fill defaults
const casted = jt.value.cast(ProductSchema.$id, {
  name: 'Widget',
  price: '9.99', // string coerced to number
});
// => { name: 'Widget', price: 9.99, currency: 'USD', active: true }

// clean — strip unknown properties
const cleaned = jt.value.clean(ProductSchema.$id, {
  name: 'Widget',
  price: 9.99,
  currency: 'USD',
  active: true,
  _internal: 'remove me',
});
// => { name: 'Widget', price: 9.99, currency: 'USD', active: true }

// convert — coerce types only, no defaults
const converted = jt.value.convert(ProductSchema.$id, {
  name: 'Widget',
  price: '9.99',
});
// => { name: 'Widget', price: 9.99 }

// create — synthesize zero-value defaults for all required properties
const blank = jt.value.create(ProductSchema.$id);
// => { name: '', price: 0, currency: 'USD', active: true }

// coerce — validate + defaults + strip unknowns (same as jt.coerce)
const parsed = jt.value.coerce(ProductSchema.$id, {
  name: 'Widget',
  price: 9.99,
  extra: 'gone',
});
// => { name: 'Widget', price: 9.99, currency: 'USD', active: true }

// Apply a changeset
const v1 = { name: 'Widget', price: 9.99 };
const v2 = { name: 'Widget', price: 14.99 };
const changeset = Value.diff(v1, v2);
const result = changeset.apply(v1);
console.log(result); // { name: 'Widget', price: 14.99 }
```

## Advanced

`Value` works standalone with a separate `SchemaRegistry` (no facade). `Hash` is available as a standalone class. Changesets support selective operation application.

```ts
import { Value, Hash, Changeset } from 'json-tology/value';
import { SchemaRegistry } from 'json-tology/schema';

// Hash class — same as Value.hash(), available separately
const digest = Hash.value({ id: 1, data: [10, 20] });
console.log(digest); // hex string

// Standalone Value with own registry
const registry = new SchemaRegistry({ castTypes: true });

const TaskSchema = {
  $id: 'https://app.io/Task',
  type: 'object',
  properties: {
    title:    { type: 'string' },
    priority: { type: 'integer', default: 0 },
    done:     { type: 'boolean', default: false },
    tags:     { type: 'array', items: { type: 'string' }, default: [] },
  },
  required: ['title'],
} as const;

registry.register(TaskSchema);

const value = new Value(registry);
const task = value.coerce(TaskSchema.$id, { title: 'Ship it' });
// => { title: 'Ship it', priority: 0, done: false, tags: [] }

// Diff + selective apply
const before = {
  title: 'Ship it',
  priority: 0,
  done: false,
  tags: ['backend'],
};

const after = {
  title: 'Ship it',
  priority: 2,
  done: true,
  tags: ['backend', 'urgent'],
};

const changeset = Value.diff(before, after);

// Inspect operations and apply only specific ones
for (const op of changeset.operations) {
  console.log(op.op, op.path);
}
// set /priority
// set /done
// set /tags/1

// Apply a single operation manually
const partial = Value.applyOp(
  Value.clone(before),
  { op: 'set', path: '/priority', value: 2 },
);
// => { title: 'Ship it', priority: 2, done: false, tags: ['backend'] }

// Apply the full changeset (clones internally, never mutates input)
const fullyPatched = changeset.apply(before);
console.log(fullyPatched);
// => { title: 'Ship it', priority: 2, done: true, tags: ['backend', 'urgent'] }
```
