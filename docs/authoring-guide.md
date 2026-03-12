# Schema Authoring Guide

## Core Principle

Every structured entity in your domain gets its own schema with a `$id`. There are no anonymous objects — if it has properties, it has an identity. This is what makes json-tology's graph, ontology, and type system work as a unified backbone.

---

## 1. Declarations

### Simple Types

```typescript
const EmailSchema = {
  $id: 'https://myapp.io/Email',
  type: 'string',
  format: 'email',
} as const;

const AgeSchema = {
  $id: 'https://myapp.io/Age',
  type: 'integer',
  minimum: 0,
  maximum: 150,
} as const;

const StatusSchema = {
  $id: 'https://myapp.io/Status',
  type: 'string',
  enum: ['active', 'inactive', 'suspended'],
} as const;
```

### Object Types (Entities)

Every object with properties is a named entity:

```typescript
const AddressSchema = {
  $id: 'https://myapp.io/Address',
  type: 'object',
  properties: {
    street:  { type: 'string' },
    city:    { type: 'string' },
    state:   { type: 'string' },
    zipCode: { type: 'string', pattern: '^\\d{5}(-\\d{4})?$' },
  },
  required: ['street', 'city', 'state'],
} as const;

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  properties: {
    id:      { type: 'string', format: 'uuid' },
    name:    { type: 'string', minLength: 1 },
    email:   { type: 'string', format: 'email' },
    age:     { type: 'integer', minimum: 0 },
    address: { $ref: 'https://myapp.io/Address' },
  },
  required: ['id', 'name', 'email'],
} as const;
```

### The No-Inline-Object Rule

**This is wrong** — inline objects create unnamed entities that break the ontology graph:

```typescript
// ❌ BAD — address is an anonymous entity
const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  properties: {
    address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' },
      },
    },
  },
} as const;
```

**This is right** — every structured object has its own identity:

```typescript
// ✅ GOOD — Address is a named TBox entity
const AddressSchema = {
  $id: 'https://myapp.io/Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city:   { type: 'string' },
  },
  required: ['street', 'city'],
} as const;

const UserSchema = {
  $id: 'https://myapp.io/User',
  type: 'object',
  properties: {
    address: { $ref: 'https://myapp.io/Address' },
  },
} as const;
```

json-tology enforces this rule unconditionally. Registering a schema with an inline nested object throws an error:

```typescript
// This will throw — address is an anonymous inline object
const jt = new JsonTology({
  baseIRI: 'https://myapp.io',
  schemas: [UserSchema],  // throws: Structure validation failed
});
```

### Arrays

Array items that are structured objects also need their own schema:

```typescript
const OrderItemSchema = {
  $id: 'https://myapp.io/OrderItem',
  type: 'object',
  properties: {
    productId: { type: 'string' },
    quantity:  { type: 'integer', minimum: 1 },
    price:     { type: 'number', minimum: 0 },
  },
  required: ['productId', 'quantity', 'price'],
} as const;

const OrderSchema = {
  $id: 'https://myapp.io/Order',
  type: 'object',
  properties: {
    id:    { type: 'string', format: 'uuid' },
    items: { type: 'array', items: { $ref: 'https://myapp.io/OrderItem' } },
    total: { type: 'number', minimum: 0 },
  },
  required: ['id', 'items', 'total'],
} as const;
```

Arrays of primitives are fine inline:

```typescript
const TaggedSchema = {
  $id: 'https://myapp.io/Tagged',
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' } },  // ✅ fine — string is not a structured object
  },
} as const;
```

### Using $defs for Co-located Definitions

You can use `$defs` to keep related schemas together. $defs entries are definition sites — they're exempt from the inline rule as long as they have their own `$id`:

```typescript
const DirectorySchema = {
  $id: 'https://myapp.io/Directory',
  type: 'object',
  $defs: {
    Employee: {
      $id: 'https://myapp.io/Employee',
      type: 'object',
      properties: {
        name:  { type: 'string' },
        title: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
      required: ['name', 'email'],
    },
  },
  properties: {
    name:      { type: 'string' },
    employees: { type: 'array', items: { $ref: '#/$defs/Employee' } },
  },
  required: ['name'],
} as const;
```

---

## 2. Using Schemas as Types

Every schema declared with `as const` can derive a TypeScript type:

```typescript
import { Infer } from 'json-tology';

type Address   = Infer<typeof AddressSchema>;
// { street: string; city: string; state: string; zipCode?: string }

type User      = Infer<typeof UserSchema>;
// { id: string; name: string; email: string; age?: number; address?: ... }

type Status    = Infer<typeof StatusSchema>;
// 'active' | 'inactive' | 'suspended'

type OrderItem = Infer<typeof OrderItemSchema>;
// { productId: string; quantity: number; price: number }
```

