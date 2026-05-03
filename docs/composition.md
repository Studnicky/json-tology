# Composition

> This guide covers `Compose.extend`, `pick`, `omit`, `partial`, `required`, `intersection`, `discriminatedUnion`, `narrow`, and `getDefaults`. All examples use the [bookstore domain](/bookstore-domain). See [Validation](/validation) for how to use composed schemas with `coerce` and `validate`.

`Compose` provides static methods for deriving new schemas from existing ones. All methods return new schema objects — input schemas are never mutated. The TypeScript types are inferred at compile time; the output is a valid JSON Schema at runtime.

---

## extend

Derives a schema with additional properties merged in from the base schema.

### Signature

```ts
public static extend<TSchema, TAdditional, TId extends string>(
  schema: TSchema,
  additionalProperties: TAdditional,
  newId: TId
): ExtendSchemaType<TSchema, TAdditional, TId>
```

### When to use

Use `extend` when you want to add fields to an existing schema — for example, adding a `discountRate` to `Customer`, or adding `shippingAddress` to `Order`. The `required` array from the base schema is inherited unchanged. To make new fields required, combine `extend` with `intersection` or explicitly list them.

### Examples

#### Example 1: Add a discount rate to Customer

Building on `CustomerSchema` from the [bookstore domain](/bookstore-domain):

```ts
import { Compose } from 'json-tology';
import type { InferType } from 'json-tology';

const CustomerWithDiscountSchema = Compose.extend(
  CustomerSchema,
  {
    discountRate: { type: 'number', minimum: 0, maximum: 1, default: 0 },
    tier:         { type: 'string', enum: ['bronze', 'silver', 'gold'] },
  } as const,
  'https://bookstore.example/CustomerWithDiscount',
);

type CustomerWithDiscount = InferType<typeof CustomerWithDiscountSchema>;
// {
//   readonly id: string;
//   readonly email: string;
//   readonly name: string;
//   readonly addresses?: readonly Address[];
//   readonly discountRate?: number;
//   readonly tier?: 'bronze' | 'silver' | 'gold';
// }
```

#### Example 2: Extend Book with a featured badge

```ts
const FeaturedBookSchema = Compose.extend(
  BookSchema,
  {
    badge:    { type: 'string', enum: ['bestseller', 'new', 'staff-pick'] },
    position: { type: 'integer', minimum: 1 },
  } as const,
  'https://bookstore.example/FeaturedBook',
);

jt.register(FeaturedBookSchema);

const featured = jt.coerce(FeaturedBookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
  badge:   'bestseller',
  position: 1,
});
```

#### Example 3: Extend with a field that overrides an existing property

Properties in `additionalProperties` shadow same-named properties from the base schema. Use this to tighten constraints.

```ts
const PremiumBookSchema = Compose.extend(
  BookSchema,
  {
    // Tighten the price constraint for premium books
    price: { type: 'number', minimum: 25 },
  } as const,
  'https://bookstore.example/PremiumBook',
);
```

### Comparison

::: code-group

```ts [json-tology]
const CustomerWithDiscountSchema = Compose.extend(
  CustomerSchema,
  { discountRate: { type: 'number', default: 0 } } as const,
  'https://bookstore.example/CustomerWithDiscount',
);
```

```ts [Zod]
const CustomerWithDiscountSchema = CustomerSchema.extend({
  discountRate: z.number().default(0),
});
```

```ts [TypeBox]
const CustomerWithDiscountSchema = Type.Composite([
  CustomerSchema,
  Type.Object({ discountRate: Type.Number({ default: 0 }) }),
]);
// Or use Type.Intersect for allOf semantics
```

```ts [AJV]
const CustomerWithDiscountSchema = {
  ...CustomerSchema,
  $id: 'https://bookstore.example/CustomerWithDiscount',
  properties: {
    ...CustomerSchema.properties,
    discountRate: { type: 'number', default: 0 },
  },
};
```

```py [Pydantic]
class CustomerWithDiscount(Customer):
    discount_rate: float = 0.0
    tier: str | None = None
```

:::

### Related

