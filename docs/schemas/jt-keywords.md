# JT keyword reference

json-tology adds a small set of `jt:`-prefixed keywords to JSON Schema. They are tracked alongside the standard keywords (see `KNOWN_SCHEMA_KEYWORDS` in `src/constants/SCHEMA_KEYWORDS.ts`) and read at specific points in the pipeline. Each keyword has a documented payload shape, semantics, and a clear "what reads it" answer.

| Keyword         | Payload                                | Read by                                    |
|-----------------|----------------------------------------|--------------------------------------------|
| `jt:alias`      | `string \| string[]`                   | `SchemaGraphSupport`                       |
| `jt:computed`   | `true`                                 | `Materializer` (via computed-field map)    |
| `jt:config`     | `{ extra?, frozen?, strict? }`         | `SchemaGraphSupport`, `Materializer`       |
| `jt:frozen`     | `true`                                 | `Materializer`, `SchemaRegistry`           |
| `jt:strict`     | `boolean`                              | `SchemaGraphSupport` (via `enableStrictTypes`) |

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used in the examples.

---

## `jt:alias`

**Payload.** `string` or `readonly string[]`.

**Semantics.** Records alternative IRIs (or local names) for the schema's owning class. Used when the same domain entity is known by more than one identifier - for example, a vendor IRI alongside the canonical project IRI.

**Read by.** `extractAliases()` in `src/modules/graph/SchemaGraphSupport.ts:55`. The aliases land on the canonical graph node and surface in OWL output as `owl:equivalentClass` or `skos:altLabel` declarations, depending on the active vocabulary plugins.

**Use this when** you publish RDF that needs to interoperate with externally minted IRIs for the same concept.

```ts
const BookSchema = {
  $id: 'https://bookstore.example/Book',
  type: 'object',
  'jt:alias': [
    'https://schema.org/Book',
    'https://www.loc.gov/mads/rdf/v1#Title',
  ],
  properties: {
    isbn:  { type: 'string', pattern: '^\\d{13}$' },
    title: { type: 'string' },
  },
  required: ['isbn', 'title'],
} as const;
```

## `jt:computed`

**Payload.** Literal `true`.

**Semantics.** Marks a property as derived. Callers cannot supply the value on input - doing so raises `InstantiationError` with code `COMPUTED_INPUT_FORBIDDEN`. The materializer fills it by calling the registered compute function during `instantiate` and `materialize`.

**Read by.** `Materializer` walks `node.schema['jt:computed']` (`SchemaGraphSupport.ts:347`) and resolves the matching function from the registry's `computedStore`.

**Use this when** a property is mechanically derivable from other fields - an order `total` from line items, a `displayName` concatenating fields, a hash of canonical content. Pair it with `addComputed` (or the `computeds` constructor option) to register the function.

```ts
const ComputedOrderSchema = {
  $id: 'https://bookstore.example/ComputedOrder',
  type: 'object',
  properties: {
    items:    { type: 'array', items: { $ref: 'https://bookstore.example/OrderLine' }, minItems: 1 },
    total:    { type: 'number', 'jt:computed': true },
    currency: { type: 'string', default: 'USD' },
  },
  required: ['items'],
} as const;
```

See [`addComputed`](/registry/computed) for the function-side contract.

## `jt:config`

**Payload.** Object with optional fields:

| Field      | Type                              | Effect                                                     |
|------------|-----------------------------------|------------------------------------------------------------|
| `extra`    | `'allow' \| 'forbid' \| 'ignore'` | Policy for properties not declared in `properties`         |
| `frozen`   | `boolean`                         | Materializer returns a deeply frozen value                 |
| `strict`   | `boolean`                         | Per-schema toggle for strict-types behaviour               |

**Semantics.** A bundled, schema-local configuration block. The fields mirror standalone `jt:frozen` and `jt:strict`, plus an `extra` policy that has no standalone form. When both `jt:frozen` and `jt:config.frozen` are present, either being `true` is enough to freeze.

