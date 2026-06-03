# `jt.dump` and `jt.dumpJson`

`dump` and `dumpJson` are a symmetric pair with `instantiate`: `instantiate` ingests and decodes wire data; `dump` / `dumpJson` encodes domain data back to wire form.

---

## `jt.dump` {#jt-dump}

**Declaration.** Walks the canonical schema graph for the given `schemaId`, applies any registered `Transform` encoder at each node, filters the result according to options, and returns the brand-free wire **InputType** (`LooseInputType<…>`) — the wire-form JS value, never `unknown`. The input `value` is not mutated.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'wire' \| 'json'` | `'wire'` | `'json'` converts `Date` values to ISO strings for `JSON.stringify` safety |
| `exclude` | `readonly string[]` | - | Property names to drop (ignored when `include` is set) |
| `include` | `readonly string[]` | - | Property names to keep (takes precedence over `exclude`) |
| `excludeUnset` | `boolean` | `false` | Drop properties whose runtime value is `undefined` |
| `excludeDefaults` | `boolean` | `false` | Drop properties whose value strictly equals the schema `default` |

**Use this when** you need to serialize a domain object back to wire form - before storing in a database, before sending over HTTP, before publishing to a queue. Use the filtering options to produce compact payloads or specific projections. Use `dumpJson` when you need a JSON string directly.

**Don't use this when** you want a complete validated object (use `instantiate` instead - it goes the other direction). Don't call it on raw unvalidated input - `dump` expects a value that has already been through `instantiate` or `materialize`.

### Examples

#### Example 1: Basic serialization of a coerced book

<RunnableExample src="examples/docs/serialization/01-dump" />

#### Example 2: Compact payload - exclude default-valued fields

<RunnableExample src="examples/docs/serialization/03-dump-exclude-defaults" />

#### Example 3: Project to specific fields

<RunnableExample src="examples/docs/serialization/04-dump-include-projection" />

#### Example 4: Transform integration - `encode` applied automatically

If the schema has a `Transform` encoder registered (see [Transforms](/transforms/decode-encode)), `dump` applies the `encode` function at each transformed node. A `instantiate` → `dump` round-trip recovers the original wire value.

<RunnableExample src="examples/docs/serialization/05-dump-transform-encode" />

### Bad examples - what NOT to do

#### Anti-pattern 1: Calling dump on raw (uninstantiated) input

<RunnableExample src="examples/docs/serialization/06-dump-antipattern-raw-input" />

### Comparison

::: code-group

```ts [json-tology]
const wire = jt.dump(BookSchema.$id, book);
const wire2 = jt.dump(BookSchema.$id, book, { excludeDefaults: true });
const json = jt.dumpJson(BookSchema.$id, book); // JSON string
```

```ts [Zod]
// Zod doesn't have a separate dump/serialize step.
// The parsed value is already in the desired shape.
const json = JSON.stringify(book);
// No exclude/include filtering without manual code.
```

```ts [Valibot]
// Limitation: Valibot has no dump/serialize step and no encode direction.
// JSON.stringify the value directly; encoding of branded or transformed
// fields (e.g. Date) must be applied manually before stringify.
const json = JSON.stringify(book);
```

```ts [io-ts]
// Limitation: io-ts has no dump step that walks a graph and applies encoders.
// Each codec exposes .encode for itself; for a composite, call .encode at
// the top level then JSON.stringify. No filtering options.
const wire = BookCodec.encode(book);
const json = JSON.stringify(wire);
```

```ts [TypeBox + Value]
// TypeBox does not have a built-in dump/serialize utility.
const json = JSON.stringify(book);
```

```ts [AJV]
// AJV validates  - no serialize step.
const json = JSON.stringify(book);
```

```py [Pydantic]
wire = book.model_dump()
json_str = book.model_dump_json()
# Filtering options:
book.model_dump(exclude={'currency', 'in_stock'})
book.model_dump(include={'isbn', 'title', 'price'})
book.model_dump(exclude_defaults=True)
book.model_dump(exclude_none=True)
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

---

## `jt.dumpJson` {#jt-dumpjson}

**Declaration.** Convenience wrapper around `dump()` with `mode: 'json'` forced. Equivalent to `JSON.stringify(jt.dump(schemaId, value, { mode: 'json', ...options }))`. Returns a JSON string. The `mode` option is not available on `dumpJson` - it is always `'json'`.

**Use this when** you need a JSON string directly - HTTP response bodies, log records, message queue payloads.

### Examples

#### Example 1: Serialize a customer for an HTTP response

<RunnableExample src="examples/docs/serialization/07-dumpjson-http-response" />

#### Example 2: Compact order payload

<RunnableExample src="examples/docs/serialization/08-dumpjson-compact-order" />

### Comparison

::: code-group

```ts [json-tology]
const json = jt.dumpJson(CustomerSchema.$id, customer);
// JSON string; Date fields encoded to ISO via Transform encoders
```

```ts [Zod]
const json = JSON.stringify(customer);
// Date objects must be converted manually before stringify.
```

```ts [Valibot]
// Limitation: no dumpJson; JSON.stringify works only for plain values.
const json = JSON.stringify(customer);
```

```ts [io-ts]
// Limitation: no dumpJson convenience; combine .encode and JSON.stringify.
const json = JSON.stringify(CustomerCodec.encode(customer));
```

```ts [TypeBox + Value]
const json = JSON.stringify(customer);
```

```ts [AJV]
const json = JSON.stringify(customer);
```

```py [Pydantic]
json_str = customer.model_dump_json()
# Equivalent; datetime fields serialized to ISO automatically.
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

- [`JsonTology.instantiate`](/validation/instantiate) - the incoming direction (wire → domain)
- [`jt.encode`](/transforms/decode-encode#jtencode) - apply a single Transform encoder
- [Transforms](/transforms/decode-encode) - how Transform encoders are registered and applied

## See also

- [Bookstore domain](/bookstore-domain) - where `Book`, `Customer`, `Order` are defined