- `intersection` — allOf-based composition for stricter merging
- `partial` / `required` — make fields optional or required
- [Validation](/validation#coerce) — register and coerce extended schemas

---

## pick

Derives a schema containing only the specified property keys.

### Signature

```ts
public static pick<TSchema, TKeys extends string, TId extends string>(
  schema: TSchema,
  keys: readonly TKeys[],
  newId: TId
): PickSchemaInterface<TSchema, TKeys, TId>
```

Non-picked `required` fields are dropped. The TypeScript type includes only the picked properties.

### When to use

Use `pick` to build read-only summary shapes for list views or API projections where you only want a subset of fields. This is the composition equivalent of TypeScript's built-in `Pick<T, K>`.

### Examples

#### Example 1: Book summary for catalog listings

```ts
const BookSummarySchema = Compose.pick(
  BookSchema,
  ['isbn', 'title', 'price', 'inStock'] as const,
  'https://bookstore.example/BookSummary',
);

type BookSummary = InferType<typeof BookSummarySchema>;
// { readonly isbn?: string; readonly title?: string; readonly price?: number; readonly inStock?: boolean }

jt.register(BookSummarySchema);
const summary = jt.coerce(BookSummarySchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  price:   14.99,
  authors: ['Dostoevsky'],  // stripped — not picked
});
```

#### Example 2: Customer card for order display

```ts
const CustomerCardSchema = Compose.pick(
  CustomerSchema,
  ['id', 'name', 'email'] as const,
  'https://bookstore.example/CustomerCard',
);
// Useful for embedding customer info in order responses without full Address data
```

### Comparison

::: code-group

```ts [json-tology]
Compose.pick(BookSchema, ['isbn', 'title', 'price'] as const, 'https://bookstore.example/BookSummary')
```

```ts [Zod]
BookSchema.pick({ isbn: true, title: true, price: true })
```

```ts [TypeBox]
// TypeBox doesn't have a native Pick utility.
// Use Type.Omit to achieve equivalent result, or pick manually.
Type.Omit(BookSchema, ['authors', 'currency', 'inStock'])
```

```ts [AJV]
// Manual construction:
const BookSummary = {
  $id: 'BookSummary',
  type: 'object',
  properties: {
    isbn:    BookSchema.properties.isbn,
    title:   BookSchema.properties.title,
    price:   BookSchema.properties.price,
  },
};
```

```py [Pydantic]
# Pydantic v2 model_validate includes/excludes fields at validation time:
book_dict = book.model_dump(include={'isbn', 'title', 'price'})
# Or create a new model class with only those fields:
class BookSummary(BaseModel):
    isbn: str
    title: str
    price: float
```

:::

### Related

- `omit` — inverse of pick
- `extend` — add fields to a base schema

---

## omit

Derives a schema with specified property keys removed.

### Signature

```ts
public static omit<TSchema, TKeys extends string, TId extends string>(
  schema: TSchema,
  keys: readonly TKeys[],
  newId: TId
): OmitSchemaInterface<TSchema, TKeys, TId>
```

Removed `required` fields are also dropped from `required`.

### When to use

Use `omit` to remove sensitive or internal fields from a public-facing schema — for example, stripping `internalNotes` from a `Book` before exposing it to the API, or removing `addresses` from `Customer` in a public profile.

### Examples

#### Example 1: Public book schema without internal fields

```ts
const PublicBookSchema = Compose.omit(
  FeaturedBookSchema,   // built on BookSchema above
  ['badge', 'position'] as const,
  'https://bookstore.example/PublicBook',
);
// Equivalent to BookSchema — badge and position are gone
```

#### Example 2: Order without payment details

```ts
const OrderSummarySchema = Compose.omit(
  OrderSchema,
  ['items'] as const,
  'https://bookstore.example/OrderSummary',
);

type OrderSummary = InferType<typeof OrderSummarySchema>;
// { id, customerId, total, currency?, placedAt } — no items array
```

### Comparison

::: code-group

```ts [json-tology]
Compose.omit(CustomerSchema, ['addresses'] as const, 'https://bookstore.example/CustomerPublic')
```

```ts [Zod]
CustomerSchema.omit({ addresses: true })
```

```ts [TypeBox]
Type.Omit(CustomerSchema, ['addresses'])
```

```ts [AJV]
// Manual construction — copy schema, delete key from properties and required.
```

```py [Pydantic]
customer.model_dump(exclude={'addresses'})
# Or create a subclass that excludes the field.
```

:::

### Related

- `pick` — keep only specified fields
- `partial` — make all fields optional (for PATCH endpoints)

---

## partial

Derives a schema where all properties are optional (no `required` array).

### Signature

```ts
public static partial<TSchema, TId extends string>(
  schema: TSchema,
  newId: TId
): PartialSchemaType<TSchema, TId>
```

### When to use

Use `partial` to produce PATCH-body schemas where any combination of fields may be provided. The TypeScript type mirrors `Partial<T>`. Combine with `required` on a picked subset to make only some fields required.

### Examples

#### Example 1: PATCH customer endpoint

```ts
const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer',
);

type PatchCustomer = InferType<typeof PatchCustomerSchema>;
// { id?: string; email?: string; name?: string; addresses?: Address[] }

jt.register(PatchCustomerSchema);

// Accept partial updates — only validate what's present
const patch = jt.coerce(PatchCustomerSchema.$id, { name: 'Alice P. Chen' });
// { name: 'Alice P. Chen' }
```

#### Example 2: Partial order update

```ts
const PatchOrderSchema = Compose.partial(
  OrderSchema,
  'https://bookstore.example/PatchOrder',
);
// All of Order's required fields become optional for PATCH semantics
```

### Comparison

::: code-group

```ts [json-tology]
Compose.partial(CustomerSchema, 'https://bookstore.example/PatchCustomer')
```

```ts [Zod]
CustomerSchema.partial()
```

```ts [TypeBox]
Type.Partial(CustomerSchema)
```

```ts [AJV]
// Manual — remove `required` from a copied schema.
const { required: _, ...PatchCustomer } = CustomerSchema;
```

```py [Pydantic]
# Use Optional fields or create a PATCH model manually:
class PatchCustomer(BaseModel):
    name: str | None = None
    email: str | None = None
    # Or use model_fields_set to track which fields were provided
```

:::

### Related

- `required` — inverse — make all declared properties required
- `pick` — combine with `partial` to create partial sub-schemas

---

## required

Derives a schema where every declared property is required.

### Signature

```ts
public static required<TSchema, TId extends string>(
  schema: TSchema,
  newId: TId
): RequiredSchemaType<TSchema, TId>
```

### When to use

Use `required` to produce a strict create-body schema from a base schema that has some optional fields. The TypeScript type mirrors `Required<T>`.

### Examples

#### Example 1: Strict book creation schema

`BookSchema` has `currency` and `inStock` with defaults (thus optional). A strict creation schema requires all fields.

```ts
const CreateBookSchema = Compose.required(
  BookSchema,
  'https://bookstore.example/CreateBook',
);

type CreateBook = InferType<typeof CreateBookSchema>;
// { isbn: string; title: string; authors: string[]; price: number;
//   currency: string; inStock: boolean }  — all required

jt.register(CreateBookSchema);
jt.validate(CreateBookSchema.$id, {
  isbn:    '9780140449136',
  title:   'Crime and Punishment',
  authors: ['Fyodor Dostoevsky'],
  price:   14.99,
  // currency and inStock missing — validation will fail
});
// ["/currency: must have required property 'currency'", ...]
```

### Comparison

::: code-group

```ts [json-tology]
Compose.required(BookSchema, 'https://bookstore.example/CreateBook')
```

```ts [Zod]
BookSchema.required()
```

```ts [TypeBox]
Type.Required(BookSchema)
```

```ts [AJV]
// Manual: set required = Object.keys(schema.properties)
```

```py [Pydantic]
# All fields without defaults are already required in Pydantic.
# To enforce fields that have defaults, use model_validator or remove defaults.
```

:::

---

## intersection

Combines multiple schemas using `allOf`. Data must satisfy all constituent schemas.

### Signature

```ts
public static intersection<TSchemas extends ReadonlyArray<...>, TId extends string>(
  schemas: TSchemas,
  newId: TId
): IntersectionSchemaInterface<TSchemas, TId>
```

### When to use

Use `intersection` when you need data to satisfy multiple independent schemas simultaneously — for example, a timestamped, auditable order that must satisfy both `OrderSchema` and `AuditSchema`. This differs from `extend` which merges properties into a single flat object schema; `intersection` uses `allOf` so all schemas' required constraints apply.

### Examples

#### Example 1: Add audit fields to Order

```ts
const AuditSchema = {
  $id: 'https://bookstore.example/Audit',
  type: 'object',
  properties: {
    createdAt:  { type: 'string', format: 'date-time' },
    updatedAt:  { type: 'string', format: 'date-time' },
    createdBy:  { type: 'string' },
  },
  required: ['createdAt', 'updatedAt'],
} as const;

const AuditedOrderSchema = Compose.intersection(
  [OrderSchema, AuditSchema] as const,
  'https://bookstore.example/AuditedOrder',
);

type AuditedOrder = InferType<typeof AuditedOrderSchema>;
// Order & { createdAt: string; updatedAt: string; createdBy?: string }

jt.register(AuditSchema);
jt.register(AuditedOrderSchema);
```

#### Example 2: Verify all constituent schemas must pass

Validation fails if data satisfies `OrderSchema` but not `AuditSchema`.

```ts
const errors = jt.validate(AuditedOrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      27.98,
  items:      [{ bookIsbn: '9780140449136', quantity: 1, unitPrice: 27.98 }],
  // createdAt and updatedAt missing — AuditSchema required fields
});
console.log(errors.length > 0); // true
```

### Comparison

::: code-group

```ts [json-tology]
Compose.intersection([OrderSchema, AuditSchema] as const, 'https://bookstore.example/AuditedOrder')
```

```ts [Zod]
OrderSchema.and(AuditSchema)
// Or: z.intersection(OrderSchema, AuditSchema)
```

```ts [TypeBox]
Type.Intersect([OrderSchema, AuditSchema])
```

```ts [AJV]
const AuditedOrderSchema = { allOf: [OrderSchema, AuditSchema], $id: '...' };
```

```py [Pydantic]
# Pydantic achieves this via multiple inheritance:
class AuditedOrder(Order, Audit):
    pass
```

:::

### Related

- `extend` — merges properties into a single flat schema (simpler)
- `intersection` — `allOf` — all schema constraints must pass

---

## discriminatedUnion

Creates a `oneOf` schema with a type discriminator property.

### Signature

```ts
public static discriminatedUnion<TDiscriminator, TVariants, TId>(
  discriminatorProperty: TDiscriminator,
  variants: TVariants,
  newId: TId
): DiscriminatedUnionSchemaInterface<TDiscriminator, TVariants, TId>
```

### When to use

Use when you have a union of object types where one property uniquely identifies the variant — for example, different payment methods (`credit_card`, `invoice`, `gift_card`) or different shipment types. The discriminator hint allows validators and OpenAPI tools to optimise by narrowing to the matching variant before validating.

### Examples

#### Example 1: Payment method union

```ts
const CreditCardPaymentSchema = {
  $id: 'https://bookstore.example/CreditCardPayment',
  type: 'object',
  properties: {
    method:     { type: 'string', const: 'credit_card' },
    cardLast4:  { type: 'string', pattern: '^\\d{4}$' },
    expiry:     { type: 'string', pattern: '^\\d{2}/\\d{2}$' },
  },
  required: ['method', 'cardLast4', 'expiry'],
} as const;

const InvoicePaymentSchema = {
  $id: 'https://bookstore.example/InvoicePayment',
  type: 'object',
  properties: {
    method:        { type: 'string', const: 'invoice' },
    purchaseOrder: { type: 'string' },
    netTerms:      { type: 'integer', enum: [15, 30, 60] },
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

jt.register([CreditCardPaymentSchema, InvoicePaymentSchema, PaymentSchema] as const);
```

#### Example 2: Narrow a union value at runtime

`Compose.narrow` is a type guard that narrows the union to the matching variant.

```ts
function describePayment(payment: Payment): string {
  if (Compose.narrow(payment, 'method', 'credit_card')) {
    return `Card ending in ${payment.cardLast4}`;
  }
  if (Compose.narrow(payment, 'method', 'invoice')) {
    return `Invoice PO#${payment.purchaseOrder}`;
  }
  return 'Unknown payment';
}
```

### Comparison

::: code-group

```ts [json-tology]
const PaymentSchema = Compose.discriminatedUnion(
  'method',
  [CreditCardPaymentSchema, InvoicePaymentSchema] as const,
  'https://bookstore.example/Payment',
);
```

```ts [Zod]
const PaymentSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('credit_card'), cardLast4: z.string() }),
  z.object({ method: z.literal('invoice'), purchaseOrder: z.string() }),
]);
```

```ts [TypeBox]
const PaymentSchema = Type.Union([CreditCardPaymentSchema, InvoicePaymentSchema]);
// TypeBox does not have a discriminatedUnion helper — use Type.Union.
// The discriminator hint is not emitted automatically.
```

```ts [AJV]
const PaymentSchema = {
  oneOf: [CreditCardPaymentSchema, InvoicePaymentSchema],
  discriminator: { propertyName: 'method' },
};
// Requires ajv option: { discriminator: true }
```

```py [Pydantic]
from pydantic import BaseModel, Discriminator
from typing import Annotated, Literal