**Read by.** `extractJtConfig()` in `src/modules/graph/SchemaGraphSupport.ts:69`, with `frozen` consumed at `Materializer.ts:44` and `SchemaRegistry.ts:379`.

**Use this when** you want to colocate several runtime policy bits without scattering individual keywords across the schema.

```ts
const FrozenAddressSchema = {
  $id: 'https://bookstore.example/FrozenAddress',
  type: 'object',
  'jt:config': {
    extra:  'forbid',  // throw on unknown properties
    frozen: true,      // Object.freeze the materialized value
  },
  properties: {
    street:     { type: 'string' },
    city:       { type: 'string' },
    postalCode: { type: 'string' },
  },
  required: ['street', 'city', 'postalCode'],
} as const;
```

The three `extra` values:

- `'allow'` - unknown properties pass through unchanged.
- `'forbid'` - unknown properties trigger `InstantiationError` with code `EXTRA_FORBIDDEN`.
- `'ignore'` - unknown properties are silently stripped during instantiation.

## `jt:frozen`

**Payload.** Literal `true`.

**Semantics.** Standalone shorthand for `jt:config.frozen: true`. The materializer applies a deep `Object.freeze` to the result. The schema registry also exposes the freeze flag on the canonical graph node so downstream consumers (validators, ontology projections) can reason about immutability.

**Read by.**

- `Materializer.isEffectivelyFrozen()` (`Materializer.ts:44`)
- `SchemaGraphSupport` populates `jtFrozen` on the graph node (`SchemaGraphSupport.ts:332`)
- `SchemaRegistry` checks freeze status during register/instantiate flow (`SchemaRegistry.ts:379`)

**Use this when** every materialized value of this schema should be immutable - configuration objects, value objects, snapshot records.

```ts
const MoneySchema = {
  $id: 'https://bookstore.example/Money',
  type: 'object',
  'jt:frozen': true,
  properties: {
    amount:   { type: 'number', exclusiveMinimum: 0 },
    currency: { type: 'string', minLength: 3, maxLength: 3 },
  },
  required: ['amount', 'currency'],
} as const;
```

Prefer `jt:config: { frozen: true }` when you also need `extra` or `strict`. Use the standalone form when freeze is the only policy.

## `jt:strict`

**Payload.** `boolean`.

**Semantics.** Per-schema override for strict-types behaviour - whether numeric strings coerce to numbers, whether `null` is rejected for typed fields, and so on. Without this keyword, the global `enableStrictTypes` option on `JsonTology.create` decides.

**Read by.** `SchemaGraphSupport.ts:333` reads `jt:strict` and surfaces it on the graph node as `jtStrict`. The strict-types path consumes it during validation compilation.

**Use this when** one schema in a registry needs the opposite policy from the rest - for example, a wire-facing payload that must reject coercions even though the rest of the system allows them.

```ts
import { JsonTology } from 'json-tology';

const StrictBookSchema = {
  $id: 'https://bookstore.example/StrictBook',
  type: 'object',
  'jt:strict': true,        // reject "12.99" as a string for `price`
  properties: {
    isbn:  { type: 'string', pattern: '^\\d{13}$' },
    title: { type: 'string' },
    price: { type: 'number', exclusiveMinimum: 0 },
  },
  required: ['isbn', 'title', 'price'],
} as const;

const jt = JsonTology.create({
  baseIRI: 'https://bookstore.example',
  enableStrictTypes: false, // global default: lenient
  schemas: [StrictBookSchema] as const,
});
```

## Related

- [Schemas overview](/schemas) - the broader keyword catalogue
- [`addComputed`](/registry/computed) - registers the function side of `jt:computed`
- [`addInvariant`](/registry/invariants) - cross-field validation, complements `jt:computed`
- [Materialize](/registry/materialize) - the place freeze and `extra` policies execute

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
- [Graph concepts](/advanced/graph-concepts) - how these keywords land on the canonical graph
