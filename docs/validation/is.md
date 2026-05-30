# `JsonTology.is` <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Validates data against a registered schema and returns a boolean. When the schema is registered via `JsonTology.create({ schemas })`, the return type is a TypeScript type predicate (`data is TMap[K]`), which narrows the type of `data` to the schema's inferred type inside the `if` block. Does not mutate input. Does not throw on validation failure.

**Use this when** you need a boolean check and you want TypeScript to narrow the type inside the truthy branch - for example, in union-narrowing guards, array filters, middleware checks. This is the idiomatic pattern when you need "is this data the right shape?" without wanting errors or a coerced value.

**Don't use this when** you need error details (use [`validate`](/validation/validate) instead). Don't use it when you need the coerced, defaults-filled value (use [`instantiate`](/validation/instantiate) instead). Invariants also run: `is` returns `false` when any registered invariant fails, not just when structural validation fails.

## Examples

### Example 1: Type narrowing in a conditional branch

<RunnableExample src="examples/docs/validation/28-is-type-narrowing" />

### Example 2: Filtering an array of unknowns

<RunnableExample src="examples/docs/validation/29-is-array-filter" />

### Example 3: Guards at a service boundary

<RunnableExample src="examples/docs/validation/30-is-service-boundary" />

## Bad examples - what NOT to do

### Anti-pattern 1: Using `is` when you need the coerced (defaults-filled) value

<RunnableExample src="examples/docs/validation/31-is-antipattern-no-defaults" />

### Anti-pattern 2: Checking `is` and then immediately coercing

<RunnableExample src="examples/docs/validation/32-is-antipattern-double-validate" />

## Comparison

::: code-group

```ts [json-tology]
if (jt.is(CustomerSchema.$id, data)) {
  data.name; // typed as string  - narrowed by is()
}
```

```ts [Zod]
const result = CustomerSchema.safeParse(data);
if (result.success) {
  result.data.name; // typed via result.data  - data itself is not narrowed
}
// Or write a wrapper type predicate:
function isCustomer(d: unknown): d is Customer {
  return CustomerSchema.safeParse(d).success;
}
```

```ts [Valibot]
import * as v from 'valibot';
if (v.is(CustomerSchema, data)) {
  data.name; // narrowed to Customer
}
```

```ts [io-ts]
// io-ts codecs expose `.is` as a type guard:
if (CustomerCodec.is(data)) {
  data.name; // narrowed to t.TypeOf<typeof CustomerCodec>
}
// Note: .is checks runtime shape directly without producing decoded output.
```

```ts [TypeBox + Value]
import { TypeCompiler } from '@sinclair/typebox/compiler';
const C = TypeCompiler.Compile(CustomerSchema);
if (C.Check(data)) {
  data; // narrowed to Customer
}
```

```ts [AJV]
// ajv.validate returns boolean but doesn't narrow the TypeScript type.
// Write a type predicate wrapper:
function isCustomer(data: unknown): data is Customer {
  return ajv.validate('Customer', data) as boolean;
}
if (isCustomer(data)) {
  data.name; // typed
}
```

```py [Pydantic]
# Python uses try/except rather than a boolean predicate:
try:
    customer = Customer.model_validate(data)
    # customer is typed as Customer
except ValidationError:
    pass  # not a valid customer
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

- [`JsonTology.validate`](/validation/validate) - returns structured `ValidationErrors` when you need to display failures
- [`JsonTology.instantiate`](/validation/instantiate) - returns typed value with defaults applied
- [Invariants](/registry/invariants) - cross-field rules that also affect `is` return value

## See also

- [Type Inference](/types/infer) - how the type predicate works with `TMap`
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
