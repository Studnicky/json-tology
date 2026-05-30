# JT keyword reference

> Validation modes: [Validation modes reference](/validation-modes)

json-tology adds a small set of `jt:`-prefixed keywords to JSON Schema. They are tracked alongside the standard keywords (see `KNOWN_SCHEMA_KEYWORDS` in `src/constants/SCHEMA_KEYWORDS.ts`) and read at specific points in the pipeline. Each keyword has a documented payload shape, semantics, and a clear "what reads it" answer.

| Keyword              | Payload                                | Mode | Read by                                    |
|----------------------|----------------------------------------|------|--------------------------------------------|
| `jt:alias`           | `string \| string[]`                   | <Badge type="tip" text="Runtime" /> | `SchemaGraphSupport`                       |
| `jt:annotatedEdge`   | (shape produced by `Compose.annotatedEdge`) | <Badge type="tip" text="Runtime" /> | `Projection` (ABox triple-term emission)  |
| `jt:computed`        | `true`                                 | <Badge type="tip" text="Runtime" /> | `Materializer` (via computed-field map)    |
| `jt:config`          | `{ extra?, frozen?, strict? }`         | <Badge type="tip" text="Runtime" /> | `SchemaGraphSupport`, `Materializer`       |
| `jt:frozen`          | `true`                                 | <Badge type="tip" text="Runtime" /> | `Materializer`, `SchemaRegistry`           |
| `jt:restrictions`    | `RestrictionRefType[]`                 | <Badge type="info" text="Compile-time" /> | `InferType` (type narrowing), TBox projection (OWL) |
| `jt:strict`          | `boolean`                              | <Badge type="tip" text="Runtime" /> | `SchemaGraphSupport` (via `enableStrictTypes`) |
| `x-jt-iriRef`        | `true`                                 | <Badge type="tip" text="Runtime" /> | `Projection` (ABox quad emission)          |
| `x-jt-language`      | BCP 47 language tag string             | <Badge type="tip" text="Runtime" /> | `Projection` (ABox quad emission)          |
| `x-jt-predicate`     | Absolute IRI string                    | <Badge type="tip" text="Runtime" /> | `PredicateResolver`, `Projection`          |

The bookstore schemas defined in the [Bookstore Domain](/bookstore-domain) are used in the examples.

---

## `jt:alias`

**Payload.** `string` or `readonly string[]`.

**Semantics.** Records alternative IRIs (or local names) for the schema's owning class. Used when the same domain entity is known by more than one identifier - for example, a vendor IRI alongside the canonical project IRI.

**Read by.** `normalizeAliases()` in `src/modules/graph/SchemaGraphSupport.ts`. The aliases land on the canonical graph node and surface in OWL output as `owl:equivalentClass` or `skos:altLabel` declarations, depending on the active vocabulary plugins.

**Use this when** you publish RDF that needs to interoperate with externally minted IRIs for the same concept.

<<< ../../examples/docs/schemas/02-jt-alias.ts

## `jt:computed`

**Payload.** Literal `true`.

**Semantics.** Marks a property as derived. Callers cannot supply the value on input - doing so raises `InstantiationError` with code `COMPUTED_INPUT_FORBIDDEN`. The materializer fills it by calling the registered compute function during `instantiate` and `materialize`.

**Read by.** `SchemaGraphSupport` populates the graph node's `computed` field when `jt:computed` is present; `Materializer` then resolves the matching function from the registry's `computedStore`.

**Use this when** a property is mechanically derivable from other fields - an order `total` from line items, a `displayName` concatenating fields, a hash of canonical content. Pair it with `addComputed` (or the `computeds` constructor option) to register the function.

<<< ../../examples/docs/schemas/03-jt-computed.ts

See [`addComputed`](/registry/computed) for the function-side contract.

## `jt:config`

**Payload.** Object with optional fields:

| Field      | Type                              | Effect                                                     |
|------------|-----------------------------------|------------------------------------------------------------|
| `extra`    | `'allow' \| 'forbid' \| 'ignore'` | Policy for properties not declared in `properties`         |
| `frozen`   | `boolean`                         | Materializer returns a deeply frozen value                 |
| `strict`   | `boolean`                         | Per-schema toggle for strict-types behaviour               |

**Semantics.** A bundled, schema-local configuration block. The fields mirror standalone `jt:frozen` and `jt:strict`, plus an `extra` policy that has no standalone form. When both `jt:frozen` and `jt:config.frozen` are present, either being `true` is enough to freeze.

**Read by.** `extractJtConfig()` in `src/modules/graph/SchemaGraphSupport.ts`, with `frozen` consumed by `Materializer` and the freeze status also checked in `SchemaRegistry`.

**Use this when** you want to colocate several runtime policy bits without scattering individual keywords across the schema.

<<< ../../examples/docs/schemas/04-jt-config.ts

The three `extra` values:

- `'allow'` - unknown properties pass through unchanged.
- `'forbid'` - unknown properties trigger `InstantiationError` with code `EXTRA_FORBIDDEN`.
- `'ignore'` - unknown properties are silently stripped during instantiation.

## `jt:frozen`

**Payload.** Literal `true`.

**Semantics.** Standalone shorthand for `jt:config.frozen: true`. The materializer applies a deep `Object.freeze` to the result. The schema registry also exposes the freeze flag on the canonical graph node so downstream consumers (validators, ontology projections) can reason about immutability.

**Read by.**

- `Materializer.isEffectivelyFrozen()` in `Materializer`
- `SchemaGraphSupport` populates `jtFrozen` on the graph node
- `SchemaRegistry` checks freeze status during register/instantiate flow

