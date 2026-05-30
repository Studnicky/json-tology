# `Compose.intersection` <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Creates a new `allOf` schema that combines multiple schemas. Data must satisfy every constituent schema simultaneously. TypeScript infers the intersection of all constituent types. The `$id` is set to `newId`.

**Use this when** data must satisfy multiple independent schemas - for example, an `AuditedOrder` must satisfy both `Order` constraints and `Audit` constraints including their respective `required` arrays. This is stronger than [`extend`](/composition/extend), which only merges properties into one flat object.

**Don't use this when** you only need to merge property definitions without additional required constraints (use [`extend`](/composition/extend) - simpler, more predictable). Don't use it for union types (use [`discriminatedUnion`](/composition/discriminated-union)).

## Examples

### Example 1: Add audit fields to Order

Both `Order` and `Audit` required arrays must be satisfied.

<RunnableExample src="examples/docs/composition/04-intersection" />

### Example 2: Validation fails if any constituent schema fails

<RunnableExample src="examples/docs/composition/27-intersection-validation-failure" />

### Example 3: getDefaults on an intersection schema

Build on [`Compose.getDefaults`](/composition/get-defaults) - extracting defaults from an intersection walks each constituent.

<RunnableExample src="examples/docs/composition/28-intersection-get-defaults" />

## ID collision prevention <Badge type="info" text="Compile-time" />

`newId` cannot collide with any input schema's `$id`. A collision surfaces an `IntersectionIdCollisionType` brand error at the call site.

<RunnableExample src="examples/docs/composition/46-antipattern-intersection-id-collision" />

## Bad examples - what NOT to do

### Anti-pattern 1: Using intersection when extend is simpler

<RunnableExample src="examples/docs/composition/29-antipattern-intersection-vs-extend" />

## Comparison

::: code-group

```ts [json-tology]
Compose.intersection([OrderSchema, AuditSchema] as const, 'https://bookstore.example/AuditedOrder')
// Produces allOf: [OrderSchema, AuditSchema]
// Both required arrays must be satisfied
```

```ts [Zod]
OrderSchema.and(AuditSchema)
// Or: z.intersection(OrderSchema, AuditSchema)
```

```ts [Valibot]
import * as v from 'valibot';
v.intersect([OrderSchema, AuditSchema])
```

```ts [io-ts]
import * as t from 'io-ts';
const AuditedOrder = t.intersection([OrderCodec, AuditCodec]);
// Both codecs must succeed for decode to return Right.
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
Type.Intersect([OrderSchema, AuditSchema])
```

```ts [AJV]
const AuditedOrderSchema = {
  $id: 'https://bookstore.example/AuditedOrder',
  allOf: [OrderSchema, AuditSchema],
};
```

```py [Pydantic]
class AuditedOrder(Order, Audit):
    # Multiple inheritance achieves allOf semantics
    pass
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

- [`extend`](/composition/extend) - simpler for just adding properties without separate required constraints
- [`discriminatedUnion`](/composition/discriminated-union) - for oneOf with type discriminator
- [`partial`](/composition/partial-required) - make the intersected result partially optional

## See also

- [Bookstore domain](/bookstore-domain) - where `OrderSchema` is defined
- [Composition index](/composition/) - overview of all composition operations
