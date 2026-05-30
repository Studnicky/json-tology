# RDF predicates

> You only need this section if you are projecting typed values to RDF quads via `toQuads` and want to control the predicate IRI assigned to each property.

Every property in a registered schema is assigned a predicate IRI at projection time. json-tology provides four layers of control, evaluated in priority order (first match wins):

1. **`x-jt-predicate`** — an explicit IRI annotated directly on the property schema.
2. **Absolute property `$id`** — when the property schema carries a `$id` that contains `://`, that IRI is used as-is.
3. **`predicateFor` callback** — a registry-level function that can return a custom IRI for selected properties.
4. **Default derivation** — flat canonical (`baseIRI/propertyName`) or class-scoped (`classId#propertyName`).

---

## Flat canonical predicates (default) {#canonical}

When `enableCanonicalPredicates` is `true` (the default), property predicates are derived as flat shared IRIs from the registry `baseIRI`:

```
https://bookstore.example/title
https://bookstore.example/isbn
https://bookstore.example/email
```

The predicate is vocabulary-wide — every class that declares a `title` property uses the same `https://bookstore.example/title` predicate. This is the most interoperable form and matches how shared vocabularies like Schema.org assign predicates.

<<< ../../examples/docs/advanced/100-canonical-predicates.ts

---

## Class-scoped predicates {#class-scoped}

Setting `enableCanonicalPredicates: false` derives a per-class predicate form:

```
urn:bookstore:Book#title
urn:bookstore:Customer#email
urn:bookstore:Address#city
```

The class `$id` becomes the predicate namespace and the property name becomes the local part. This is the right choice for DTO bundles where two structurally-unrelated classes coincidentally share a property name and must keep distinct predicates (e.g. `Invoice.name` vs `Color.name`), rather than collapsing onto one shared predicate.

The second half of the example above (example 100) demonstrates the contrast.

---

## `predicateFor` callback {#predicate-for}

The `predicateFor` option on `JsonTology.create` is a function invoked once per property during ABox projection. Return a string to override the derived IRI; return `undefined` to fall through to the default.

**Declaration.**

<!-- inline-ts-ok: type signature for the predicateFor callback — not a runnable expression -->
```ts
predicateFor: (ctx: { classId: string; propertyName: string }) => string | undefined
```

**Use this when** a consuming vocabulary already mints predicates under a different namespace — for example, aligning selected bookstore properties to Schema.org IRIs — and you want the mapping in one place without touching individual schemas.

<<< ../../examples/docs/advanced/101-predicate-for.ts

---

## `x-jt-predicate` {#x-jt-predicate}

Add `x-jt-predicate: '<IRI>'` directly to a property schema to pin it to a specific predicate IRI. This takes precedence over `predicateFor` and the default derivation (only an absolute `$id` on the property schema ranks higher).

**Use this when** a single property must align to an external vocabulary IRI without a registry-level callback.

<<< ../../examples/docs/advanced/102-x-jt-predicate.ts

---

## Union-domain TBox {#union-domain}

When `enableCanonicalPredicates: true` (the default), each flat predicate IRI appears once in the TBox. Multiple classes that share a property name emit the predicate declaration once — under a `rdfs:domain` of the union of all owning classes. This is the standard OWL 2 pattern for shared vocabulary predicates.

With `enableCanonicalPredicates: false`, each class-scoped predicate carries its own independent `rdfs:domain` declaration (the per-class model).

---

## Priority order summary

| Priority | Source | Returns |
|----------|--------|---------|
| 1 | `x-jt-predicate` on the property schema | Explicit IRI string |
| 2 | Absolute `$id` on the property schema (`includes('://')`) | Property `$id` value |
| 3 | `predicateFor(ctx)` returning a string | Custom IRI string |
| 4a | Default — canonical flat (`enableCanonicalPredicates !== false`) | `baseIRI/propertyName` |
| 4b | Default — class-scoped (`enableCanonicalPredicates: false`) | `classId#propertyName` |

---

## Related

- [`toQuads`](/advanced/quads#jt-toquads) — ABox quad projection
- [`x-jt-predicate` keyword](/schemas/jt-keywords#x-jt-predicate) — per-property explicit predicate
- [`x-jt-iriRef` keyword](/schemas/jt-keywords#x-jt-iriref) — emit string as NamedNode
- [`x-jt-language` keyword](/schemas/jt-keywords#x-jt-language) — tag string as rdf:langString

## See also

- [Bookstore domain](/bookstore-domain) — schema definitions used in examples
- [Graph concepts](/advanced/graph-concepts) — TBox / ABox structure