class CreditCardPayment(BaseModel):
    method: Literal['credit_card']
    card_last4: str

class InvoicePayment(BaseModel):
    method: Literal['invoice']
    purchase_order: str

Payment = Annotated[
    CreditCardPayment | InvoicePayment,
    Discriminator('method')
]
```

:::

### Related

- `narrow` — type guard for discriminated union values
- [Validation](/validation#coerce) — coerce a discriminated union value

---

## getDefaults

Extracts declared `default` values from a schema without building an instance.

### Signature

```ts
public static getDefaults(schema: Record<string, unknown>): Record<string, unknown>
```

Returns a plain object with only the properties that have a `default` declared. Properties without defaults are omitted.

### When to use

Use for form initialization — pre-populate form fields with the schema's declared defaults without running a full coercion. This avoids validation errors when the form is empty.

### Examples

#### Example 1: Pre-populate a new book form

```ts
const defaults = Compose.getDefaults(BookSchema);
console.log(defaults);
// { currency: 'USD', inStock: true }
// isbn, title, authors, price omitted — they have no declared defaults

// Initialize form state:
const formState = { ...defaults, isbn: '', title: '', authors: [], price: 0 };
```

#### Example 2: Pre-populate an order form

```ts
const defaults = Compose.getDefaults(OrderSchema);
console.log(defaults);
// { currency: 'USD' }
// id, customerId, items, total, placedAt omitted
```

### Comparison

::: code-group

```ts [json-tology]
const defaults = Compose.getDefaults(BookSchema);
// { currency: 'USD', inStock: true }
```

```ts [Zod]
// Zod doesn't extract defaults as a standalone map.
// BookSchema.parse({}) would fail due to missing required fields.
// Manually extract via: { currency: 'USD', inStock: true } from schema definition.
```

```ts [TypeBox]
import { Value } from '@sinclair/typebox/value';
const defaults = Value.Default(BookSchema, {});
// Populates ALL fields with defaults + zero-values, not just declared defaults.
```

```ts [AJV]
// Not directly supported — AJV applies defaults during validation but
// doesn't expose a standalone getDefaults() utility.
```

```py [Pydantic]
# Get defaults from model field definitions:
defaults = {
    name: field.default
    for name, field in Book.model_fields.items()
    if field.default is not PydanticUndefined
}
```

:::

### Related

- `materialize` — build a full instance from partial data with defaults applied
- [Value Operations](/value) — `value.create` synthesizes zero-values for all required fields
