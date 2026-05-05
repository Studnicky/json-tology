# `Compose.equivalent`

## Declaration

```ts
Compose.equivalent(source, options): { $id, $ref, description?, title?, examples? }
```

## Use this when

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

## Don't use this when

The two schemas have _different structure_. If `PrimaryIsbn` had an extra constraint (e.g. must start with `978`), it is NOT equivalent to `Isbn` - use `Compose.extend` or a new standalone schema instead.

## Bad example

```ts
// BAD  - extend, not equivalent, because it adds a constraint
const Isbn978Schema = Compose.equivalent(IsbnSchema, {
  $id: 'urn:bookstore:Isbn978',
  pattern: '^978'  // NOT allowed  - adds constraint, changes structure
});
```

## Good example

```ts
// GOOD  - structurally identical, different domain role
const CatalogIsbn = Compose.equivalent(IsbnSchema, {
  $id: 'urn:bookstore:CatalogIsbn',
  description: 'ISBN as used in the public catalog feed.'
});
```

## Comparison to OWL `owl:equivalentClass`

`Compose.equivalent` is the JSON Schema authoring API for `owl:equivalentClass`. The two concepts are isomorphic: equivalent classes have identical extension (the same set of instances satisfies both), but serve different semantic roles in the domain model.

## Related / See also

- [OWL TBox output](/advanced/ontology#jt-totbox)
- [SHACL output](/advanced/ontology#jt-toshacl)
- [`Compose.extend`](/composition/extend) - structural extension (produces allOf+$ref, maps to `rdfs:subClassOf`)
- [Graph-native authoring](/advanced/graph-native-authoring) - why naming reduces drift
