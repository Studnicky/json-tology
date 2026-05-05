# Sub-schemas and `$ref` composition

A schema becomes a sub-schema of another by `$ref`-ing its `$id`. The parent owns the property slot; the registry resolves the reference at validation, instantiation, materialization, and TBox-emit time. The wire format stays a single declarative literal - no JS-level inheritance, no inlining.

This page shows how registered sub-schemas behave under each of the four core operations.

All examples use the [bookstore domain](/bookstore-domain).

---

## Pattern: name a value, reference it everywhere

```ts
import { JsonTology } from 'json-tology';

const EmailSchema = {
  $id: 'urn:bookstore:Email',
  type: 'string',
  format: 'email'
} as const;

const CustomerSchema = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:    { type: 'string', format: 'uuid' },
    email: { $ref: EmailSchema.$id }
  },
  required: ['id', 'email']
} as const;

const jt = JsonTology.create({
  baseIRI: 'urn:bookstore',
  schemas: [EmailSchema, CustomerSchema] as const
});
```

`EmailSchema` is the canonical definition of the value type "email." Any schema that wants an email field references its `$id`. The reference is symbolic, not structural - changing `EmailSchema` changes every consumer at once, and `findDuplicates()` will not flag two `$ref` slots as redundant.

---

## Validation reaches into `$ref`s

```ts
const ok = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example'
});
console.log(ok.items.length === 0); // true

const bad = jt.validate(CustomerSchema.$id, {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'not-an-email'
});
console.log(bad.items[0].path);    // '/email'
console.log(bad.items[0].keyword); // 'format'
```

The validator follows the `$ref` to `EmailSchema` and applies its `format: 'email'` constraint. The error path points at the parent's slot (`/email`), not at the referenced schema. Callers see one validation surface per request.

---

## Defaults from sub-schemas flow through `instantiate`

```ts
const PreferencesSchema = {
  $id: 'urn:bookstore:Preferences',
  type: 'object',
  properties: {
    locale:        { type: 'string', default: 'en-US' },
    notifications: { type: 'boolean', default: true }
  }
} as const;

const ProfileSchema = {
  $id: 'urn:bookstore:Profile',
  type: 'object',
  properties: {
    customerId:  { type: 'string' },
    preferences: { $ref: PreferencesSchema.$id }
  },
  required: ['customerId']
} as const;

const jt = JsonTology.create({
  baseIRI: 'urn:bookstore',
  schemas: [PreferencesSchema, ProfileSchema] as const,
  enableDefaults: true
});

const profile = jt.instantiate(ProfileSchema.$id, {
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  preferences: {}
});
// profile.preferences === { locale: 'en-US', notifications: true }
```

Defaults declared inside a referenced schema apply when the parent's value reaches that slot. The registry walks the `$ref` graph, so transitive defaults (a `$ref` to a schema that itself has a `$ref`) all resolve in a single pass.

---

## Coercion respects sub-schema constraints and Transforms

```ts
const Iso8601Schema = {
  $id: 'urn:bookstore:Iso8601',
  type: 'string',
  format: 'date-time'
} as const;

const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    id:       { type: 'string' },
    placedAt: { $ref: Iso8601Schema.$id }
  },
  required: ['id', 'placedAt']
} as const;

const jt = JsonTology.create({
  baseIRI: 'urn:bookstore',
  schemas: [Iso8601Schema, OrderSchema] as const
});

const order = jt.instantiate(OrderSchema.$id, {
  id:       'a1b2c3d4',
  placedAt: '2026-01-15T10:30:00Z'
});
// throws InstantiationError when placedAt is not RFC 3339
```

Format constraints on the referenced schema apply on the parent's slot. `Transform` decoders registered against the sub-schema's `$id` run on the parent's value too - one decoder, every reference.

---

## TBox emits a typed property edge per `$ref`

```ts
const tbox = jt.toTbox();
// includes (among others):
//   urn:bookstore:Customer schema:email urn:bookstore:Email
//   urn:bookstore:Email    rdf:type     rdfs:Datatype
```

