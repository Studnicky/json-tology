# Picking a method

Where does the data come from?

| Source | Method | Returns |
|---|---|---|
| Outside (HTTP, queue, file) | `entities.instantiate(id, data)` | T (throws on invalid) |
| Inside (your code, test fixtures) | `entities.materialize(s, data)` | T (validates by default) |
| Doesn't matter - you want errors-without-throw | `entities.validate(id, data)` | ValidationErrors |
| Doesn't matter - you want a yes/no | `entities.is(id, data)` | boolean |

## The trust boundary axis

**`instantiate`** is for data crossing into your system from outside - HTTP request bodies, queue messages, file imports, IPC payloads. Trust boundary: the data came from somewhere you don't control. Failure is the caller's contract violation. The error is theirs to handle.

**`materialize`** is for data you produced - test fixtures, form scaffolding, default-filled instances. Construction helper: failure is your own bug. Validates by default and throws `MaterializationError` if validation fails. Pass `{ enablePartial: true }` to allow missing required-without-default fields during lenient construction.

## Decision recipes

### HTTP request handler

```ts
import { InstantiationError } from 'json-tology';

async function createOrder(req: Request, res: Response) {
  let order: Order;

  try {
    order = entities.instantiate(OrderSchema.$id, await req.json()) as Order;
  } catch (err) {
    if (err instanceof InstantiationError) {
      return res.status(400).json(err.toJson());
    }
    throw err;
  }

  await db.orders.insert(order);
  res.status(201).json(order);
}
```

### Test fixture

```ts
const testOrder = entities.materialize(OrderSchema, {
  customerId: 'cust-1',
  // items omitted  - defaults applied
});
// testOrder has all required fields filled; validation passed
```

### Lenient partial construction

```ts
// Build a partial order for form scaffolding  - missing required fields OK
const scaffold = entities.materialize(OrderSchema, { customerId: 'cust-1' }, { enablePartial: true });
```

### Logging / analytics (no throw needed)

```ts
const errors = entities.validate(OrderSchema.$id, incoming);

if (!errors.ok) {
  logger.warn('Invalid order payload', { errors: errors.items });
}
```

## When to use `is`

`is` is a TypeScript type guard. Use it when you need to narrow a union type or check
unknown input without triggering a throw:

```ts
if (entities.is(OrderSchema.$id, data)) {
  // data is narrowed to Order here
  processOrder(data);
}
```

## Related

- [`instantiate`](/validation/instantiate) - trust-boundary coercion entry point
- [`materialize`](/registry/materialize) - construction helper for trusted data
- [`validate`](/validation/validate) - structured errors without a throw
- [`is`](/validation/is) - boolean type guard

## See also

- [Argument conventions](/argument-conventions) - static counterparts and `SchemaRef`
- [Bookstore domain](/bookstore-domain) - schemas used in examples
- [Error views](/errors/views) - what to do with `ValidationErrors` after `validate`
