# Sub-schemas and `$ref` composition <Badge type="warning" text="Compile-time + Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

A schema becomes a sub-schema of another by `$ref`-ing its `$id`. The parent owns the property slot; the registry resolves the reference at validation, instantiation, materialization, and TBox-emit time. The wire format stays a single declarative literal - no JS-level inheritance, no inlining.

This page states what holds across each of the four core operations. For runnable code, see [Sub-schema patterns](/usage-examples/sub-schema-patterns).

All examples use the [bookstore domain](/bookstore-domain).

---

## Pattern: name a value, reference it everywhere

```ts
import { JsonTology } from 'json-tology';

const EmailSchema = {
  $id: 'urn:bookstore:Email',
  type: 'string',
  format: 'email'
} as const;

const CustomerSchema = {
  $id: 'urn:bookstore:Customer',
  type: 'object',
  properties: {
    id:    { type: 'string', format: 'uuid' },
    email: { $ref: EmailSchema.$id }
  },
  required: ['id', 'email']
} as const;

const jt = JsonTology.create({
  baseIRI: 'urn:bookstore',
  schemas: [EmailSchema, CustomerSchema] as const
});
```

`EmailSchema` is the canonical definition of the value type "email." Any schema that wants an email field references its `$id`. The reference is symbolic, not structural - changing `EmailSchema` changes every consumer at once, and `findDuplicates()` will not flag two `$ref` slots as redundant.

---

## Validation reaches into `$ref`s

The validator follows `$ref` to the referenced schema and applies its constraints on the parent's slot. Error paths point at the parent's slot (e.g. `/email`), not at the referenced schema. Callers see one validation surface per request.

---

## Defaults from sub-schemas flow through `instantiate`

Defaults declared inside a referenced schema apply when the parent's value reaches that slot. The registry walks the `$ref` graph, so transitive defaults (a `$ref` to a schema that itself has a `$ref`) all resolve in a single pass.

---

## Coercion respects sub-schema constraints and Transforms

Format constraints on the referenced schema apply on the parent's slot. `Transform` decoders registered against the sub-schema's `$id` run on the parent's value too - one decoder, every reference.

---

## TBox emits a typed property edge per `$ref`

Every `$ref` in the TypeScript-side schema becomes a typed property edge in the canonical graph. The OWL projection emits `rdfs:domain` and `rdfs:range` for the parent class and the referenced class respectively. SHACL emits `sh:node` or `sh:datatype` constraints on the property shape. The same graph drives both projections.

---

## Composition through `$ref`s

Composite operators like `Compose.discriminatedUnion` and `Compose.extend` produce schemas that other schemas can `$ref` like any other registered entity. The validator descends through both layers automatically: variant selection or property merging happens inside the `$ref`, the rest of the parent is checked at the top level.

---

## Cycles are first-class

A sub-schema may `$ref` itself or any ancestor. The graph is allowed to be cyclic; the registry resolves a cycle by short-circuiting on the second visit, so type inference and runtime traversal both terminate. Validation, instantiation, and TBox emission all handle cycles without special configuration. The OWL output for a self-referential schema emits a single class with an `rdfs:domain` / `rdfs:range` self-edge.

---

## Worked patterns

See [Sub-schema patterns](/usage-examples/sub-schema-patterns) for runnable code: validation through $refs, defaults flow, coercion, TBox emission, composition with discriminatedUnion, and self-referential cycles.

---

## What you give up by inlining

Any of the patterns above can be written without `$ref`s by inlining the sub-schema body into the parent. That works, but it costs:

- The TypeScript type loses its name (you get the structural shape, not the named type).
- Two inline copies don't share a single ontology class - the OWL output emits two anonymous classes.
- `findDuplicates()` flags the two inline shapes as redundant.
- A change to the sub-schema requires updating every inline copy by hand.

For ergonomic, refactor-safe, ontology-friendly authoring: name every value type and `$ref` it.

---

## GraphEngine self-ref and embedded `$id` resolution <Badge type="tip" text="Runtime" />

When accessing the engine directly via `registry.engine(schemaObj).errors(data)`, self-references and embedded `$id` declarations inside `$defs` now resolve correctly.

- **Self-references**: `$ref` pointing to the root schema's own `$id` resolves correctly on the interpreted path, matching the behaviour of the compiled path (`registry.validate`).
- **Embedded `$id` in `$defs`**: `$ref` targets that point at an `$id` declared inside `$defs` (or any nested sub-schema) resolve on both the compiled and interpreted paths.

Previously these only worked on the `registry.validate` compiled fast-path. The two paths now produce the same validation results for all `$ref` shapes.

## Related

- [Picking a method](/picking-a-method) - validate vs instantiate vs materialize
- [Graph-native authoring](/advanced/graph-native-authoring) - why naming reduces drift
- [Composition: discriminatedUnion](/composition/discriminated-union) - oneOf as a sub-schema
- [Composition: extend](/composition/extend) - merging properties without `$ref` indirection
- [Sub-schema patterns](/usage-examples/sub-schema-patterns) - runnable code recipes

## See also

- [Bookstore domain](/bookstore-domain) - every entity uses `$ref` composition
- [Graph concepts](/advanced/graph-concepts) - TBox vs ABox, domain and range
- [Schemas — cross-schema `$ref` strict resolution](/schemas#cross-schema-ref-strict-resolution) — `REF_UNRESOLVED` error
