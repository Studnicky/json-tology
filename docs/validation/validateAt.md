# `JsonTology.validateAt`

**Declaration.** Validates data against the sub-schema identified by a JSON Pointer within a registered schema. Returns an array of human-readable error message strings. Returns an empty array when the sub-schema constraint is satisfied. Does not mutate input. Does not throw on validation failure.

**Use this when** you need to validate one field's sub-schema in isolation — for example, validating a single form field on blur, or checking that an individual `OrderLine` conforms before inserting into an array. The JSON Pointer syntax follows RFC 6901: `'/properties/fieldName'` for a top-level property, `'/properties/items/items'` for the array item sub-schema.

**Don't use this when** you need to validate the whole object (use [`validate`](/validation/validate) or [`coerce`](/validation/coerce) instead). Don't use it when you want structured errors (use [`errors`](/validation/errors)).

## Examples

### Example 1: Validate a single Book field on blur

```ts
import { jt, BookSchema } from './bookstore/schemas.js';

// isbn must match ^\d{13}$
const errors = jt.validateAt(
  BookSchema.$id,
  '/properties/isbn',
  '978014044913',   // 12 digits — pattern requires exactly 13
);
console.log(errors);
// ['/isbn: must match pattern "^\\d{13}$"']
```

### Example 2: Validate an array item sub-schema

```ts
import { jt, OrderSchema } from './bookstore/schemas.js';

const errors = jt.validateAt(
  OrderSchema.$id,
  '/properties/items/items',    // OrderLine sub-schema
  { bookIsbn: '9780140449136', quantity: 0, unitPrice: 12.99 },
);
console.log(errors);
// ['/quantity: must be >= 1']
```

### Example 3: Validate a nested address field

```ts
import { jt, CustomerSchema } from './bookstore/schemas.js';

// Validate a postalCode sub-field
const errors = jt.validateAt(
  CustomerSchema.$id,
  '/properties/addresses/items/properties/postalCode',
  12345,   // number instead of string
);
console.log(errors.length > 0); // true — must be string
```

## Bad examples — what NOT to do

### Anti-pattern 1: Using validateAt as a substitute for full validation

```ts
// ⊥ Don't do this — validateAt only checks the sub-schema, not the parent structure
jt.validateAt(CustomerSchema.$id, '/properties/email', 'alice@bookstore.example');
// This doesn't verify that id and name are also present

// ✓ Do this — use validate or coerce for the full object
jt.validate(CustomerSchema.$id, formData);
```

## Comparison

::: code-group

```ts [json-tology]
jt.validateAt(OrderSchema.$id, '/properties/items/items', lineData);
// validates lineData against the OrderLine sub-schema
```

```ts [Zod]
// Zod doesn't support JSON Pointer sub-schema validation directly.
// Access the nested schema via .shape:
OrderLineSchema.parse(lineData);
// Requires the sub-schema to be extracted as a named variable.
```

```ts [TypeBox + Value]
// Not directly supported via JSON Pointer.
// Access sub-schema manually and compile separately.
import { TypeCompiler } from '@sinclair/typebox/compiler';
const C = TypeCompiler.Compile(OrderSchema.properties.items.items);
const errors = [...C.Errors(lineData)].map(e => e.message);
```

```ts [AJV]
// AJV supports JSON Pointer via ajv.getSchema() but not arbitrary sub-schema extraction.
// Manual traversal required.
const itemSchema = orderSchema.properties.items.items;
const errors = ajv.validate(itemSchema, lineData) ? [] : ajv.errors!.map(e => e.message);
```

```py [Pydantic]
# Pydantic validates at model level.
# Sub-field validation uses field_validator:
from pydantic import field_validator

class Order(BaseModel):
    @field_validator('items', each_item=True)
    @classmethod
    def validate_line(cls, v):
        return OrderLine.model_validate(v)
```

:::

## Related

- [`JsonTology.validate`](/validation/validate) — full schema validation
- [`JsonTology.errors`](/validation/errors) — structured `ValidationErrors` from full validation
- [`JsonTology.coerce`](/validation/coerce) — validate + apply defaults + return typed value

## See also

- [Bookstore domain](/bookstore-domain) — schema definitions used in examples
