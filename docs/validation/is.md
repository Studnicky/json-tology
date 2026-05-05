# `JsonTology.is`

**Declaration.** Validates data against a registered schema and returns a boolean. When the schema is registered via `JsonTology.create({ schemas })`, the return type is a TypeScript type predicate (`data is TMap[K]`), which narrows the type of `data` to the schema's inferred type inside the `if` block. Does not mutate input. Does not throw on validation failure.

**Use this when** you need a boolean check and you want TypeScript to narrow the type inside the truthy branch - for example, in union-narrowing guards, array filters, middleware checks. This is the idiomatic pattern when you need "is this data the right shape?" without wanting errors or a coerced value.

**Don't use this when** you need error details (use [`validate`](/validation/validate) instead). Don't use it when you need the coerced, defaults-filled value (use [`instantiate`](/validation/instantiate) instead). Invariants also run: `is` returns `false` when any registered invariant fails, not just when structural validation fails.

## Examples

### Example 1: Type narrowing in a conditional branch

```ts
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

function describeCustomer(data: unknown): string {
  if (jt.is(CustomerSchema.$id, data)) {
    // data is narrowed to Customer here
    return `${data.name} <${data.email}>`;
  }
  return 'not a customer';
}
```

### Example 2: Filtering an array of unknowns

```ts
import { bookstoreEntities as entities, CustomerSchema, type Customer } from './bookstore/index.js';

const mixed: unknown[] = fetchFromApi();
const customers = mixed.filter(
  (item): item is Customer => jt.is(CustomerSchema.$id, item)
);
// customers is Customer[]
```

### Example 3: Guards at a service boundary

```ts
import { bookstoreEntities as entities, OrderSchema, type Order } from './bookstore/index.js';

function processOrder(data: unknown): void {
  if (!jt.is(OrderSchema.$id, data)) {
    throw new TypeError('Expected an Order');
  }
  // data is Order from here  - no explicit cast needed
  console.log(`Processing order ${data.id} for customer ${data.customerId}`);
}
```

## Bad examples - what NOT to do

### Anti-pattern 1: Using `is` when you need the coerced (defaults-filled) value

```ts
// ⊥ Don't do this  - is() only checks, it doesn't apply defaults
if (jt.is(CustomerSchema.$id, data)) {
  // data.addresses might be undefined if the input didn't include it
  // is() doesn't apply the default: []
  data.addresses.forEach(/* ... */);  // potential runtime error
}

// ✓ Do this  - coerce to get defaults applied
const customer = jt.instantiate(CustomerSchema.$id, data);
customer.addresses.forEach(/* ... */);  // addresses always present (default [])
```

### Anti-pattern 2: Checking `is` and then immediately coercing

```ts
// ⊥ Don't do this  - double validation
if (jt.is(CustomerSchema.$id, data)) {
  const customer = jt.instantiate(CustomerSchema.$id, data); // validates again
}

// ✓ Do this  - coerce directly; catch the error if invalid
try {
  const customer = jt.instantiate(CustomerSchema.$id, data);
} catch (err) { /* handle */ }
```

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

:::

## Related

- [`JsonTology.validate`](/validation/validate) - returns structured `ValidationErrors` when you need to display failures
- [`JsonTology.instantiate`](/validation/instantiate) - returns typed value with defaults applied
- [Invariants](/registry/invariants) - cross-field rules that also affect `is` return value

## See also

- [Type Inference](/types) - how the type predicate works with `TMap`
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
