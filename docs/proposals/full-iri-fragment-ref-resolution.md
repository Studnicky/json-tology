# Proposal: Resolve full-IRI `$ref`s that match a registered hash-namespace `$id`

**Status: Resolved.** A full-IRI `#fragment` `$ref` matching a registered
hash-namespace `$id` resolves correctly at both schema-registration time
(`SchemaRefWalker`) and at validate/instantiate/materialize/dump runtime
(`RefResolution` and the other resolution sites listed below), while CURIE
refs, fragment-less path IRIs, and in-document `#`-only fragment refs continue
to resolve exactly as before.

Each resolution site tries the `$ref` string exactly as authored against the
registry before falling back to document-fragment semantics (which strips
everything from `#` onward): `src/modules/registry/SchemaRefWalker.ts`,
`src/modules/graph/RefResolution.ts` (the canonical resolver that validation,
projection, and materialization delegate to), `src/modules/validation/SchemaCompilerPlan.ts`
(allOf-inheritance and if/then/else conditional-branch resolution),
`src/modules/graph/Dumper.ts` (schema dump), and `src/modules/graph/RefDecoder.ts`
(transform ref-decoding) — the last three were not part of the original gap
report but shared the identical bug.

The CURIE-`$ref` authoring pattern described below remains the recommended
convention for hash-namespace registries; full-IRI `#fragment` refs are now an
equally supported alternative.

## Summary

A `$ref` written as an **absolute IRI containing a `#fragment`** (e.g.
`https://torreya.dev/ontology#StringValue`) does **not** resolve against a schema
registered under that exact `$id`. `instantiate` / `validate` / the ref walker
report `REF_UNRESOLVED`. The same reference written as a **CURIE** (`tor:StringValue`),
or registered/referenced as a **fragment-less path IRI** (`https://…/StringValue`),
resolves correctly.

Consequence for hash-namespace registries: schemas authored as
`{ $id: 'https://ns#X' }` and referenced as `{ $ref: SomeSchema.$id }` (the natural
pattern when `$id`s carry the OWL hash namespace) cannot be validated at runtime —
**every** such ref fails, so no entity in the registry is runtime-validatable.

## Evidence (controlled matrix)

Registry built with `prefixes: { tor: 'https://torreya.dev/ontology#' }`; one string
primitive + one object with a single required property `u` referencing it; then
`instantiate(objId, { u: 'admin' })`:

| `$id` form        | `$ref` form              | strict-graph | result          |
|-------------------|--------------------------|--------------|-----------------|
| `…/ontology#S`    | `…/ontology#S` (full IRI)| true         | **REF_UNRESOLVED** |
| `…/ontology#S`    | `…/ontology#S` (full IRI)| false        | REF_UNRESOLVED  |
| `…/ontology#S`    | `…/ontology#S` via `.set()` | true      | REF_UNRESOLVED  |
| `https://…/S`     | `https://…/S` (full IRI) | true         | **OK**          |
| `…/ontology#S`    | `tor:S` (CURIE)          | true         | **OK**          |

`enableStrictGraph` and `create({schemas})` vs `.set()` are **not** the deciding
factor — the only factor is fragment-IRI `$ref` vs path-IRI / CURIE `$ref`.

## Root cause

`src/modules/registry/SchemaRefWalker.ts` (`collectRefsInNode` ~line 55–64 and
`walkAssert` ~line 106–120): for a `$ref` that does not start with `#`, the code does

```ts
const refIri   = SchemaIri.parseRef(ref).id;  // strips the #fragment → base IRI
const resolved = resolve(refIri);
if (!knownIds(resolved) && !knownIds(refIri) && !embeddedIds.has(refIri)) { /* unresolved */ }
```

`SchemaIri.parseRef(ref).id` treats `#X` as a JSON-Schema document fragment and
returns the **base** IRI (`https://…/ontology`), which is not a registered `$id`,
so the ref is deemed unresolved. The original full ref string (`…#X`) — which is
the exact registered `$id` — is **never** checked against the registry.

CURIEs work because they contain no `#`: `resolve('tor:X')` expands to `…#X`, which
`knownIds` then finds among the stored `$id`s.

## Proposed fix (maintainer)

Before fragment-stripping, check the literal ref (and its CURIE/relative-expanded
form) against the registry; only fall back to document#fragment semantics when no
registered `$id` matches exactly. Concretely, in both walker sites, add a
`knownIds(ref) || knownIds(resolve(ref))` guard ahead of the `parseRef(ref).id`
path (and mirror it in the compile-time resolution path that the executor uses).

This is consistent with the library bridging JSON Schema and RDF: an OWL hash
namespace (`https://ns#Class`) is the idiomatic `$id` form, and a `$ref` to that
exact IRI should resolve to the registered schema rather than be interpreted as a
fragment within an (unregistered) base document.

## Consumer workaround (no dependency change)

Author hash-namespace `$ref`s as **CURIEs** (`{ $ref: 'tor:GraphConfigString' }`),
and make referenced primitives **self-contained** (avoid `Compose.subClassOf`,
whose generated base `$ref` is emitted as an absolute fragment IRI and hits the
same path). This is what `@torreya/protocol-game` adopts for its runtime-decoded
config entity while this gap is open.

## Relationship to type-level resolution

The same hash-namespace asymmetry exists at the **type** level and pulls in the
opposite direction, which is what makes this trap costly:

- `InferType<typeof S, Refs>` resolves a `$ref` when `Refs` is keyed by the
  **`$ref` string as written** — so a **CURIE** `$ref` needs a CURIE-keyed map
  (`{ 'tor:GraphConfigString': typeof … }`), and a full-IRI `$ref` needs an
  absolute-IRI-keyed map. An omitted/mismatched map yields `RefNotFoundInterface`.
- `instantiate`'s **return** type uses the registry's `TRefs`, which is keyed by
  absolute `$id`. It does **not** expand a CURIE `$ref` the way a local
  CURIE-keyed `InferType` map does, so cross-package the validated value's fields
  type to `unknown`.

Net effect today: the runtime resolver wants a **CURIE** `$ref` (this proposal),
while clean **type** resolution wants the reference map keyed to match — and the
registry's return-type path resolves neither CURIEs cross-package. A consumer
ends up authoring CURIE refs (for runtime) **and** re-deriving the type with a
local `InferType` + CURIE-keyed map (for typing), because `instantiate`'s return
cannot be relied on across packages. Fixing the runtime resolver here, plus the
cross-package typing items in
`cross-package-typing-navigation.md`, would let one authoring convention serve
both runtime and types.
