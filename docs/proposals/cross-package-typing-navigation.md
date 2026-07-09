# Proposal: Documentation navigation for runtime decode + cross-package typing

**Status: Resolved.** [`docs/cross-package-typing.md`](/cross-package-typing)
walks the end-to-end cross-package, hash-namespace path this report describes:
CURIE `$ref` authoring, registration, `InferType` with a CURIE-keyed reference
map, `instantiate()` called from another package, and why `instantiate`'s
return type — `ParseOutputType<TSchema, TRefs>`, keyed by the registry's
absolute `$id`s — cannot be trusted across a package boundary, with the
recommended re-derive-locally idiom. `docs/types/infer.md` now documents
`RefNotFoundType` (the report's `RefNotFoundInterface` predates a rename),
the CURIE-keyed reference-map form, the hand-rolled-type antipattern, and the
downstream-required-default guidance. The decode/default-ordering
contradiction was real and is fixed in five doc locations (traced against
`SchemaRegistry.instantiate()`: decode runs before validation/defaults);
`docs/instantiate-vs-materialize.md` now states the canonical ordering
plainly with a passthrough-decode example. The author's wrong turns below
remain recorded verbatim as the original findable-ness test cases.

## Who hits this

A consumer that (a) authors RDF/OWL **hash-namespace** schemas
(`$id: 'https://ns#Class'`), (b) registers them in **one package** and calls
`instantiate`/`validate`/`InferType` from **another**, and (c) wants a **typed**
result with **no hand-rolled types**. All three are supported; the failure
modes are each "working as intended" but discovered only by reading source.

## The five wrong turns, the fact that resolves each, and the doc that's missing

### 1. Full-IRI `$ref` with a `#fragment` does not resolve at runtime

`{ $ref: SomeSchema.$id }` where `$id` is `https://ns#X` → `REF_UNRESOLVED` from
`instantiate`/`validate`. The resolver (`SchemaRefWalker`) parses the ref via
`SchemaIri.parseRef(ref).id`, which strips `#X` to the base IRI and never checks
the literal ref against the registry. **CURIE** `$ref`s (`'ns:X'`) and
fragment-less path/URN IRIs resolve; full-IRI `#fragment` refs do not.
*(Full detail + suggested fix: companion proposal `full-iri-fragment-ref-resolution.md`.)*

**Searched for:** `REF_UNRESOLVED`. **Should land on:** a "Referencing other
schemas" section stating the rule plainly and cross-linked from `schemas.md`,
`validation/`, `your-types-are-a-graph.md`.

### 2. The `{ kind, unresolvedRef }` shape is `RefNotFoundInterface`, NOT "inference degrading to unknown"

When `InferType` / `CanonicalShapeType` can't resolve a cross-schema `$ref`, the
property infers to `RefNotFoundInterface<'...'>` — a deliberate **compile-error
brand**, not `unknown`. A newcomer reads `{ readonly kind: string; readonly
unresolvedRef: string }` and concludes "json-tology's types are broken / degrade
to unknown" (the author wrote exactly that, twice, and was wrong both times).

**The fix is to supply the reference map**, second type arg:
`InferType<typeof Schema, { 'ns:X': typeof XSchema }>`. The map key must match
the **`$ref` string as written** (CURIE key for a CURIE ref). `docs/types/infer.md`
Example 3 covers this for absolute IRIs but does not (a) name the marker type,
(b) show the **CURIE-keyed** map, or (c) appear in any error/troubleshooting index.

**Searched for:** `unresolvedRef`, `RefNotFound`, `kind unresolvedRef`.
**Should land on:** a troubleshooting entry "I see `{ kind, unresolvedRef }` in
my inferred type" → "that is `RefNotFoundInterface`; thread the reference map."

### 3. Hand-rolling `*Type` is the antipattern this trap produces

Because #2 reads like "inference is broken," consumers write
`export type XType = { … }` by hand and add a comment "cross-file inference
degrades." That defeats the library. The whole `@torreya/protocol-game` registry
did this for every entity. The doc needs an explicit **"do not hand-roll; thread
the ref map"** callout next to the `RefNotFound` explanation, with the before/after.

### 4. `instantiate`'s return widens — and its field types go `unknown` — across a package boundary

This is the sharpest one. With the schema registered and the CURIE `$ref`
correct:

- A **local** `InferType<typeof Schema, { 'ns:X': typeof XSchema }>` resolves to
  `{ a: string; … }` (ref-map keyed by the CURIE).
- But `otherPkg.instantiate(Schema, data)` returns
  `{ a: unknown; … }` in the consumer. `instantiate`'s return is
  `ParseOutputType<TSchema, TRefs>` where `TRefs` is the **registry's** reference
  map — keyed by absolute `$id`, and it does not expand the CURIE `$ref` the way
  the local CURIE-keyed `InferType` map does. The registry's `TRefs` also may not
  survive the exporting package's `.d.ts` intact.

So the value is validated correctly at runtime, but the consumer cannot lean on
`instantiate`'s **return type**. Today the only clean path is: re-derive the type
locally with `InferType` + ref-map and read the validated value into it — which
the consumer must be told, because nothing in the docs covers cross-package
registry typing.

**Searched for:** `instantiate returns unknown`, `cross package`, `monorepo`.
**Should land on:** a "Using json-tology across packages" page: what `TRefs`
carries across a `.d.ts`, why CURIE `$ref`s resolve in a local `InferType` map but
not in the registry's `$id`-keyed `TRefs`, and the recommended consumer idiom
(re-derive with `InferType`, or — if intended — a re-exportable references map).

### 5. Wire-type (`InferType`) vs instantiated-type optionality

`InferType` keeps a `default`-bearing property **optional** (`a?: string`) because
`default` is a runtime concept; after `instantiate` the field is always present.
A consumer that needs the field **required** downstream (e.g. assigning to an
interface with a required slot under `exactOptionalPropertyTypes`) gets a type
error from the `InferType` shape even though the runtime value has it filled.
`docs/types/infer.md` Example 1 notes "remains optional because default is a
runtime concept" but does not address the consumer-side consequence or the
"add it to `required` too" workaround.

**Searched for:** `default optional InferType`, `optional but required`.
**Should land on:** the same infer page, with the downstream-required guidance.

## Decode/default ordering (still under-documented)

`instantiate` **validates + fills defaults + strips unknowns first, then runs
Transform decoders** on the validated value (confirmed empirically: a passthrough
`decode` still sees defaults filled). But `instantiate-vs-materialize.md` says
"runs decoders on the validated value" while `Transform.create`'s doc comment
says "the schema describes decode's OUTPUT, so validation runs on the decoded
result." These read as contradictory; a reader can't tell whether `decode` sees
raw wire or the defaulted value (it sees the defaulted value).

**Doc fix:** one canonical ordering statement referenced from both pages, with a
passthrough-decode example.

## Suggested shape

A single **"Runtime decoding across packages: end-to-end"** guide that walks one
cross-package, hash-namespace example: schema authoring (CURIE refs) →
registration (+ `enableStrictGraph`) → `InferType` with ref-map → `instantiate`
→ typed consumer value, calling out facts #1–#5 inline. Most prose exists
scattered across `schemas.md`, `composition/`, `validation/`,
`instantiate-vs-materialize.md`, `types/infer.md`, and `your-types-are-a-graph.md`;
the gap is a single navigable path an agent grepping `REF_UNRESOLVED`,
`unresolvedRef`, `RefNotFound`, or `instantiate returns unknown` can find.
