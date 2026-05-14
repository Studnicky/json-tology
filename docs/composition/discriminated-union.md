# `Compose.discriminatedUnion` and `Compose.narrow`

> Validation modes: [Validation modes reference](/validation-modes)

---

## `Compose.discriminatedUnion` {#compose-discriminatedunion} <Badge type="warning" text="Compile-time + Runtime" />

**Declaration.** Creates a `oneOf` schema with a discriminator hint. The discriminator indicates which property uniquely identifies the variant. TypeScript infers the union of all variant types. The `$id` is set to `newId`. Each variant schema should have the discriminator property with a `const` value.

**Use this when** you have a set of mutually exclusive shapes identified by a single discriminator property - for example, payment methods (`credit_card` / `invoice` / `gift_card`), event types (`placed` / `shipped` / `cancelled`), or document types (`book` / `periodical` / `ebook`). The discriminator hint improves validator performance and is recognized by OpenAPI tooling.

**Don't use this when** you need all variants to share properties without a discriminator (use [`intersection`](/composition/intersection)). Don't use it when variants don't have a constant distinguishing property (use a plain `anyOf` schema literal instead).

## Examples

### Example 1: Payment method union

```ts
import { Compose, JsonTology } from 'json-tology';
import type { InferType } from 'json-tology/types';

const CreditCardPaymentSchema = {
  $id: 'https://bookstore.example/CreditCardPayment',
  type: 'object',
  properties: {
    method:    { type: 'string', const: 'credit_card' },
    cardLast4: { type: 'string', pattern: '^\\d{4}$' },
    expiry:    { type: 'string', pattern: '^\\d{2}/\\d{2}$' },
  },
  required: ['method', 'cardLast4', 'expiry'],
} as const;

const InvoicePaymentSchema = {
  $id: 'https://bookstore.example/InvoicePayment',
  type: 'object',
  properties: {
    method:        { type: 'string', const: 'invoice' },
    purchaseOrder: { type: 'string' },
  },
  required: ['method', 'purchaseOrder'],
} as const;

const PaymentSchema = Compose.discriminatedUnion(
  'method',
  [CreditCardPaymentSchema, InvoicePaymentSchema] as const,
  'https://bookstore.example/Payment',
);

type Payment = InferType<typeof PaymentSchema>;
// CreditCardPayment | InvoicePayment

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CreditCardPaymentSchema, InvoicePaymentSchema, PaymentSchema] as const,
});
```

### Example 2: Validate each variant

```ts
// Credit card  - valid
const cc = jt.validate(PaymentSchema.$id, {
  method: 'credit_card', cardLast4: '4242', expiry: '12/28',
});
console.log(cc.length === 0); // true

// Invoice  - valid
const inv = jt.validate(PaymentSchema.$id, {
  method: 'invoice', purchaseOrder: 'PO-001',
});
console.log(inv.length === 0); // true
```

### Example 3: Order with a discriminated payment field (builds on extend)

Extend `OrderSchema` with a `payment` field typed as the union, register the composite, then validate against it.

```ts
import { Compose, JsonTology } from 'json-tology';
import { OrderSchema } from './bookstore/index.js';

const OrderWithPaymentSchema = Compose.extend(
  OrderSchema,
  {
    payment: { $ref: PaymentSchema.$id },
  } as const,
  'https://bookstore.example/OrderWithPayment',
);

const jt2 = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [
    CreditCardPaymentSchema,
    InvoicePaymentSchema,
    PaymentSchema,
    OrderSchema,
    OrderWithPaymentSchema,
  ] as const,
});

// Validate the composite, not its parts. The $ref to PaymentSchema
// resolves through the registry, so each variant is checked at the
// payment slot.
const errs = jt2.validate(OrderWithPaymentSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      14.99,
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 14.99 }],
  payment:    { method: 'credit_card', cardLast4: '4242', expiry: '12/28' },
});
console.log(errors.length === 0); // true
```

### Discriminator argument validation <Badge type="info" text="Compile-time" />

Every variant must declare `properties[prop]` as `const` and list `prop` in `required`. Missing or non-const discriminators surface a `DiscriminatorMissingType` brand error at the call site - a compile error rather than a runtime surprise.

```ts
const BadVariant = {
  $id: 'https://bookstore.example/BadPayment',
  type: 'object',
  properties: {
    method: { type: 'string' },  // not const — compile error
  },
  required: ['method'],
} as const;

// compile error: variant 'BadPayment' does not declare properties.method as const
const PaymentSchema = Compose.discriminatedUnion(
  'method',
  [BadVariant] as const,
  'https://bookstore.example/Payment',
);
```