Every `$ref` in the TypeScript-side schema becomes a typed property edge in the canonical graph. The OWL projection emits `rdfs:domain` and `rdfs:range` for the parent class and the referenced class respectively. SHACL emits `sh:node` or `sh:datatype` constraints on the property shape. The same graph drives both projections.

---

## Composition through `$ref`s: a discriminated union as a sub-schema

```ts
import { Compose } from 'json-tology';

const CreditCardPaymentSchema = {
  $id: 'urn:bookstore:CreditCardPayment',
  type: 'object',
  properties: {
    method:    { const: 'credit_card' },
    cardLast4: { type: 'string', pattern: '^\\d{4}$' }
  },
  required: ['method', 'cardLast4']
} as const;

const InvoicePaymentSchema = {
  $id: 'urn:bookstore:InvoicePayment',
  type: 'object',
  properties: {
    method:        { const: 'invoice' },
    purchaseOrder: { type: 'string' }
  },
  required: ['method', 'purchaseOrder']
} as const;

const PaymentSchema = Compose.discriminatedUnion(
  'method',
  [CreditCardPaymentSchema, InvoicePaymentSchema] as const,
  'urn:bookstore:Payment'
);

const OrderWithPaymentSchema = Compose.extend(
  OrderSchema,
  { payment: { $ref: PaymentSchema.$id } } as const,
  'urn:bookstore:OrderWithPayment'
);

const jt = JsonTology.create({
  baseIRI: 'urn:bookstore',
  schemas: [
    CreditCardPaymentSchema,
    InvoicePaymentSchema,
    PaymentSchema,
    OrderSchema,
    OrderWithPaymentSchema
  ] as const
});

const errs = jt.validate(OrderWithPaymentSchema.$id, {
  id:       'a1b2c3d4',
  placedAt: '2026-01-15T10:30:00Z',
  payment:  { method: 'credit_card', cardLast4: '4242' }
});
console.log(errs.items.length === 0); // true
```

The composite (`OrderWithPaymentSchema`) is what the caller validates. Its `payment` slot is a `$ref` to the discriminated union. The validator descends through both layers automatically: variant selection happens inside the `$ref`, the rest of the order is checked at the top level.

---

## Cycles are first-class

A sub-schema may `$ref` itself or any ancestor. The graph is allowed to be cyclic; the registry resolves a cycle by short-circuiting on the second visit, so type inference and runtime traversal both terminate.

```ts
const PersonSchema = {
  $id: 'urn:bookstore:Person',
  type: 'object',
  properties: {
    name:    { type: 'string' },
    manager: { $ref: 'urn:bookstore:Person' }
  },
  required: ['name']
} as const;

const jt = JsonTology.create({
  baseIRI: 'urn:bookstore',
  schemas: [PersonSchema] as const
});

const ceo = jt.instantiate(PersonSchema.$id, {
  name: 'Carol',
  manager: { name: 'Carol', manager: { name: 'Carol' } }
});
```

`PersonSchema.manager` references `PersonSchema` itself. Validation, instantiation, and TBox emission all handle the cycle without special configuration. The OWL output emits a single class with an `rdfs:domain` / `rdfs:range` self-edge.

---

## What you give up by inlining

Any of the patterns above can be written without `$ref`s by inlining the sub-schema body into the parent. That works, but it costs:

- The TypeScript type loses its name (you get the structural shape, not the named type).
- Two inline copies don't share a single ontology class - the OWL output emits two anonymous classes.
- `findDuplicates()` flags the two inline shapes as redundant.
- A change to the sub-schema requires updating every inline copy by hand.

For ergonomic, refactor-safe, ontology-friendly authoring: name every value type and `$ref` it.

---

## Related

- [Picking a method](/picking-a-method) - validate vs instantiate vs materialize
- [Graph-native authoring](/advanced/graph-native-authoring) - why naming reduces drift
- [Composition: discriminatedUnion](/composition/discriminated-union) - oneOf as a sub-schema
- [Composition: extend](/composition/extend) - merging properties without `$ref` indirection

## See also

- [Bookstore domain](/bookstore-domain) - every entity uses `$ref` composition
- [Graph concepts](/advanced/graph-concepts) - TBox vs ABox, domain and range