### Composition Types

```typescript
import { Compose, Infer } from 'json-tology';

// Partial — all properties optional
const PatchUserSchema = Compose.partial(UserSchema, 'https://myapp.io/PatchUser');
type PatchUser = Infer<typeof PatchUserSchema>;

// Pick — subset of properties
const UserSummarySchema = Compose.pick(
  UserSchema,
  ['id', 'name'] as const,
  'https://myapp.io/UserSummary',
);
type UserSummary = Infer<typeof UserSummarySchema>;

// Extend — add properties
const AdminSchema = Compose.extend(
  UserSchema,
  { role: { type: 'string', enum: ['admin', 'superadmin'] } } as const,
  'https://myapp.io/Admin',
);
type Admin = Infer<typeof AdminSchema>;

// Discriminated union
const ShapeSchema = Compose.discriminatedUnion(
  'kind',
  [CircleSchema, RectSchema] as const,
  'https://myapp.io/Shape',
);
type Shape = Infer<typeof ShapeSchema>;
```

### Transform Types

Transforms change the parse output type without changing the schema:

```typescript
import { Transform, ParseOutput } from 'json-tology';

const DateSchema = Transform.create(
  { $id: 'https://myapp.io/Date', type: 'string', format: 'date-time' } as const,
  {
    decode: (s: string) => new Date(s),
    encode: (d: Date) => d.toISOString(),
  },
);

type DateInput  = Infer<typeof DateSchema>;          // string (the wire type)
type DateOutput = ParseOutput<typeof DateSchema>;     // Date   (the decoded type)
```

### Branded Types

```typescript
import { Transform, BrandOutput } from 'json-tology';

const UserIdSchema = Transform.brand(
  { $id: 'https://myapp.io/UserId', type: 'string' } as const,
  'UserId',
);

type UserId = BrandOutput<typeof UserIdSchema>;
// string & { readonly brand: 'UserId' }
```

---

## 3. Materialization

Materialization creates valid instances with defaults applied:

```typescript
const jt = new JsonTology({
  baseIRI: 'https://myapp.io',
  schemas: [AddressSchema, UserSchema, OrderSchema],
});

// Create an instance with defaults filled in
const user = jt.materialize(UserSchema, {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Alice',
  email: 'alice@example.com',
});
// user is fully typed as Infer<typeof UserSchema>

// Generate a default instance from schema defaults
import { Value } from 'json-tology';
const defaults = Value.create(UserSchema);
// { id: '', name: '', email: '' } — required fields with type-zero values
```

### Parse Pipeline

The full parse pipeline: clone → coerce → defaults → clean → validate → decode:

```typescript
// Strict parse — throws on invalid data
const user = jt.parse(UserSchema, rawInput);

// Safe parse — returns discriminated result
const result = jt.safeParse(UserSchema, rawInput);
if (result.success) {
  console.log(result.data);  // typed as Infer<typeof UserSchema>
} else {
  console.log(result.errors.messages());
}

// With transforms — parse returns the decoded type
const date = jt.parse(DateSchema, '2024-01-01T00:00:00Z');
// date is Date, not string
```

---

## 4. Domain (rdfs:domain)

`rdfs:domain` states: "any resource that has this property is an instance of this class." `rdfs:domain` is the JSON Schema surface for declaring that relationship.

When you place a property inside an object schema, the domain is implicit — the property belongs to that class. `rdfs:domain` makes this explicit for cases where the canonical domain differs from the structural parent, such as inherited properties or properties shared across multiple classes.

```typescript
const PersonSchema = {
  $id: 'https://myapp.io/Person',
  type: 'object',
  properties: {
    name: { type: 'string' },
  },
  required: ['name'],
} as const;

const EmployeeSchema = {
  $id: 'https://myapp.io/Employee',
  type: 'object',
  allOf: [{ $ref: 'https://myapp.io/Person' }],
  properties: {
    employeeId: { type: 'string' },
    // department is canonically a property of Employee, not Person
    department: {
      $ref: 'https://myapp.io/Department',
      'rdfs:domain': 'https://myapp.io/Employee',
      'rdfs:range':  'https://myapp.io/Department',
    },
  },
  required: ['employeeId'],
} as const;
```

In the OWL output, this produces the standard ontological assertion:
```turtle
<https://myapp.io/Employee#department>
    a owl:ObjectProperty ;
    rdfs:domain <https://myapp.io/Employee> ;
    rdfs:range <https://myapp.io/Department> .
```

Domain is declarative — it does not add runtime validation constraints. The structural parent class already enforces where a property can appear. `rdfs:domain` ensures the ontology graph carries the correct canonical domain assertion.