## `Compose.narrow` {#compose-narrow} <Badge type="info" text="Compile-time" />

**Declaration.** Type guard that narrows a discriminated union value to the variant whose discriminant property equals `expected`. Returns `Extract<TUnion, Record<TDiscriminant, TValue>>` inside the truthy branch. No runtime effect beyond the property comparison.

**Use this when** you have a union value and need TypeScript to narrow it to a specific variant for type-safe field access. Pairs naturally with `discriminatedUnion` - same discriminant property, same value.

**Don't use this when** your variants don't have a single discriminant property (use manual `typeof` / `instanceof` checks instead).

### Examples

#### Example 1: Narrow a Payment to access variant-specific fields

```ts
function describePayment(payment: Payment): string {
  if (Compose.narrow(payment, 'method', 'credit_card')) {
    // payment is narrowed to CreditCardPayment
    return `Card ending in ${payment.cardLast4}`;
  }
  if (Compose.narrow(payment, 'method', 'invoice')) {
    // payment is narrowed to InvoicePayment
    return `Invoice PO#${payment.purchaseOrder}`;
  }
  return 'Unknown payment method';
}
```

#### Example 2: Exhaustive switch with Compose.narrow

```ts
function processPayment(payment: Payment): void {
  if (Compose.narrow(payment, 'method', 'credit_card')) {
    chargeCard(payment.cardLast4, payment.expiry);
    return;
  }
  if (Compose.narrow(payment, 'method', 'invoice')) {
    createInvoice(payment.purchaseOrder);
    return;
  }
  // TypeScript can enforce exhaustiveness here with `satisfies ExhaustiveType`
}
```

## Comparison (discriminatedUnion)

::: code-group

```ts [json-tology]
const PaymentSchema = Compose.discriminatedUnion(
  'method',
  [CreditCardPaymentSchema, InvoicePaymentSchema] as const,
  'https://bookstore.example/Payment',
);
// discriminator hint emitted; type is CreditCardPayment | InvoicePayment
```

```ts [Zod]
const PaymentSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('credit_card'), cardLast4: z.string() }),
  z.object({ method: z.literal('invoice'), purchaseOrder: z.string() }),
]);
type Payment = z.infer<typeof PaymentSchema>;
```

```ts [Valibot]
import * as v from 'valibot';
const PaymentSchema = v.variant('method', [
  v.object({ method: v.literal('credit_card'), cardLast4: v.string() }),
  v.object({ method: v.literal('invoice'),     purchaseOrder: v.string() }),
]);
type Payment = v.InferOutput<typeof PaymentSchema>;
```

```ts [io-ts]
import * as t from 'io-ts';
const PaymentCodec = t.union([
  t.type({ method: t.literal('credit_card'), cardLast4: t.string }),
  t.type({ method: t.literal('invoice'),     purchaseOrder: t.string }),
]);
type Payment = t.TypeOf<typeof PaymentCodec>;
// Limitation: io-ts has no discriminator hint. t.union tries each member in
// order; tooling like OpenAPI generators cannot recover the discriminant.
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
// TypeBox uses Type.Union  - no built-in discriminator support:
const PaymentSchema = Type.Union([CreditCardPaymentSchema, InvoicePaymentSchema]);
// discriminator hint must be added manually for OpenAPI
```

```ts [AJV]
const PaymentSchema = {
  $id: 'https://bookstore.example/Payment',
  discriminator: { propertyName: 'method' },
  oneOf: [CreditCardPaymentSchema, InvoicePaymentSchema],
};
// Requires { discriminator: true } in Ajv options
```

```py [Pydantic]
from typing import Annotated, Literal
from pydantic import BaseModel, Discriminator

class CreditCardPayment(BaseModel):
    method: Literal['credit_card']
    card_last4: str

class InvoicePayment(BaseModel):
    method: Literal['invoice']
    purchase_order: str

Payment = Annotated[CreditCardPayment | InvoicePayment, Discriminator('method')]
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

- [`intersection`](/composition/intersection) - combine schemas that must ALL be satisfied
- [`extend`](/composition/extend) - add properties without creating a union
- [Type Inference](/types/infer) - how the TypeScript union type is inferred

## See also

- [Bookstore domain](/bookstore-domain) - where base schemas are defined
- [Composition index](/composition/) - overview of all composition operations
