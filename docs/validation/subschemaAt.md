# `JsonTology.subschemaAt`

**Declaration.** Resolves a sub-schema at a JSON Pointer path within a registered schema, returning the sub-schema as a registerable schema object with a synthesized `$id`. The returned schema can be passed directly to `is`, `validate`, `instantiate`, or `materialize`.

**Use this when** you need to work with a sub-schema in isolation - validating a single form field on blur, instantiating array items, or re-using a nested schema across multiple call sites. The JSON Pointer syntax follows RFC 6901: `'/properties/fieldName'` for a top-level property, `'/properties/items/items'` for the array item sub-schema.

**Don't use this when** you need to validate the whole object (use [`validate`](/validation/validate) or [`instantiate`](/validation/instantiate) instead).

## Examples

### Example 1: Validate a single field on blur

```ts
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

// Resolve the isbn sub-schema once
const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');

// isbn must match ^\d{13}$
const errors = bookstoreEntities.validate(isbnSchema, '978014044913');   // 12 digits  - requires 13
console.log(errors.items.map(e => e.message));
// ['must match pattern "^\\d{13}$"']
```

### Example 2: Instantiate an array item sub-schema

```ts
import { bookstoreEntities, OrderSchema } from './bookstore/index.js';

const lineItemSchema = bookstoreEntities.subschemaAt(OrderSchema.$id, '/properties/items/items');

const line = bookstoreEntities.instantiate(lineItemSchema, {
  bookId: 'b-1',
  quantity: 2
});
// line is a typed OrderLine with defaults applied
```

### Example 3: Compose subschemaAt with is()

```ts
const priceSub = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/price');

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

## Bad examples: what NOT to do

### Anti-pattern 1: Passing the raw property value instead of the JSON Pointer

```ts
import { bookstoreEntities, BookSchema } from './bookstore/index.js';

// ✗ Don't do this — passing a property name string instead of a JSON Pointer
const wrong = bookstoreEntities.subschemaAt(BookSchema.$id, 'isbn');
// → resolves to undefined; the pointer must start with '/'

// ✓ Do this — JSON Pointer with leading slash per RFC 6901
const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');
```

### Anti-pattern 2: Calling subschemaAt repeatedly inside a loop

```ts
// ✗ Don't do this — re-resolves and re-registers the sub-schema on every iteration
for (const rawIsbn of candidateIsbns) {
  const sub = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');
  bookstoreEntities.validate(sub, rawIsbn);
}

// ✓ Do this — resolve once, reuse across calls
const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');
for (const rawIsbn of candidateIsbns) {
  bookstoreEntities.validate(isbnSchema, rawIsbn);
}
```

### Anti-pattern 3: Using subschemaAt when you want the full object validated

```ts
// ✗ Don't do this — sub-schema validation ignores sibling constraints
const isbnSub = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');
entities.validate(isbnSub, rawBook);  // misses required, price, authors…

// ✓ Do this — validate the full object against its registered schema
entities.validate(BookSchema.$id, rawBook);
```

## Comparison

::: code-group

```ts [json-tology]
const isbnSchema = bookstoreEntities.subschemaAt(BookSchema.$id, '/properties/isbn');
// auto-registered; subsequent validate/is/instantiate calls resolve by synthesized $id
const errs = bookstoreEntities.validate(isbnSchema, '978014044913');
```

```ts [Zod]
// Zod schemas compose as objects; access a property sub-schema directly:
const isbnSchema = BookSchema.shape.isbn;
const result = isbnSchema.safeParse('978014044913');
// Limitation: no JSON Pointer addressing; nested path access requires manual
// traversal of .shape/.element/.items for arrays.
```

```ts [Valibot]
import * as v from 'valibot';
// Access a nested entry from an object schema:
const isbnSchema = BookSchema.entries.isbn;
const result = v.safeParse(isbnSchema, '978014044913');
// Limitation: .entries is schema-specific; no generic JSON Pointer resolver.
```

```ts [AJV]
import Ajv from 'ajv';
const ajv = new Ajv();
ajv.addSchema(BookSchema);
// Resolve a sub-schema by JSON Pointer using getSchema + $ref trick:
const validate = ajv.getSchema('https://bookstore.example/Book#/properties/isbn');
const valid = validate?.('978014044913');
// Requires the pointer fragment to already appear in the schema's $defs or
// properties; AJV does not auto-register synthesized sub-schemas.
```

```ts [TypeBox + Value]
import { Type } from '@sinclair/typebox';
import { TypeCompiler } from '@sinclair/typebox/compiler';
// Manually extract a property sub-schema:
const isbnSchema = BookSchema.properties.isbn;
const C = TypeCompiler.Compile(isbnSchema);
const errors = [...C.Errors('978014044913')];
// Limitation: manual property access; no JSON Pointer resolver; sub-schemas
// are not auto-registered or reachable by synthesized ID.
```

```py [Pydantic]
# Pydantic v2 — access a field's annotation for targeted validation:
from pydantic import TypeAdapter
ta = TypeAdapter(str)  # manually construct from Book.model_fields['isbn'].annotation
result = ta.validate_python('978014044913')
# No JSON Pointer resolver; requires manual field lookup.
```

:::

## Return type

The returned object has a synthesized `$id` of the form `<parent.$id>#<pointer>`:

```ts
const sub = bookstoreEntities.subschemaAt(OrderSchema.$id, '/properties/items');
// sub.$id === 'https://example.io/Order#/properties/items'
```

The schema is automatically registered in the calling registry. Subsequent calls to `validate`, `is`, `instantiate`, or `materialize` with the same synthesized ID will resolve immediately without re-walking the graph.

## Related

- [`JsonTology.validate`](/validation/validate) - validate a full object against a schema
- [`JsonTology.instantiate`](/validation/instantiate) - validate + apply defaults + return typed value
- [`JsonTology.is`](/validation/is) - boolean type guard
- [`JsonTology.materialize`](/registry/materialize) - build from partial trusted data + defaults

## See also

- [Argument conventions](/argument-conventions) - how `SchemaRef` works (string or object)
- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
- [Graph concepts](/advanced/graph-concepts) - how JSON Pointer addresses sub-schema nodes
