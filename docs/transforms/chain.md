# `Transform.chain` <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Composes multiple decode/encode function pairs into a single transform chain attached to a schema. Decode runs left-to-right through the array; encode runs right-to-left. The schema object is never mutated - the chain is stored in a WeakMap keyed by the schema object. Returns `TransformedType<TSchema, TOut>`.

**Use this when** a single wire value requires sequential transformation steps - for example, stripping formatting characters from a price string, then parsing the result to a float. Or decoding a compressed/encoded field in two passes.

**Don't use this when** a single decode/encode pair is sufficient (use [`Transform.create`](/transforms/decode-encode) instead - simpler, clearer intent). Don't use it for nominal typing without conversion (use [`Transform.brand`](/transforms/brand)).

## Examples

### Example 1: Formatted price string to float (two steps)

```ts
import { Transform, JsonTology } from 'json-tology';

const FormattedPriceSchema = {
  $id:  'https://bookstore.example/FormattedPrice',
  type: 'string',
} as const;

const PricedSchema = Transform.chain<typeof FormattedPriceSchema, number>(
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

## Pairwise chain compatibility <Badge type="info" text="Compile-time" />

`Transform.chain` enforces stage-to-stage type compatibility at the call site. Each stage is typed as `TransformStageInterface<TIn, TOut>`. The output type of stage `N` must be assignable to the input type of stage `N+1`. When a mismatch is detected, the incompatible stage position is replaced with a `ChainMismatchInterface<index, produced, expected>` brand - the compiler rejects the call and the IDE hover explains which stage is incompatible.

The first stage is also checked against the schema's wire type. A mismatch surfaces `ChainSchemaMismatchInterface<wire, firstStageIn>`.

```ts
const step1 = {
  decode: (s: string) => parseInt(s),
  encode: (n: number) => String(n)
};
const step2 = {
  decode: (n: number) => new Date(n),
  encode: (d: Date) => d.getTime()
};

// Correct — string → number → Date
const ok = Transform.chain(schema, [step1, step2]);

// Incorrect — step1 produces number, step3 expects string → compile error
const step3 = {
  decode: (s: string) => s.toUpperCase(),
  encode: (s: string) => s
};
const bad = Transform.chain(schema, [step1, step3]);
//                                            ^ ChainMismatchInterface<1, number, string>
```

The chain parameter is typed as `TStages & ValidateChainType<TStages, InferSchemaType<TSchema>>`. When validation fires, the intersection collapses incompatible positions to `never` and the user's literal stages are not assignable - the call site is rejected.

Chains are checked up to 10 stages (`TupleRecursionCap`).

## Bad examples - what NOT to do

### Anti-pattern 1: Using chain for a single transformation step

```ts
// ⊥ Don't do this  - chain with one step is unnecessarily complex
Transform.chain<typeof Schema, Date>(schema, [
  {
    decode: (s: unknown) => new Date(s as string),
    encode: (d: unknown) => (d as Date).toISOString()
  },
]);

// ✓ Do this  - Transform.create is designed for one-step transforms
Transform.create(schema, {
  decode: (s: string) => new Date(s),
  encode: (d: Date) => d.toISOString(),
});
```

## Comparison

::: code-group

```ts [json-tology]
Transform.chain<typeof Schema, number>(schema, [
  {
    decode: raw => raw.replace(/[$,]/g, ''),
    encode: s => `$${s}`
  },
  {
    decode: s => parseFloat(s),
    encode: n => n.toFixed(2)
  },
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

```ts [Valibot]
import * as v from 'valibot';
const schema = v.pipe(
  v.string(),
  v.transform((s) => s.replace(/[$,]/g, '')),
  v.transform((s) => parseFloat(s)),
);
// Limitation: v.pipe is decode-direction only; no encode reversal.
```

```ts [io-ts]
import * as t from 'io-ts';
// Limitation: io-ts has no built-in chaining of multiple decode/encode pairs.
// Each Type carries one decode + one encode; chain them by hand or build a
// composite codec class:
const StripCodec = new t.Type<string, string, string>(
  'Strip',
  t.string.is,
  (input) => t.success(input.replace(/[$,]/g, '')),
  (output) => `$${output}`,
);
const ParseCodec = new t.Type<number, string, string>(
  'Parse',
  (u): u is number => typeof u === 'number',
  (input) => t.success(parseFloat(input)),
  (output) => output.toFixed(2),
);
// Decode by composing manually: ParseCodec.decode(StripCodec.decode(raw).right)
```

```ts [TypeBox + Value]
// TypeBox has no chaining mechanism. Apply manually after validation:
const validated = Value.Check(schema, raw);
const stripped = (raw as string).replace(/[$,]/g, '');
const price = parseFloat(stripped);
// Limitation: no schema-bound chain; encode direction must be implemented
// separately; callers must manage step ordering manually.
```

```ts [AJV]
// AJV has no chaining mechanism. Apply transformations manually after validation.
// Limitation: no schema-bound chain; encode reversal is not automatic;
// step order is the caller's responsibility.
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
# No built-in multi-step chaining or encode reversal.
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

- [`Transform.create`](/transforms/decode-encode) - single decode/encode pair (simpler)
- [`jt.encode`](/transforms/decode-encode#jtencode) - apply the encode chain to convert domain → wire
- [Serialization](/serialization/dump) - `dump()` applies `encode` during schema graph traversal

## See also

- [Bookstore domain](/bookstore-domain) - where price schemas are used
