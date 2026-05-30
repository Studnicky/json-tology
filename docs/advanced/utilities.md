# Public utility classes

A small set of utility classes is exported alongside `JsonTology` for advanced use - cases where you reach below the facade for graph, RDF, or hashing primitives. Each utility has one responsibility.

| Class               | Module                                | Purpose                                                   |
|---------------------|---------------------------------------|-----------------------------------------------------------|
| `Curie`             | `src/modules/rdf/Curie.ts`            | Compact / expand IRIs against a prefix map                |
| `Path`              | `src/modules/data/Path.ts`            | Convert JSON Pointers to JS access form                   |
| `Resolver`          | `src/modules/data/Resolver.ts`        | Merge per-call options with a base options object         |
| `Hash`              | `src/modules/hash/Hash.ts`            | Deterministic FNV-1a hash of any JSON-serializable value  |
| `Lift`              | `src/modules/rdf/Lift.ts`             | RDF interop helpers (RDF/JS quad conversion, lifting)     |
| `IdentifierIssuer`  | `src/modules/rdf/IdentifierIssuer.ts` | Per-call blank-node counter for projection isolation      |

The bookstore domain in [Bookstore Domain](/bookstore-domain) supplies prefixes and IRIs in the snippets.

---

## `Curie`

`new Curie(prefixes)` returns a CURIE handler. `compact(iri)` shrinks a full IRI; `expand(curie)` resolves a compact form back to a full IRI.

<RunnableExample src="examples/docs/advanced/07-utilities" />

When multiple prefixes share an overlap, `compact` picks the longest match.

The default prefix map used across the package is `STANDARD_PREFIXES` (from `src/constants/STANDARD_PREFIXES.ts`), the canonical prefix-to-namespace lookup for the well-known RDF vocabularies (`rdf`, `rdfs`, `owl`, `sh`, `xsd`, `schema`, `foaf`, `dc`, `dct`, `dcterms`, `dcat`, `skos`, `prov`, `time`, `geo`, `vann`, `dash`, `jt`). Every IRI constant in `src/constants/IRI.ts` derives from this map. Pass your own prefix map to `JsonTology.create({ prefixes })` to extend or override the defaults; your entries merge over `STANDARD_PREFIXES`.

## `Path`

`Path.toAccess(jsonPointer)` converts a JSON Pointer into JS access form - the path you would write to read the value out of the object. Useful when surfacing validation errors in UIs that expect access notation.

<RunnableExample src="examples/docs/advanced/08-path-json-pointer" />

Numeric segments become `[N]`; identifier-shaped segments become `.name`; non-identifier segments are quoted with bracket notation.

## `Resolver`

`Resolver.merge(base, override)` returns a fresh object with `override`'s defined keys overwriting `base`. `undefined` keys in `override` do not erase base values - this is the per-call option-merge pattern used throughout json-tology.

<RunnableExample src="examples/docs/advanced/09-resolver-merge" />

## `Hash`

`Hash.value(input)` returns a hex FNV-1a hash. Object keys are sorted before serialization, so two objects that differ only in key order produce the same hash.

<RunnableExample src="examples/docs/advanced/10-hash-fnv1a" />

Used internally by `registerAnonymous` to mint synthetic `$id` values from schema content. Use it directly when you need a stable cache key for a structured value.

## `Lift`

The `Lift` module exposes interop helpers between RDF/JS quads (from libraries like `n3` or `eyereasoner`) and json-tology's internal quad shape, plus the `Lift.instances` method that powers `JsonTology.fromQuads`.

<RunnableExample src="examples/docs/advanced/11-lift-n3-interop" />

For the typed round-trip use the `JsonTology` facade ([RDF round-trip](/advanced/quads)). Reach for `Lift` only when integrating with an external RDF/JS library directly.

## `IdentifierIssuer`

Ported from the W3C RDF Dataset Canonicalization algorithm. Each projector call (`Projection.graph`, `Projection.abox`, `OwlProjection.graph`, `ShaclProjection.graph`) constructs its own `IdentifierIssuer` so concurrent serializations never share mutable counter state.

Constructor: `new IdentifierIssuer(options?)` where `options` is `{ prefix?: string; counter?: number; existingMap?: ReadonlyMap<string, string> }`. The default `prefix` is `'_:b'` (RDF blank-node syntax); `counter` starts at zero; `existingMap` seeds a prior issuance history (used by `clone()`).

Surface:

- `getId(existing?)`: issue a new identifier, or return the previously issued one for `existing` if it has been mapped. Calling without `existing` always issues a fresh identifier without recording a mapping (anonymous blank nodes).
- `hasId(existing)`: true if `existing` already has an issued identifier.
- `getIssuedMap()`: read-only view of the current mapping.
- `getIssuedIdentifiers()`: keys in issuance order.
- `clone()`: fork an independent issuer with the same prefix, counter, and mappings.
- `reset()`: clear counter and mappings.

You only need to construct one directly if you are writing a custom projector or RDF serializer that participates in the same blank-node naming scheme. The built-in projectors manage their own.

---

## Examples

### Example 1: Curie: compact bookstore IRIs for display

Shrink full IRIs to CURIE form for readable output in debug logs or ontology tooling.

<RunnableExample src="examples/docs/advanced/66-curie-compact-bookstore" />

### Example 2: Path: surface validation error paths in a form UI

Convert JSON Pointer paths from `ValidationErrors` into JS access notation for a form library that uses dot/bracket paths.

<RunnableExample src="examples/docs/advanced/23-path-error-form-ui" />

### Example 3: Resolver: merge per-call options without mutating the base

Override a single flag for one call without constructing a full options object each time.

<RunnableExample src="examples/docs/advanced/13-resolver-per-call-options" />

### Example 4: Hash: stable cache key for a schema content fingerprint

Use `Hash.value` to produce a deterministic fingerprint for a schema object. Two structurally identical schemas with different key order produce the same hash.

<RunnableExample src="examples/docs/advanced/14-hash-cache-key" />

### Example 5: Lift: integrate an external n3 RDF/JS source

Convert quads produced by the `n3` parser into json-tology's internal quad shape for `fromQuads`.

<RunnableExample src="examples/docs/advanced/11-lift-n3-interop" />

## Bad examples: what NOT to do

### Anti-pattern 1: Curie: expanding a prefix that is not registered

<RunnableExample src="examples/docs/advanced/67-curie-antipattern-unknown-prefix" />

### Anti-pattern 2: Path: using toAccess on a non-JSON Pointer string

<RunnableExample src="examples/docs/advanced/68-path-antipattern-non-pointer" />

### Anti-pattern 3: Hash: using Hash.value as a cryptographic hash

<<< ../../examples/docs/advanced/69-hash-antipattern-cryptographic.ts

### Anti-pattern 4: Lift: passing Lift quads directly to a native RDF/JS consumer

<RunnableExample src="examples/docs/advanced/70-lift-antipattern-rdfjs-passthrough" />

## Comparison

::: code-group

```ts [json-tology]
import { Curie, Path, Resolver, Hash, Lift } from 'json-tology';
// Five focused single-responsibility utilities;
// Curie and Lift are RDF-aware; Hash is key-order-stable;
// Path bridges JSON Pointer ↔ JS access notation;
// Resolver implements safe per-call option merge.
```

```ts [Zod]
// Zod provides no IRI/CURIE utilities, no JSON Pointer path conversion,
// no deterministic hashing, and no RDF interop.
// These concerns are out of scope for a schema validation library.
```

```ts [Valibot]
// Same as Zod — no IRI, path-conversion, hashing, or RDF utilities.
```

```ts [AJV]
// AJV exposes no path-conversion or hashing utilities.
// JSON Pointer paths appear in ajv.errors[].instancePath as raw strings;
// conversion to JS access notation requires a third-party library (e.g. json-pointer).
```

```ts [rdflib.js / n3]
// rdflib and n3 provide CURIE-like prefix expansion via NamedNode / DataFactory,
// but no JSON Pointer path conversion, no schema-aware hashing, and no typed
// instance pipeline. They operate at the quad level only.
import { DataFactory } from 'n3';
const { namedNode } = DataFactory;
const bookIri = namedNode('https://bookstore.example/Book');
// Limitation: no compact/expand API; no option-merge; no FNV hash.
```

```ts [fast-json-patch]
// fast-json-patch applies JSON Patch operations and parses JSON Pointer paths,
// but does not convert pointers to JS access notation, hash structured values,
// or handle IRI/CURIE expansion.
import { getValueByPointer } from 'fast-json-patch';
const val = getValueByPointer(obj, '/items/0/quantity');
// Limitation: no toAccess conversion; no CURIE; no Hash; no RDF interop.
```

:::

## Related

- [RDF round-trip](/advanced/quads) - `toQuads` / `fromQuads` use these utilities under the hood
- [Graph concepts](/advanced/graph-concepts) - canonical graph structure

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions referenced in snippets
