# `JsonTology.materialize`

**Construction helper.** Use `materialize` when you produce the data yourself - test fixtures, form scaffolding, default-filled instances. Validates the result by default and throws `MaterializationError` if validation fails. Pass `{ enablePartial: true }` to allow missing required-without-default fields for lenient construction.

**Declaration.** Builds a fully-populated instance by merging optional partial input with the schema's declared `default` values. Returns a `MaterializedSchemaType<TSchema>` — a plain mutable type, like every schema-derived type in json-tology (see [Mutability](/types/infer#mutability)). Validates the merged result; throws `MaterializationError` on failure. Pass `{ enablePartial: true }` for lenient construction that accepts missing required fields. Does not strip unknown properties from partial input (partial is trusted); use [`instantiate`](/validation/instantiate) for untrusted input.

**Use this when** you have trusted partial data (from a factory, a test fixture, an admin form) and want the missing fields filled in from schema defaults. The canonical use case: creating a new entity with some known fields, leaving the rest to defaults.

**Don't use this when** the input is untrusted or may carry unknown properties (use [`instantiate`](/validation/instantiate) instead - it validates, strips unknowns, and applies defaults). Don't use it when you want a completely blank instance with zero-values (use [`jt.value.create`](/value/create) instead).

## Examples

### Example 1: Build a new Book from required fields only

`currency` and `inStock` have declared defaults - they are filled in automatically.

<RunnableExample src="examples/docs/materialization/01-materialize" />

### Example 2: Materialize a Customer - addresses default is empty array

<RunnableExample src="examples/docs/registry/16-materialize-customer-defaults" />

### Example 3: Contrast with coerce and value.create

<RunnableExample src="examples/docs/registry/17-materialize-vs-create-vs-coerce" />

## Bad examples - what NOT to do

### Anti-pattern 1: Using materialize for untrusted API input

<RunnableExample src="examples/docs/registry/17-materialize-vs-create-vs-coerce" />

## Comparison

::: code-group

```ts [json-tology]
jt.materialize(BookSchema, {
  isbn: '9783522128001', title: 'Die unendliche Geschichte',
  authors: ['Michael Ende'], price: 14.99,
})
// → currency: 'USD', inStock: true applied from declared defaults
```

```ts [Zod]
// Zod applies defaults during parse(); no separate materialize step:
const book = BookSchema.parse({
  isbn: '9783522128001', title: 'Die unendliche Geschichte',
  authors: ['Michael Ende'], price: 14.99,
});
// Requires .default() on each field in the schema definition.
```

```ts [Valibot]
import * as v from 'valibot';
// Valibot applies defaults during v.parse() via v.optional(schema, default):
const book = v.parse(BookSchema, {
  isbn: '9783522128001', title: 'Die unendliche Geschichte',
  authors: ['Michael Ende'], price: 14.99,
});
// Limitation: no separate materialize step; defaults only flow when
// fields are wrapped in v.optional(..., defaultValue).
```

```ts [io-ts]
import * as t from 'io-ts';
// Limitation: io-ts has no materialize step and no native default-value
// mechanism. Codecs are values, not registry entries; merge defaults by
// hand before calling .decode():
const defaults = { currency: 'USD', inStock: true };
const result = BookCodec.decode({ ...defaults, ...partial });
```

```ts [TypeBox + Value]
import { Value } from '@sinclair/typebox/value';
// Value.Default fills defaults:
const book = Value.Default(BookSchema, {
  isbn: '9783522128001', title: '...', authors: [...], price: 14.99,
});
```

```ts [AJV]
// AJV applies defaults during validation with { useDefaults: true }:
const ajv = new Ajv({ useDefaults: true });
const data = { isbn: '...', title: '...', authors: [...], price: 14.99 };
ajv.validate(bookSchema, data);  // mutates data in place with defaults
```

```py [Pydantic]
book = Book(isbn='9783522128001', title='Die unendliche Geschichte',
            authors=['Michael Ende'], price=14.99)
# currency and in_stock filled from defaults automatically
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

- [`JsonTology.instantiate`](/validation/instantiate) - validate + apply defaults + strip unknowns (for untrusted input)
- [`jt.value.create`](/value/create) - zero-value instance for blank form initialization
- [`Compose.getDefaults`](/composition/get-defaults) - extract declared defaults without building an instance
- [Computed fields](/registry/computed) - computed properties also run after materialization

## See also

- [Bookstore domain](/bookstore-domain) - where `BookSchema` and `CustomerSchema` are defined