**Use this when** every materialized value of this schema should be immutable - configuration objects, value objects, snapshot records.

<<< ../../examples/docs/schemas/05-jt-frozen.ts

Prefer `jt:config: { frozen: true }` when you also need `extra` or `strict`. Use the standalone form when freeze is the only policy.

## `jt:strict`

**Payload.** `boolean`.

**Semantics.** Per-schema override for strict-types behaviour - whether numeric strings coerce to numbers, whether `null` is rejected for typed fields, and so on. Without this keyword, the global `enableStrictTypes` option on `JsonTology.create` decides.

**Read by.** `SchemaGraphSupport` reads `jt:strict` and surfaces it on the graph node as `jtStrict`. The strict-types path consumes it during validation compilation.

**Use this when** one schema in a registry needs the opposite policy from the rest - for example, a wire-facing payload that must reject coercions even though the rest of the system allows them.

<<< ../../examples/docs/schemas/06-jt-strict.ts

## `x-jt-predicate` {#x-jt-predicate}

**Payload.** Absolute IRI string.

**Semantics.** Pins the property to an explicit predicate IRI. `toQuads` uses this IRI as the predicate for the property's quad regardless of the registry `baseIRI`, `enableCanonicalPredicates`, or `predicateFor` settings. It is the highest-precedence predicate binding after an absolute `$id` on the property schema.

**Read by.** `PredicateResolver.resolve()` in `src/modules/graph/PredicateResolver.ts:53` — step 1 in the five-step precedence chain.

**Use this when** a single property must align to an external vocabulary IRI (for example, a Schema.org predicate) without a registry-level `predicateFor` callback.

<<< ../../examples/docs/advanced/102-x-jt-predicate.ts

See [RDF predicates — priority order](/advanced/predicates#x-jt-predicate) for the full precedence chain.

## `x-jt-iriRef` {#x-jt-iriref}

**Payload.** Literal `true`.

**Semantics.** Instructs `toQuads` to emit the string value as an RDF `NamedNode` rather than an `xsd:string` literal. Use it on string properties whose value is a dereferenceable IRI — URLs, URNs, or any identifier that should be treated as a node in the graph rather than a data value.

**Read by.** `Projection` reads `propertySemantics.iriRef` in `src/modules/rdf/Projection.ts` and routes the value through `Terms.iri(value)` instead of the literal path.

**Use this when** the property value is an IRI and you want it to participate in graph traversal as a named node rather than appear as a string literal.

<<< ../../examples/docs/advanced/103-x-jt-iriref-language.ts

The `DownloadUrl` schema in the bookstore domain (`x-jt-iriRef: true`) and the `Provenance` schema (`x-jt-language: 'de'`) are both exercised in that example.

## `x-jt-language` {#x-jt-language}

**Payload.** BCP 47 language tag string (e.g. `'de'`, `'en'`, `'fr-BE'`).

**Semantics.** Tags the emitted string literal with the given language code, producing an `rdf:langString` rather than a plain `xsd:string`. The datatype is `http://www.w3.org/1999/02/22-rdf-syntax-ns#langString` and the `language` field on the `Literal` term carries the BCP 47 tag.

**Read by.** `Projection` reads `propertySemantics.language` in `src/modules/rdf/Projection.ts` and passes the tag to `QuadFactory.literal(value, XSD.string, { language })`.

**Use this when** the string property contains natural-language text in a known language — provenance descriptions, titles in a specific locale, editorial notes — and you want downstream reasoners or search engines to treat the language information as part of the triple.

The example above (example 103) also shows `x-jt-language` in action via the `signedFirstEdition` fixture's `provenance` field.

## `jt:annotatedEdge` {#jt-annotated-edge}

**Payload.** The shape produced by `Compose.annotatedEdge({ predicate, targetRef, annotations })`. Do not write this keyword directly — use the `Compose.annotatedEdge` builder, which produces the correct internal structure.

**Semantics.** Declares a property as an RDF-star annotated edge. `toQuads` emits two things for the property:

1. A **base triple**: `<subject> <edgePredicate> <targetIRI>`
2. One **annotation quad** per declared annotation, whose subject is a triple-term (a `Quad`-subject quad per the RDF 1.2 / RDF-star specification): `<< subject edgePredicate targetIRI >> <annotationPredicate> <value>`

Both the base triple and all annotation quads share the same named graph. A `graphIRI` option is required when calling `toQuads` — the default graph cannot carry triple-term quads.

**Read by.** `Projection` in `src/modules/rdf/Projection.ts` dispatches to `projectAnnotatedEdge` when the property structure kind is `'annotatedEdge'`.

**Use this when** a relationship between two individuals carries metadata that belongs to the edge itself rather than to either endpoint — ratings on a review-to-book link, weights on a similarity edge, timestamps on a provenance arc.

<<< ../../examples/docs/advanced/104-annotated-edge-rdfstar.ts

See [RDF round-trip](/advanced/quads) for `toQuads` / `fromQuads` documentation.

## Related

- [Schemas overview](/schemas) - the broader keyword catalogue
- [`addComputed`](/registry/computed) - registers the function side of `jt:computed`
- [`addInvariant`](/registry/invariants) - cross-field validation, complements `jt:computed`
- [Materialize](/registry/materialize) - the place freeze and `extra` policies execute
- [RDF predicates](/advanced/predicates) - `enableCanonicalPredicates`, `predicateFor`, and predicate priority

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
- [Graph concepts](/advanced/graph-concepts) - how these keywords land on the canonical graph
