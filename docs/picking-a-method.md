# Picking a method

Where does the data come from?

| Source | Method | Returns |
|---|---|---|
| Outside (HTTP, queue, file) | `entities.instantiate(id, data)` | T (throws on invalid) |
| Inside (your code, test fixtures) | `entities.materialize(s, data)` | T (validates by default) |
| Doesn't matter - you want errors-without-throw | `entities.validate(id, data)` | ValidationErrors |
| Doesn't matter - you want a yes/no | `entities.is(id, data)` | boolean |

## The trust boundary axis

**`instantiate`** is for data crossing into your system from outside - HTTP request bodies, queue messages, file imports, IPC payloads. **`materialize`** is for data you produced - test fixtures, form scaffolding, default-filled instances. See [instantiate vs materialize](/instantiate-vs-materialize) for the decode-step and `enablePartial` mechanics.

## Decision recipes

### HTTP request handler

<RunnableExample src="examples/docs/picking-a-method/02-http-handler-instantiate" />

### Test fixture

<RunnableExample src="examples/docs/picking-a-method/03-test-fixture-materialize" />

### Lenient partial construction

<RunnableExample src="examples/docs/picking-a-method/04-partial-materialize" />

### Logging / analytics (no throw needed)

<RunnableExample src="examples/docs/picking-a-method/05-validate-no-throw" />

## When to use `is`

`is` is a TypeScript type guard. Use it when you need to narrow a union type or check
unknown input without triggering a throw:

<RunnableExample src="examples/docs/picking-a-method/06-is-type-guard" />

## Related

- [`instantiate`](/validation/instantiate) - trust-boundary coercion entry point
- [`materialize`](/registry/materialize) - construction helper for trusted data
- [`validate`](/validation/validate) - structured errors without a throw
- [`is`](/validation/is) - boolean type guard
- [instantiate vs materialize](/instantiate-vs-materialize) - decision table with Transform decoder detail

## See also

- [Argument conventions](/argument-conventions) - static counterparts and `SchemaRef`
- [Bookstore domain](/bookstore-domain) - schemas used in examples
- [Error views](/errors/views) - what to do with `ValidationErrors` after `validate`
