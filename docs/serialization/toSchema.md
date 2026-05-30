# `jt.toSchema`

**Declaration.** Reconstructs a JSON Schema document from the canonical graph for a registered schema. Returns `Record<string, unknown> | undefined` - `undefined` when the schema is not registered. The reconstructed schema reflects the normalized canonical representation, which may differ slightly from the original authored schema.

**Use this when** you want to verify round-trip fidelity - that the canonical graph preserves all structural semantics from the authored schema. Also useful for producing normalized/canonical versions of schemas for display, debugging, or downstream tooling.

**Don't use this when** you need the original schema object as-authored (use [`jt.registry.get`](/registry/register#registry-get) instead). `get` returns the original object reference; `toSchema` returns a new object reconstructed from the internal graph.

## Examples

### Example 1: Round-trip an Order schema

<RunnableExample src="examples/docs/serialization/09-toschema-roundtrip" />

### Example 2: Verify a composed schema round-trips correctly

<RunnableExample src="examples/docs/serialization/10-toschema-composed" />

### Example 3: Undefined for unregistered schemas

<RunnableExample src="examples/docs/serialization/11-toschema-undefined" />

## Bad examples: what NOT to do

### Anti-pattern 1: Using toSchema when you need the original authored object

<RunnableExample src="examples/docs/serialization/12-toschema-antipattern-original-object" />

### Anti-pattern 2: Using the reconstructed schema as a source of truth for structural comparison

<RunnableExample src="examples/docs/serialization/13-toschema-antipattern-structural-compare" />

### Anti-pattern 3: Calling toSchema for an unregistered schema without handling undefined

<RunnableExample src="examples/docs/serialization/14-toschema-antipattern-undefined" />

## Comparison

::: code-group

```ts [json-tology]
jt.toSchema('https://bookstore.example/Book')
// Reconstructed from internal canonical graph
```

```ts [Zod]
// Not directly supported  - no JSON Schema reconstruction from Zod's runtime representation.
// Use zodToJsonSchema (third-party) to export JSON Schema.
```

```ts [Valibot]
// Use the `@valibot/to-json-schema` companion library:
import { toJsonSchema } from '@valibot/to-json-schema';
const jsonSchema = toJsonSchema(BookSchema);
// Limitation: produces JSON Schema from Valibot's runtime representation;
// no first-class graph reconstruction, and not all Valibot constructs map.
```

```ts [io-ts]
// Limitation: io-ts has no built-in JSON Schema export. Codecs are
// runtime values without a structural representation that maps cleanly
// onto JSON Schema; third-party tooling (io-ts-types, io-ts-codegen) can
// emit specific subsets but full round-trip is not supported.
```

```ts [TypeBox + Value]
// TypeBox schemas ARE plain JSON Schema  - no reconstruction needed.
// JSON.stringify(BookSchema) gives the schema directly.
```

```ts [AJV]
// Not directly supported  - AJV stores compiled validators, not schemas.
// Pass schema directly: JSON.stringify(bookSchema)
```

```py [Pydantic]
Book.model_json_schema()  # Exports JSON Schema from the model class
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

- [`jt.registry.get`](/registry/register#registry-get) - retrieve the original schema object (not reconstructed)
- [Ontology and Graphs](/advanced/ontology) - `toQuads` and `fromQuads` for the advanced graph API

## See also

- [Bookstore domain](/bookstore-domain) - where all schemas are defined
- [Schemas guide](/schemas) - schema registration and management
