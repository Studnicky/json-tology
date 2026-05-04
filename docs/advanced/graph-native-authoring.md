# Graph-native authoring

json-tology's canonical representation is a graph. Every schema you register becomes a node; every property reference, composition, or inheritance chain becomes an edge. Getting the most from the ontology output - correct OWL TBox classes, sound SHACL shapes, and stable graph traversal - requires authoring schemas that map one-to-one with the concepts they describe.

This page explains what "graph-native" authoring means, how to detect and fix violations, and which strict-mode tools enforce it automatically.

## Why named primitives matter {#why-named-primitives-matter}

### The divergence problem

When you write the same constrained shape inline in two different schemas, the graph sees them as two separate, unrelated nodes:

```ts
// BAD  - three separate ISBN nodes in the graph
const BookSchema = {
  $id: 'urn:bookstore:Book',
  type: 'object',
  properties: {
    isbn: { type: 'string', pattern: '^\\d{13}$' }  // node 1
  }
} as const;

const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    isbn: { type: 'string', pattern: '^\\d{13}$' }  // node 2  - structurally identical but unrelated
  }
} as const;
```

The OWL output produces two anonymous DatatypeProperty ranges. Fix the ISBN regex once, and you have to find and update every copy. SHACL constraint propagation and rdfs:range reasoning work per-node - the two "isbn" properties have no declared relationship.

### The named-entity solution

```ts
// GOOD  - one ISBN node, two references
export const IsbnSchema = {
  $id: 'urn:bookstore:Isbn',
  type: 'string',
  pattern: '^\\d{13}$'
} as const;

const BookSchema = {
  $id: 'urn:bookstore:Book',
  type: 'object',
  properties: {
    isbn: { $ref: IsbnSchema.$id }
  }
} as const;

const OrderSchema = {
  $id: 'urn:bookstore:Order',
  type: 'object',
  properties: {
    isbn: { $ref: IsbnSchema.$id }
  }
} as const;
```

Now:
- Change the ISBN pattern in one place - both schemas update.
- OWL output emits `urn:bookstore:Isbn` as a named `rdfs:Datatype`.
- SHACL output links `sh:datatype` through the named type.
- `findDuplicates()` returns an empty array.

## The per-entity file convention {#per-entity-file-convention}

A predictable file layout makes graph-native authoring easy to follow. One file per `$id` segment:

```
entities/
  Isbn.ts            # $id: urn:bookstore:Isbn
  Author.ts          # $id: urn:bookstore:Author
  Book.ts            # $id: urn:bookstore:Book
  Order.ts           # $id: urn:bookstore:Order
  OrderLine.ts       # $id: urn:bookstore:OrderLine
```

Inside `Book.ts`:

```ts
import { IsbnSchema } from './Isbn.js';
import { AuthorSchema } from './Author.js';

export const BookSchema = {
  $id: 'urn:bookstore:Book',
  type: 'object',
  properties: {
    isbn:   { $ref: IsbnSchema.$id },
    author: { $ref: AuthorSchema.$id },
    title:  { type: 'string' }
  },
  required: ['isbn', 'title']
} as const;
```

Always show the import that defines the referenced shape - never use a bare string `$ref` pointing to an undocumented IRI.

## `Compose.equivalent` - domain-term distinction {#compose-equivalent}

### Declaration

```ts
Compose.equivalent(source, options): { $id, $ref, description?, title?, examples? }
```

### Use this when

You want to give a domain-distinct name to an existing schema without duplicating its structure. The two schemas are structurally identical - they validate the same data.

```ts
import { Compose } from 'json-tology';
import { IsbnSchema } from './Isbn.js';

export const PrimaryIsbnSchema = Compose.equivalent(IsbnSchema, {
  $id: 'urn:bookstore:PrimaryIsbn',
  description: 'The canonical ISBN used for catalog lookup and ordering.'
});
```

Output shape:

```json
{ "$id": "urn:bookstore:PrimaryIsbn", "$ref": "urn:bookstore:Isbn", "description": "..." }
```

In the OWL TBox, `PrimaryIsbn owl:equivalentClass Isbn` is emitted automatically. In SHACL, `PrimaryIsbn sh:node Isbn`.

### Don't use this when

The two schemas have _different structure_. If `PrimaryIsbn` had an extra constraint (e.g. must start with `978`), it is NOT equivalent to `Isbn` - use `Compose.extend` or a new standalone schema instead.

### Bad example

```ts
// BAD  - extend, not equivalent, because it adds a constraint
const Isbn978Schema = Compose.equivalent(IsbnSchema, {
  $id: 'urn:bookstore:Isbn978',
  pattern: '^978'  // NOT allowed  - adds constraint, changes structure
});
```

### Good example

```ts
// GOOD  - structurally identical, different domain role
const CatalogIsbn = Compose.equivalent(IsbnSchema, {
  $id: 'urn:bookstore:CatalogIsbn',
  description: 'ISBN as used in the public catalog feed.'
});
```

### Comparison to OWL `owl:equivalentClass`

`Compose.equivalent` is the JSON Schema authoring API for `owl:equivalentClass`. The two concepts are isomorphic: equivalent classes have identical extension (the same set of instances satisfies both), but serve different semantic roles in the domain model.

### Related / See also

