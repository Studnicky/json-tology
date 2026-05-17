# Public utility classes

A small set of utility classes is exported alongside `JsonTology` for advanced use - cases where you reach below the facade for graph, RDF, or hashing primitives. Each utility has one responsibility.

| Class      | Module                                | Purpose                                                   |
|------------|---------------------------------------|-----------------------------------------------------------|
| `Curie`    | `src/modules/rdf/Curie.ts`            | Compact / expand IRIs against a prefix map                |
| `Path`     | `src/modules/data/Path.ts`            | Convert JSON Pointers to JS access form                   |
| `Resolver` | `src/modules/data/Resolver.ts`        | Merge per-call options with a base options object         |
| `Hash`     | `src/modules/hash/Hash.ts`            | Deterministic FNV-1a hash of any JSON-serializable value  |
| `Lift`     | `src/modules/rdf/Lift.ts`             | RDF interop helpers (RDF/JS quad conversion, lifting)     |

The bookstore domain in [Bookstore Domain](/bookstore-domain) supplies prefixes and IRIs in the snippets.

---

## `Curie`

`new Curie(prefixes)` returns a CURIE handler. `compact(iri)` shrinks a full IRI; `expand(curie)` resolves a compact form back to a full IRI.

<<< ../../examples/docs/advanced/07-utilities.ts

When multiple prefixes share an overlap, `compact` picks the longest match.

## `Path`

`Path.toAccess(jsonPointer)` converts a JSON Pointer into JS access form - the path you would write to read the value out of the object. Useful when surfacing validation errors in UIs that expect access notation.

<<< ../../examples/docs/advanced/08-path-json-pointer.ts

Numeric segments become `[N]`; identifier-shaped segments become `.name`; non-identifier segments are quoted with bracket notation.

## `Resolver`

`Resolver.merge(base, override)` returns a fresh object with `override`'s defined keys overwriting `base`. `undefined` keys in `override` do not erase base values - this is the per-call option-merge pattern used throughout json-tology.

<<< ../../examples/docs/advanced/09-resolver-merge.ts

## `Hash`

`Hash.value(input)` returns a hex FNV-1a hash. Object keys are sorted before serialization, so two objects that differ only in key order produce the same hash.

<<< ../../examples/docs/advanced/10-hash-fnv1a.ts

Used internally by `registerAnonymous` to mint synthetic `$id` values from schema content. Use it directly when you need a stable cache key for a structured value.

## `Lift`

The `Lift` module exposes interop helpers between RDF/JS quads (from libraries like `n3` or `eyereasoner`) and json-tology's internal quad shape, plus the `liftInstances` function that powers `JsonTology.fromQuads`.

<<< ../../examples/docs/advanced/11-lift-n3-interop.ts

For the typed round-trip use the `JsonTology` facade ([RDF round-trip](/advanced/quads)). Reach for `Lift` only when integrating with an external RDF/JS library directly.

---

## Examples

### Example 1: Curie: compact bookstore IRIs for display

Shrink full IRIs to CURIE form for readable output in debug logs or ontology tooling.

```ts
import { Curie } from 'json-tology';

const curie = new Curie({
  bk:  'https://bookstore.example/',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
});

curie.compact('https://bookstore.example/Book');    // → 'bk:Book'
curie.compact('https://bookstore.example/Order');   // → 'bk:Order'
curie.compact('http://www.w3.org/2002/07/owl#Class'); // → 'owl:Class'
curie.expand('bk:Customer');                        // → 'https://bookstore.example/Customer'
```

### Example 2: Path: surface validation error paths in a form UI

Convert JSON Pointer paths from `ValidationErrors` into JS access notation for a form library that uses dot/bracket paths.

<<< ../../examples/docs/advanced/12-path-error-form-ui.ts

### Example 3: Resolver: merge per-call options without mutating the base

Override a single flag for one call without constructing a full options object each time.

<<< ../../examples/docs/advanced/13-resolver-per-call-options.ts

### Example 4: Hash: stable cache key for a schema content fingerprint

Use `Hash.value` to produce a deterministic fingerprint for a schema object. Two structurally identical schemas with different key order produce the same hash.

<<< ../../examples/docs/advanced/14-hash-cache-key.ts

### Example 5: Lift: integrate an external n3 RDF/JS source

Convert quads produced by the `n3` parser into json-tology's internal quad shape for `fromQuads`.

<<< ../../examples/docs/advanced/11-lift-n3-interop.ts

## Bad examples: what NOT to do

### Anti-pattern 1: Curie: expanding a prefix that is not registered

```ts
import { Curie } from 'json-tology';

const curie = new Curie({ bk: 'https://bookstore.example/' });

// ✗ Don't do this — expanding an unknown prefix returns the input unchanged,
// which silently produces an invalid IRI
const iri = curie.expand('schema:Book'); // → 'schema:Book' (not a valid IRI)

// ✓ Do this — register all prefixes you intend to expand
const curie2 = new Curie({
  bk:     'https://bookstore.example/',
  schema: 'https://schema.org/',
});
curie2.expand('schema:Book'); // → 'https://schema.org/Book'
```

### Anti-pattern 2: Path: using toAccess on a non-JSON Pointer string

```ts
import { Path } from 'json-tology';

// ✗ Don't do this — passing a dot-path (JS access notation) instead of a JSON Pointer
Path.toAccess('items.0.quantity'); // → '["items.0.quantity"]' (treated as one segment)

// ✓ Do this — always pass a valid RFC 6901 JSON Pointer (leading slash, slash-separated)
Path.toAccess('/items/0/quantity'); // → 'items[0].quantity'
```

### Anti-pattern 3: Hash: using Hash.value as a cryptographic hash

```ts
import { Hash } from 'json-tology';

// ✗ Don't do this — FNV-1a is a non-cryptographic hash; do not use for
// security-sensitive purposes (tokens, signatures, deduplication of untrusted input)
const token = Hash.value(sensitivePayload); // NOT cryptographically secure

// ✓ Do this — use Hash.value only for cache keys, synthetic schema IDs,
// or content fingerprints where collision resistance is not required
// For security: use node:crypto
import { createHash } from 'node:crypto';
const safeHash = createHash('sha256').update(JSON.stringify(sensitivePayload)).digest('hex');
```

### Anti-pattern 4: Lift: passing Lift quads directly to a native RDF/JS consumer

```ts
import { Lift } from 'json-tology';

// ✗ Don't do this — Lift.fromQuad returns json-tology's internal QuadInterface shape,
// which is not an RDF/JS DataFactory quad; passing it to n3.Store.addQuad will fail
const internal = rdfJsQuads.map(q => Lift.fromQuad(q));
n3Store.addQuad(internal[0]); // TypeError — not an RDF/JS Quad

// ✓ Do this — use internal quads with json-tology only (fromQuads); for RDF/JS
// consumers, keep the original RDF/JS quads
entities.fromQuads('https://bookstore.example/Book', internal); // correct usage
```

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
