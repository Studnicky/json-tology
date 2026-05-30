# Sub-schema patterns

Runnable code patterns that demonstrate how registered sub-schemas behave under each of the four core operations: validation, instantiation (defaults and coercion), TBox emission, composition through `$refs`, and self-referential cycles. The declarative summary lives at [Sub-schemas and `$ref` composition](/advanced/sub-schemas).

All examples use the [bookstore domain](/bookstore-domain).

---

## Validation reaches into `$ref`s

<RunnableExample src="examples/docs/usage-examples/01-sub-schema-patterns" />

The validator follows the `$ref` to `EmailSchema` and applies its `format: 'email'` constraint. The error path points at the parent's slot (`/email`), not at the referenced schema. Callers see one validation surface per request.

---

## Defaults from sub-schemas flow through `instantiate`

<RunnableExample src="examples/docs/usage-examples/44-sub-schema-defaults-flow" />

Defaults declared inside a referenced schema apply when the parent's value reaches that slot. The registry walks the `$ref` graph, so transitive defaults (a `$ref` to a schema that itself has a `$ref`) all resolve in a single pass.

---

## Coercion respects sub-schema constraints and Transforms

<RunnableExample src="examples/docs/usage-examples/45-sub-schema-coercion-transforms" />

Format constraints on the referenced schema apply on the parent's slot. `Transform` decoders registered against the sub-schema's `$id` run on the parent's value too - one decoder, every reference.

---

## TBox emits a typed property edge per `$ref`

<RunnableExample src="examples/docs/usage-examples/46-sub-schema-tbox-property-edges" />

Every `$ref` in the TypeScript-side schema becomes a typed property edge in the canonical graph. The OWL projection emits `rdfs:domain` and `rdfs:range` for the parent class and the referenced class respectively. SHACL emits `sh:node` or `sh:datatype` constraints on the property shape. The same graph drives both projections.

---

## Composition through `$ref`s: a discriminated union as a sub-schema

<RunnableExample src="examples/docs/usage-examples/47-sub-schema-discriminated-union" />

The composite (`OrderWithPaymentSchema`) is what the caller validates. Its `payment` slot is a `$ref` to the discriminated union. The validator descends through both layers automatically: variant selection happens inside the `$ref`, the rest of the order is checked at the top level.

---

## Self-referential cycles

A sub-schema may `$ref` itself or any ancestor. The graph is allowed to be cyclic; the registry resolves a cycle by short-circuiting on the second visit, so type inference and runtime traversal both terminate.

<RunnableExample src="examples/docs/usage-examples/48-sub-schema-self-referential" />

`PersonSchema.manager` references `PersonSchema` itself. Validation, instantiation, and TBox emission all handle the cycle without special configuration. The OWL output emits a single class with an `rdfs:domain` / `rdfs:range` self-edge.

---

## Related

- [Sub-schemas and `$ref` composition](/advanced/sub-schemas) - declarative summary
- [Picking a method](/picking-a-method) - validate vs instantiate vs materialize
- [Composition: discriminatedUnion](/composition/discriminated-union) - oneOf as a sub-schema
- [Composition: extend](/composition/extend) - merging properties without `$ref` indirection

## See also

- [Bookstore domain](/bookstore-domain) - every entity uses `$ref` composition
- [Graph concepts](/advanced/graph-concepts) - TBox vs ABox, domain and range