When `rdfs:domain` is absent, domain is inferred from the containing class — this is the common case and produces the same `rdfs:domain` in the ontology output.

---

## 5. Range (rdfs:range)

`rdfs:range` states: "the value of this property is an instance of this class." `rdfs:range` is the JSON Schema surface for declaring that relationship — and it is enforced at runtime.

Range is the semantic contract between a property and its value type. In json-tology, `rdfs:range` serves two purposes:

1. **Runtime validation**: The value (or each array item) is validated against the range schema
2. **Ontology assertion**: The property's `rdfs:range` is set to the declared class

### Object Properties

```typescript
const TeamSchema = {
  $id: 'https://myapp.io/Team',
  type: 'object',
  properties: {
    name: { type: 'string' },
    lead: {
      $ref: 'https://myapp.io/Employee',
      'rdfs:range': 'https://myapp.io/Employee',
    },
  },
  required: ['name', 'lead'],
} as const;
```

Here `$ref` provides the structural schema for validation, and `rdfs:range` declares the ontological relationship. When both are present and point to the same schema, range validation is consistent with structural validation. When they differ, both constraints are enforced — the value must satisfy the structural schema AND the range schema.

### Array Properties

```typescript
const DepartmentSchema = {
  $id: 'https://myapp.io/Department',
  type: 'object',
  properties: {
    name: { type: 'string' },
    members: {
      type: 'array',
      items: { $ref: 'https://myapp.io/Employee' },
      'rdfs:range': 'https://myapp.io/Employee',
    },
  },
  required: ['name', 'members'],
} as const;
```

For arrays, `rdfs:range` declares the type of each element. The engine validates every item in `members` against EmployeeSchema.

### Data Properties

For scalar properties, range maps to XSD datatypes and is inferred automatically from `type` and `format`:

```typescript
properties: {
  name:      { type: 'string' },                    // rdfs:range xsd:string
  age:       { type: 'integer' },                   // rdfs:range xsd:integer
  birthDate: { type: 'string', format: 'date' },    // rdfs:range xsd:date
}
```

`rdfs:range` is not needed for scalars — the ontology serializer derives the correct XSD range from the schema type. Use `rdfs:range` for object and array properties where the relationship to another entity class must be explicit.

When `rdfs:range` is absent for object/array properties, range is inferred from `$ref` or `items.$ref` where possible.

---

## 6. Object Properties vs Data Properties

In ontological terms:
- **Object properties** relate entities to other entities (owl:ObjectProperty)
- **Data properties** relate entities to literal values (owl:DatatypeProperty)

json-tology automatically classifies properties based on their schema:

### Data Properties (Scalars)

```typescript
const PersonSchema = {
  $id: 'https://myapp.io/Person',
  type: 'object',
  properties: {
    name:      { type: 'string' },                    // → owl:DatatypeProperty, range xsd:string
    age:       { type: 'integer' },                   // → owl:DatatypeProperty, range xsd:integer
    active:    { type: 'boolean' },                   // → owl:DatatypeProperty, range xsd:boolean
    score:     { type: 'number', format: 'float' },   // → owl:DatatypeProperty, range xsd:float
    birthDate: { type: 'string', format: 'date' },    // → owl:DatatypeProperty, range xsd:date
  },
  required: ['name'],
} as const;
```

### Object Properties (References)

```typescript
const EmployeeSchema = {
  $id: 'https://myapp.io/Employee',
  type: 'object',
  properties: {
    name:       { type: 'string' },                                  // data property
    department: { $ref: 'https://myapp.io/Department' },             // object property → range Department
    manager:    { $ref: 'https://myapp.io/Employee' },               // object property → self-reference
    skills:     { type: 'array', items: { $ref: 'https://myapp.io/Skill' } },  // object property → range rdf:List, itemType Skill
  },
  required: ['name'],
} as const;
```

The classification is automatic:
- `$ref` → `owl:ObjectProperty`
- `type: 'object'` → `owl:ObjectProperty`
- `type: 'array'` → `owl:ObjectProperty` (with `rdfs:range` as `rdf:List`)
- Everything else → `owl:DatatypeProperty`

You can verify the classification in the ontology output:

```typescript
const jt = new JsonTology({
  baseIRI: 'https://myapp.io',
  schemas: [PersonSchema, EmployeeSchema, DepartmentSchema, SkillSchema],
});

// OWL/Turtle output
console.log(jt.ontology().n3());

// SHACL output
console.log(jt.ontology().shacl());

// JSON-LD
console.log(jt.ontology().jsonLd());
```

---

## 7. Full Example: A Domain Model

