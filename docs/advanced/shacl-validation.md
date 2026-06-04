# SHACL validation (`validateWithShacl`)

> You only need this section if you want to validate ABox RDF quads against SHACL shapes. This is the inverse of `toShacl()`: emit shapes once, validate instances against them repeatedly.

`jt.validateWithShacl(shapes, data)` runs an in-process SHACL validator over a set of ABox quads. It accepts the `OntologyBuilder` returned by `toShacl()` directly, or a raw `QuadInterface[]` shape array. The data quads typically come from `toQuads()`.

---

## Declaration

<!-- inline-ts-ok: method signature pseudocode; not a standalone runnable expression -->
```ts
jt.validateWithShacl(
  shapes: OntologyBuilder | readonly QuadInterface[],
  data:   readonly QuadInterface[]
): ShaclValidationReportInterface
```

**`shapes`**: the SHACL shape set. Pass `jt.toShacl()` directly (the most common form), or a pre-built `QuadInterface[]` from `shaclQuads()`. Shapes are built from the schemas registered in the current `JsonTology` instance.

**`data`**: the ABox quad array to validate. Use `jt.toQuads(schema, value)` to produce it from a typed instance, or hand-craft quads when testing non-conforming scenarios (see example 113).

**Returns.** A `ShaclValidationReportInterface`:

| Field | Type | Description |
|-------|------|-------------|
| `conforms` | `boolean` | `true` when all constraints pass |
| `results` | `ShaclValidationResultInterface[]` | One entry per constraint violation |

---

## `ShaclValidationResultInterface`

Each violation entry in `report.results` carries:

| Field | Type | Description |
|-------|------|-------------|
| `focusNode` | `string` | IRI of the node that failed the shape constraint |
| `resultPath` | `string` | Predicate IRI of the property that failed |
| `resultSeverity` | `'Violation' \| 'Warning' \| 'Info'` | SHACL severity level |
| `sourceConstraintComponent` | `string` | IRI of the constraint component that fired |
| `value` | `unknown` | The offending value, when available |
| `resultMessage` | `string` | Human-readable description of the violation |

---

## Constraint components covered

`validateWithShacl` evaluates all SHACL shapes produced by `toShacl()`. The shape set includes:

| Component | SHACL IRI | Triggered by |
|-----------|-----------|--------------|
| `sh:MinCountConstraintComponent` | `sh:minCount` | Required properties absent |
| `sh:MaxCountConstraintComponent` | `sh:maxCount` | Properties exceeding cardinality |
| `sh:DatatypeConstraintComponent` | `sh:datatype` | Literal value with wrong XSD type |
| `sh:MinLengthConstraintComponent` | `sh:minLength` | String shorter than `minLength` |
| `sh:MaxLengthConstraintComponent` | `sh:maxLength` | String longer than `maxLength` |
| `sh:PatternConstraintComponent` | `sh:pattern` | String not matching `pattern` |
| `sh:MinInclusiveConstraintComponent` | `sh:minInclusive` | Number below `minimum` |
| `sh:MaxInclusiveConstraintComponent` | `sh:maxInclusive` | Number above `maximum` |
| `sh:MinExclusiveConstraintComponent` | `sh:minExclusive` | Number not above `exclusiveMinimum` |
| `sh:MaxExclusiveConstraintComponent` | `sh:maxExclusive` | Number not below `exclusiveMaximum` |
| `sh:NodeKindConstraintComponent` | `sh:nodeKind` | Subject is wrong node kind (IRI vs literal) |
| `sh:ClassConstraintComponent` | `sh:class` | Object does not have the expected `rdf:type` |

---

## Bounded scope

`validateWithShacl` validates shapes produced by `toShacl()` and `ShaclProjection`. It:

- Uses **implicit class targeting**: each `sh:NodeShape` is matched to subjects whose `rdf:type` quad names the corresponding class IRI. Focus nodes without a matching `rdf:type` are not evaluated.
- Evaluates only the property constraints encoded in the shapes — structural JSON Schema constraints that `ShaclProjection` maps to SHACL predicates.
- Does not perform OWL reasoning over the TBox. Class disjointness and equivalence axioms from the TBox are not checked during SHACL validation.

---

## Examples

### Example 1: Conforming and non-conforming instances

<RunnableExample src="examples/docs/advanced/113-validate-with-shacl" />

### Example 2: Accessing raw SHACL shape quads

<RunnableExample src="examples/docs/advanced/121-shacl-quads" />

---

## Workflow

```
jt.toShacl()           →  OntologyBuilder (shapes)
jt.toQuads(schema, v)  →  QuadInterface[] (data)
jt.validateWithShacl(shapes, data)  →  ShaclValidationReportInterface
```

Build shapes once at startup and reuse them across validation calls. The `toShacl()` builder is not cached (see [`toShacl()`](/advanced/ontology#jt-toshacl)); hold the returned `OntologyBuilder` in a variable when validating in a loop.

---

## Related

- [`toShacl()`](/advanced/ontology#jt-toshacl) — emit the SHACL shapes
- [`toQuads()`](/advanced/quads#jt-toquads) — produce ABox data quads
- [`ontology()`](/advanced/ontology#jt-ontology) — combined TBox + SHACL builder
- [RDF round-trip](/advanced/quads) — full quad projection and lifting

## See also

- [Bookstore domain](/bookstore-domain) — schemas used in examples
- [Graph concepts](/advanced/graph-concepts) — TBox / ABox structure
