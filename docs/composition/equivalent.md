# `Compose.equivalent` <Badge type="info" text="Compile-time" />

> Validation modes: [Validation modes reference](/validation-modes)

**Declaration.** Creates a new schema with a different `$id` that references the source schema via `$ref`. The two schemas are structurally identical - they validate the same data - but serve different semantic roles in the domain model. In the OWL TBox, `owl:equivalentClass` is emitted automatically. In SHACL, the new schema gains `sh:node` pointing at the source.

<!-- inline-ts-ok: pseudocode signature describing the function's return shape; not a runnable expression. -->
```ts
Compose.equivalent(source, options): { $id, $ref, description?, title?, examples? }
```

**Use this when** you want to give a domain-distinct name to an existing schema without duplicating its structure. The canonical use is giving purpose-specific aliases to shared primitives - `PrimaryIsbn` wrapping `Isbn`, `CatalogPrice` wrapping `Money`: where the two names carry different semantic intent but must validate identically.

**Don't use this when** the two schemas have _different_ structure. If `PrimaryIsbn` had an extra constraint (e.g. must start with `978`), it is NOT equivalent to `Isbn`: use `Compose.extend` or a new standalone schema instead.

## Self-equivalence prevention <Badge type="info" text="Compile-time" />

`options.$id` cannot equal `source.$id`. A self-equivalent declaration surfaces a `SelfEquivalentType` brand error at the call site.

<RunnableExample src="examples/docs/composition/45-antipattern-self-equivalent" />

## Examples

### Example 1: Domain alias for a primitive schema

Give the shared `IsbnSchema` a catalog-specific name. The two schemas validate identically; the alias carries the catalog-facing description.

<RunnableExample src="examples/docs/composition/06-equivalent" />

In the OWL TBox:

```json
{ "@id": "https://bookstore.example/PrimaryIsbn", "owl:equivalentClass": { "@id": "https://bookstore.example/Isbn" } }
```

### Example 2: Named alias in a composed schema set

Register the alias alongside the source so both IDs are available to `validate` and `instantiate`.

<RunnableExample src="examples/docs/composition/16-equivalent-catalog-isbn" />

### Example 3: OWL equivalence in the emitted TBox

<RunnableExample src="examples/docs/composition/17-equivalent-tbox" />

## Bad examples: what NOT to do

### Anti-pattern 1: Using equivalent when the new schema adds a constraint

<RunnableExample src="examples/docs/composition/18-antipattern-equivalent-with-constraint" />

### Anti-pattern 2: Registering only the alias, not the source

<RunnableExample src="examples/docs/composition/19-antipattern-equivalent-without-source" />

### Anti-pattern 3: Using equivalent to rename a class in place

<RunnableExample src="examples/docs/composition/20-antipattern-equivalent-rename" />

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


```ts [TypeBox]
// Limitation: feature not directly supported in TypeBox. See /comparisons for the matrix.
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

- [`Compose.extend`](/composition/extend) - structural extension (produces allOf+$ref, maps to `rdfs:subClassOf`)
- [`Compose.subClassOf`](/composition/sub-class-of) - explicit taxonomic subclass with optional multi-parent
- [Graph concepts (TBox/ABox)](/advanced/graph-concepts)

## See also

- [OWL TBox output](/advanced/ontology#jt-totbox)
- [SHACL output](/advanced/ontology#jt-toshacl)
- [Graph-native authoring](/advanced/graph-native-authoring) - why naming reduces drift