```typescript
import { JsonTology, Infer, Compose, Transform, Value } from 'json-tology';

// ── Entity Declarations ──

const MoneySchema = {
  $id: 'https://shop.io/Money',
  type: 'object',
  properties: {
    amount:   { type: 'number', minimum: 0 },
    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'], default: 'USD' },
  },
  required: ['amount'],
} as const;

const ProductSchema = {
  $id: 'https://shop.io/Product',
  type: 'object',
  properties: {
    id:          { type: 'string', format: 'uuid' },
    name:        { type: 'string', minLength: 1 },
    description: { type: 'string' },
    price:       { $ref: 'https://shop.io/Money', 'rdfs:range': 'https://shop.io/Money' },
    tags:        { type: 'array', items: { type: 'string' } },
    active:      { type: 'boolean', default: true },
  },
  required: ['id', 'name', 'price'],
} as const;

const LineItemSchema = {
  $id: 'https://shop.io/LineItem',
  type: 'object',
  properties: {
    product:  { $ref: 'https://shop.io/Product', 'rdfs:range': 'https://shop.io/Product' },
    quantity: { type: 'integer', minimum: 1 },
    subtotal: { $ref: 'https://shop.io/Money',   'rdfs:range': 'https://shop.io/Money' },
  },
  required: ['product', 'quantity', 'subtotal'],
} as const;

const CustomerSchema = {
  $id: 'https://shop.io/Customer',
  type: 'object',
  properties: {
    id:    { type: 'string', format: 'uuid' },
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
  },
  required: ['id', 'name', 'email'],
} as const;

const OrderSchema = {
  $id: 'https://shop.io/Order',
  type: 'object',
  properties: {
    id:        { type: 'string', format: 'uuid' },
    customer:  { $ref: 'https://shop.io/Customer', 'rdfs:range': 'https://shop.io/Customer' },
    items:     { type: 'array', items: { $ref: 'https://shop.io/LineItem' }, 'rdfs:range': 'https://shop.io/LineItem' },
    total:     { $ref: 'https://shop.io/Money', 'rdfs:range': 'https://shop.io/Money' },
    status:    { type: 'string', enum: ['pending', 'confirmed', 'shipped', 'delivered'] },
    createdAt: { type: 'string', format: 'date-time' },
  },
  required: ['id', 'customer', 'items', 'total', 'status'],
} as const;

// ── Types ──

type Money    = Infer<typeof MoneySchema>;
type Product  = Infer<typeof ProductSchema>;
type LineItem = Infer<typeof LineItemSchema>;
type Customer = Infer<typeof CustomerSchema>;
type Order    = Infer<typeof OrderSchema>;

// ── Runtime ──

const jt = new JsonTology({
  baseIRI: 'https://shop.io',
  schemas: [MoneySchema, ProductSchema, LineItemSchema, CustomerSchema, OrderSchema],
});

// Validate
const errors = jt.validate('https://shop.io/Order', orderData);

// Parse (throws on failure)
const order: Order = jt.parse(OrderSchema, orderData);

// Materialize with defaults
const product = jt.materialize(ProductSchema, {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Widget',
  price: { amount: 9.99 },
});
// product.active === true (from default)
// product.price.currency === 'USD' (from default)

// Generate defaults from schema
const emptyMoney = Value.create(MoneySchema);
// { amount: 0, currency: 'USD' }

// Ontology — all entities and their relationships
console.log(jt.ontology().n3());
// Produces OWL classes for Money, Product, LineItem, Customer, Order
// with owl:ObjectProperty for references and owl:DatatypeProperty for scalars

// SHACL shapes
console.log(jt.ontology().shacl());

// ABox — instance data as RDF
const abox = jt.abox(OrderSchema, order);
console.log(abox.jsonLd());
```

---

## Summary

| Concept | Schema Pattern | Runtime Effect | Ontology Effect |
|---------|---------------|----------------|-----------------|
| Data property | `{ type: 'string' }` | Validates type | owl:DatatypeProperty |
| Object property | `{ $ref: '...' }` | Validates against ref schema | owl:ObjectProperty |
| Array of entities | `{ type: 'array', items: { $ref: '...' } }` | Validates each item | owl:ObjectProperty, range rdf:List |
| Domain | `'rdfs:domain': 'IRI'` | No validation effect | rdfs:domain (canonical class membership) |
| Range | `'rdfs:range': 'IRI'` | Validates value/items against range schema | rdfs:range (canonical value type) |
| Named entity | `{ $id: '...', type: 'object', properties: { ... } }` | Standard validation | owl:Class |
| Inline object | `{ type: 'object', properties: { ... } }` (no $id) | Error — registration throws | Unnamed — breaks graph |
