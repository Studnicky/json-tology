# Computed Fields

Computed fields are properties derived from other fields at coerce/materialize time — similar to Pydantic's `@computed_field`.

## Authoring

Mark a property with `"jt:computed": true`. Omit it from `required` — its value is always supplied by the registered compute function.

```ts
const Order = {
  $id: 'https://ex.io/Order',
  type: 'object',
  properties: {
    items: { type: 'array', items: { $ref: 'https://ex.io/Item' } },
    total: { type: 'number', 'jt:computed': true }
  },
  required: ['items']
} as const;
```

## Registering compute functions

Pass `computeds` at construction time:

```ts
const jt = JsonTology.create({
  baseIRI: 'https://ex.io',
  schemas: [Item, Order] as const,
  computeds: {
    'https://ex.io/Order': {
      total: (order) => (order.items as Array<{ price: number }>)
        .reduce((sum, item) => sum + item.price, 0)
    }
  }
});
```

Or imperatively after construction:

```ts
jt.addComputed('https://ex.io/Order', 'total', (order) => ...);
jt.removeComputed('https://ex.io/Order', 'total');
```

## Behaviour

| Situation | Result |
|-----------|--------|
| Input omits the computed field | Value is derived and injected |
| Input supplies the computed field | `CoercionError` with `COMPUTED_INPUT_FORBIDDEN` |
| Compute function throws | `CoercionError` wrapping the original error |
| Schema registered with `jt:computed` but no fn | `SchemaError` with `COMPUTED_FN_MISSING` at registration |

Computed fields are applied after structural validation in both `coerce()` and `materialize()`. They re-run on every call — no caching.

## Graph representation

Each property node with `jt:computed: true` has `computed: true` on its `SchemaGraphSemanticsInterface`. Serializers and visualization tools can use this flag to annotate computed properties.