- [OWL TBox output](/advanced/ontology#jt-totbox)
- [SHACL output](/advanced/ontology#jt-toshacl)
- `Compose.extend` - structural extension (produces allOf+$ref, maps to `rdfs:subClassOf`)

## `Compose.extend` produces allOf+$ref {#compose-extend}

`Compose.extend(parent, additions, newId)` emits:

```json
{
  "$id": "newId",
  "allOf": [
    { "$ref": "parent.$id" },
    { "type": "object", "properties": { ...additions } }
  ]
}
```

This shape maps cleanly to `rdfs:subClassOf` in the graph: the child IS-A parent plus extra properties. The parent schema must be registered before the child.

```ts
const AdminSchema = Compose.extend(UserSchema, {
  role: { type: 'string', enum: ['admin', 'superadmin'] }
} as const, 'https://myapp.io/Admin');
```

For more detail, see the [Compose.extend reference](/composition/extend).

## Detection and enforcement {#detection-and-enforcement}

### `SchemaRegistry.findDuplicates()` - on-demand check {#schemaregistry-findduplicates}

Call after registering your schemas to get a report of inline shapes that structurally match a registered top-level schema:

```ts
const registry = new SchemaRegistry();
registry.register(IsbnSchema);
registry.register(BookSchema); // has inline isbn: { type: 'string', pattern: ... }

const dups = registry.findDuplicates();
// [{ schemaId: 'urn:bookstore:Book', pointer: '/properties/isbn', equivalentTo: 'urn:bookstore:Isbn', shape: {...} }]
```

Returns:
```ts
ReadonlyArray<{
  schemaId: string;    // the schema containing the duplicate
  pointer: string;     // JSON pointer to the inline shape
  equivalentTo: string; // $id of the matching registered schema
  shape: Record<string, unknown>; // the structurally-equal shape
}>
```

### `enableInlineWarnings: true` - gentle nudges

Emits `logger.warn` at registration when inline-object or inline-primitive shapes are found. No throws. Requires a logger to be set.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  enableInlineWarnings: true,
  logger: myLogger
});
```

### `enableDuplicateDetection: true` - auto-run at registration

Runs `findDuplicates()` after each schema is registered and emits `logger.warn` if duplicates are found.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  enableDuplicateDetection: true,
  logger: myLogger
});
```

### `enableStrictGraph: true` - CI enforcement {#enablestrictgraph}

Promotes warnings to `SchemaError` throws. Every sub-schema must be either:
1. A `{ $ref: registeredSchemaId }` reference
2. A bare base type with no constraint keywords: `{ type: 'string' }`, `{ type: 'integer' }`, `{ type: 'boolean' }`, `{ type: 'array', items: <allowed> }`
3. Declared in the schema's own `$defs` namespace (the schema's internal ontology)

Inline constrained shapes - objects with `properties`, primitives with `pattern`/`format`/`minimum`/etc., array items with constraints - are all forbidden.

```ts
const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  enableStrictGraph: true,
  schemas: [...] as const  // all inline shapes throw SchemaError here
});
```

**What's allowed inline in strict mode:**
- `{ type: 'string' }` - no constraints
- `{ type: 'integer' }` - no constraints
- `{ type: 'boolean' }` - no constraints
- `{ type: 'array', items: { $ref: '...' } }` - array of named schemas
- `{ type: 'array', items: { type: 'string' } }` - array of base types
- `$defs` entries - the schema's own internal named types

**Migration path:**

1. Run `registry.findDuplicates()` on your existing schema set.
2. For each duplicate, extract the shape to a named schema file.
3. Replace inline occurrences with `{ $ref: newSchema.$id }`.
4. Enable `enableInlineWarnings: true` first (warn-only) to find stragglers.
5. Once warnings are clean, upgrade to `enableStrictGraph: true`.

**CI script example:**

```ts
// scripts/check-graph.ts
import { JsonTology } from 'json-tology';
import { schemas } from '../src/schemas.js';

const jt = JsonTology.create({ baseIRI: 'https://example.com', schemas });
const dups = jt.registry.findDuplicates();

if (dups.length > 0) {
  console.error('Duplicate inline shapes found:');
  for (const dup of dups) {
    console.error(`  ${dup.schemaId}#${dup.pointer} duplicates ${dup.equivalentTo}`);
  }
  process.exit(1);
}
```

## When inline is OK {#when-inline-is-ok}

Not every project needs strict graph mode. Inline shapes are fine when:

- The schema has a single consumer and will never be reused.
- It's a throwaway script or one-off data validation utility.
- You're prototyping and the ontology contract isn't relevant yet.

The cost of inline shapes is borne only by graph users: OWL/SHACL output is less precise, `findDuplicates()` reports noise, and global type changes require manual find-and-replace. If you're not using the ontology output, inline shapes have no runtime cost.

---

*Cross-references: [Ontology output](/advanced/ontology#jt-ontology) · [toQuads](/advanced/ontology#jt-toquads) · [toTbox](/advanced/ontology#jt-totbox) · [toShacl](/advanced/ontology#jt-toshacl)*

## See also

- [Bookstore domain](/bookstore-domain) - the running example domain
- [Your types are already a graph](/your-types-are-a-graph) - conceptual introduction to the graph model
- [Graph concepts](/advanced/graph-concepts) - TBox/ABox, OWA, equivalentClass
