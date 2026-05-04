# `Transform.pipe`

**Declaration.** Composes multiple decode/encode function pairs into a single transform pipeline attached to a schema. Decode runs left-to-right through the array; encode runs right-to-left. The schema object is never mutated — the pipeline is stored in a WeakMap keyed by the schema object. Returns `TransformedType<TSchema, TOut>`.

**Use this when** a single wire value requires sequential transformation steps — for example, stripping formatting characters from a price string, then parsing the result to a float. Or decoding a compressed/encoded field in two passes.

**Don't use this when** a single decode/encode pair is sufficient (use [`Transform.create`](/transforms/decode-encode) instead — simpler, clearer intent). Don't use it for nominal typing without conversion (use [`Transform.brand`](/transforms/brand)).

## Examples

### Example 1: Formatted price string to float (two steps)

```ts
import { Transform, JsonTology } from 'json-tology';

const FormattedPriceSchema = {
  $id:  'https://bookstore.example/FormattedPrice',
  type: 'string',
} as const;

const PricedSchema = Transform.pipe<typeof FormattedPriceSchema, number>(
  FormattedPriceSchema,
  [
    // Step 1: strip currency symbol and commas
    {
      decode: (raw: unknown) => (raw as string).replace(/[$,]/g, ''),
      encode: (stripped: unknown) => `$${stripped as string}`,
    },
    // Step 2: parse to float
    {
      decode: (stripped: unknown) => parseFloat(stripped as string),
      encode: (num: unknown) => (num as number).toFixed(2),
    },
  ],
);

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [PricedSchema] as const,
});

const price = jt.instantiate(PricedSchema.$id, '$14.99');
console.log(price); // 14.99

const wire = jt.encode(PricedSchema, price as number);
console.log(wire);  // '14.99'
```

### Example 2: Decode direction is left-to-right, encode is right-to-left

```ts
// Decode: step1.decode → step2.decode → ...
// Encode: ... → step2.encode → step1.encode

// With 3 steps [A, B, C]:
// decode: A.decode(wire) → B.decode(result) → C.decode(result) = domain
// encode: C.encode(domain) → B.encode(result) → A.encode(result) = wire
```

## Bad examples — what NOT to do

### Anti-pattern 1: Using pipe for a single transformation step

```ts
// ⊥ Don't do this — pipe with one step is unnecessarily complex
Transform.pipe<typeof Schema, Date>(schema, [
  { decode: (s: unknown) => new Date(s as string), encode: (d: unknown) => (d as Date).toISOString() },
]);

// ✓ Do this — Transform.create is designed for one-step transforms
Transform.create(schema, {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
});
```

## Comparison

::: code-group

```ts [json-tology]
Transform.pipe<typeof Schema, number>(schema, [
  { decode: raw => raw.replace(/[$,]/g, ''), encode: s => `$${s}` },
  { decode: s => parseFloat(s),              encode: n => n.toFixed(2) },
]);
// Decode runs left-to-right; encode runs right-to-left.
```

```ts [Zod]
// Zod chains transforms sequentially via .transform():
const schema = z.string()
  .transform(s => s.replace(/[$,]/g, ''))
  .transform(s => parseFloat(s));
// No built-in encode reversal.
```

```ts [TypeBox + Value]
// Not built in — apply transformations manually after validation.
```

```ts [AJV]
// Not built in.
```

```py [Pydantic]
from pydantic import field_validator

class PricedItem(BaseModel):
    price: float

    @field_validator('price', mode='before')
    @classmethod
    def parse_price(cls, v):
        if isinstance(v, str):
            return float(v.replace('$', '').replace(',', ''))
        return v
# No built-in multi-step pipeline or encode reversal.
```

:::

## Related

- [`Transform.create`](/transforms/decode-encode) — single decode/encode pair (simpler)
- [`jt.encode`](/transforms/decode-encode#jtencode) — apply the encode pipeline to convert domain → wire
- [Serialization](/serialization/dump) — `dump()` applies `encode` during schema graph traversal

## See also

- [Bookstore domain](/bookstore-domain) — where price schemas are used
