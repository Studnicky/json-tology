# `JsonTology.subschemaAt`

**Declaration.** Resolves a sub-schema at a JSON Pointer path within a registered schema, returning the sub-schema as a registerable schema object with a synthesized `$id`. The returned schema can be passed directly to `is`, `validate`, `instantiate`, or `materialize`.

**Use this when** you need to work with a sub-schema in isolation — validating a single form field on blur, instantiating array items, or re-using a nested schema across multiple call sites. The JSON Pointer syntax follows RFC 6901: `'/properties/fieldName'` for a top-level property, `'/properties/items/items'` for the array item sub-schema.

**Don't use this when** you need to validate the whole object (use [`validate`](/validation/validate) or [`instantiate`](/validation/instantiate) instead).

## Examples

### Example 1: Validate a single field on blur

```ts
import { bookstoreEntities as entities, BookSchema } from './bookstore/index.js';

// Resolve the isbn sub-schema once
const isbnSchema = entities.subschemaAt(BookSchema.$id, '/properties/isbn');

// isbn must match ^\d{13}$
const errors = entities.validate(isbnSchema, '978014044913');   // 12 digits — requires 13
console.log(errors.items.map(e => e.message));
// ['must match pattern "^\\d{13}$"']
```

### Example 2: Instantiate an array item sub-schema

```ts
import { bookstoreEntities as entities, OrderSchema } from './bookstore/index.js';

const lineItemSchema = entities.subschemaAt(OrderSchema.$id, '/properties/items/items');

const line = entities.instantiate(lineItemSchema, {
  bookId: 'b-1',
  quantity: 2
});
// line is a typed OrderLine with defaults applied
```

### Example 3: Compose subschemaAt with is()

```ts
const priceSub = entities.subschemaAt(BookSchema.$id, '/properties/price');

if (!entities.is(priceSub, candidatePrice)) {
  console.error('price is not a valid Amount');
}
```

### Example 4: Static variant (no instance required)

```ts
import { JsonTology } from 'json-tology';

const sub = JsonTology.subschemaAt(OrderSchema, '/properties/customerId');
// sub.$id === 'https://example.io/Order#/properties/customerId'
```

## Return type

The returned object has a synthesized `$id` of the form `<parent.$id>#<pointer>`:

```ts
const sub = entities.subschemaAt(OrderSchema.$id, '/properties/items');
// sub.$id === 'https://example.io/Order#/properties/items'
```

The schema is automatically registered in the calling registry. Subsequent calls to `validate`, `is`, `instantiate`, or `materialize` with the same synthesized ID will resolve immediately without re-walking the graph.
