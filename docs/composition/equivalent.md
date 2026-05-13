# `Compose.equivalent` <Badge type="info" text="Compile-time" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Creates a new schema with a different `$id` that references the source schema via `$ref`. The two schemas are structurally identical - they validate the same data - but serve different semantic roles in the domain model. In the OWL TBox, `owl:equivalentClass` is emitted automatically. In SHACL, the new schema gains `sh:node` pointing at the source.

```ts
Compose.equivalent(source, options): { $id, $ref, description?, title?, examples? }
```

**Use this when** you want to give a domain-distinct name to an existing schema without duplicating its structure. The canonical use is giving purpose-specific aliases to shared primitives - `PrimaryIsbn` wrapping `Isbn`, `CatalogPrice` wrapping `Money`: where the two names carry different semantic intent but must validate identically.

**Don't use this when** the two schemas have _different_ structure. If `PrimaryIsbn` had an extra constraint (e.g. must start with `978`), it is NOT equivalent to `Isbn`: use `Compose.extend` or a new standalone schema instead.

## Self-equivalence prevention <Badge type="info" text="Compile-time" />

`options.$id` cannot equal `source.$id`. A self-equivalent declaration surfaces a `SelfEquivalentType` brand error at the call site.

```ts
// compile error — same $id as IsbnSchema
const Bad = Compose.equivalent(IsbnSchema, { $id: IsbnSchema.$id });
```

## Examples

### Example 1: Domain alias for a primitive schema

Give the shared `IsbnSchema` a catalog-specific name. The two schemas validate identically; the alias carries the catalog-facing description.

```ts
import { Compose } from 'json-tology';
import { IsbnSchema } from './bookstore/index.js';

export const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  $id: 'https://bookstore.example/PrimaryIsbn',
  description: 'The canonical ISBN used for catalog lookup and ordering.',
});
// → { $id: 'https://bookstore.example/PrimaryIsbn', $ref: 'https://bookstore.example/Isbn', description: '...' }
```

In the OWL TBox:

```json
{ "@id": "https://bookstore.example/PrimaryIsbn", "owl:equivalentClass": { "@id": "https://bookstore.example/Isbn" } }
```

### Example 2: Named alias in a composed schema set

Register the alias alongside the source so both IDs are available to `validate` and `instantiate`.

```ts
import { Compose, JsonTology } from 'json-tology';
import { IsbnSchema, BookSchema } from './bookstore/index.js';

const CatalogIsbnSchema = Compose.equivalent(IsbnSchema, {
  $id: 'https://bookstore.example/CatalogIsbn',
  description: 'ISBN as used in the public catalog feed.',
});

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [IsbnSchema, CatalogIsbnSchema, BookSchema] as const,
});

// Both IDs validate identically
const a = jt.validate('https://bookstore.example/Isbn',        '9780140449136'); // ok.ok === true
const b = jt.validate('https://bookstore.example/CatalogIsbn', '9780140449136'); // ok.ok === true
```

### Example 3: OWL equivalence in the emitted TBox

```ts
import { JsonTology } from 'json-tology';
import { IsbnSchema } from './bookstore/index.js';

const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  $id: 'https://bookstore.example/PrimaryIsbn',
});

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [IsbnSchema, PrimaryIsbnSchema] as const,
});

const tbox = jt.toTbox().jsonLd();
// tbox includes:
// { "@id": "https://bookstore.example/PrimaryIsbn", "owl:equivalentClass": { "@id": "https://bookstore.example/Isbn" } }
```

## Bad examples: what NOT to do

### Anti-pattern 1: Using equivalent when the new schema adds a constraint

```ts
import { Compose } from 'json-tology';
import { IsbnSchema } from './bookstore/index.js';

// ✗ Don't do this — adds a pattern constraint; the new schema is NOT structurally
// identical to Isbn, so owl:equivalentClass would be semantically wrong
const Isbn978Schema = Compose.equivalent(IsbnSchema, {
  $id: 'https://bookstore.example/Isbn978',
  // @ts-expect-error  — pattern is not a valid option on Compose.equivalent
  pattern: '^978',
});

// ✓ Do this — use extend (or a standalone schema) when adding constraints
import { Compose } from 'json-tology';
const Isbn978Schema = Compose.extend(
  IsbnSchema,
  { pattern: '^978' } as const,
  'https://bookstore.example/Isbn978',
);
```

### Anti-pattern 2: Registering only the alias, not the source

```ts
import { JsonTology } from 'json-tology';

// ✗ Don't do this — CatalogIsbn $refs Isbn, but Isbn is not registered;
// validate/instantiate will throw a GraphError on ref resolution
const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [CatalogIsbnSchema] as const, // missing IsbnSchema
});

// ✓ Do this — register source before (or alongside) the alias
const jt2 = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  schemas: [IsbnSchema, CatalogIsbnSchema] as const,
});
```

### Anti-pattern 3: Using equivalent to rename a class in place

```ts
// ✗ Don't do this — if you no longer need the original name, don't alias it;
// simply change the $id on the source schema and update references
const RenamedIsbn = Compose.equivalent(IsbnSchema, { $id: 'https://bookstore.example/BookId' });
// Two names in the registry for the same thing creates drift

// ✓ Do this — use equivalent only when both names must coexist in the domain model
```

## Comparison

::: code-group

```ts [json-tology]
const CatalogIsbn = Compose.equivalent(IsbnSchema, {
  $id: 'https://bookstore.example/CatalogIsbn',
  description: 'ISBN as used in the public catalog feed.',
});
// Emits owl:equivalentClass in the TBox; sh:node in SHACL output.
```

```ts [Zod]
// Zod has no aliasing primitive. Create a branded type or simply re-use the schema:
const CatalogIsbn = IsbnSchema; // structural alias only, no semantic distinction
// Limitation: no OWL/SHACL output; no $ref-backed graph identity.
```

```ts [Valibot]
import * as v from 'valibot';
// Valibot has no aliasing primitive. Wrap with a pipe or simply re-assign:
const CatalogIsbn = IsbnSchema; // same object reference — no distinct schema ID
// Limitation: no graph representation; cannot emit owl:equivalentClass.
```

```ts [io-ts]
// io-ts: rename via a codec wrapper — structural only, no semantic identity
const CatalogIsbn = IsbnCodec; // same codec reference
// Limitation: no $ref-backed identity; no OWL output.
```

```ts [AJV]
// AJV: register the same schema under a second ID:
ajv.addSchema({ ...IsbnSchema, $id: 'https://bookstore.example/CatalogIsbn' });
// Limitation: copies the schema object; no owl:equivalentClass emitted;
// structural drift possible if the copy diverges.
```

```py [Pydantic]
# Python: subclass with no additions:
class CatalogIsbn(Isbn):
    pass
# Limitation: produces a subclass in the Python type system, not an
# equivalent; model_json_schema() does not emit owl:equivalentClass.
```

:::

## Related / See also

- [OWL TBox output](/advanced/ontology#jt-totbox)
- [SHACL output](/advanced/ontology#jt-toshacl)
- [`Compose.extend`](/composition/extend) - structural extension (produces allOf+$ref, maps to `rdfs:subClassOf`)
- [`Compose.subClassOf`](/composition/sub-class-of) - explicit taxonomic subclass with optional multi-parent
- [Graph-native authoring](/advanced/graph-native-authoring) - why naming reduces drift
