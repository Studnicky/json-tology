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

```ts
import { Curie } from 'json-tology';

const curie = new Curie({
  bk:  'https://bookstore.example/',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
});

curie.compact('https://bookstore.example/Book');  // 'bk:Book'
curie.expand('bk:Book');                          // 'https://bookstore.example/Book'
curie.expand('xsd:string');                       // 'http://www.w3.org/2001/XMLSchema#string'
```

When multiple prefixes share an overlap, `compact` picks the longest match.

## `Path`

`Path.toAccess(jsonPointer)` converts a JSON Pointer into JS access form - the path you would write to read the value out of the object. Useful when surfacing validation errors in UIs that expect access notation.

```ts
import { Path } from 'json-tology';

Path.toAccess('/items/0/quantity');  // 'items[0].quantity'
Path.toAccess('/customer/name');     // 'customer.name'
Path.toAccess('/oddly-shaped-key');  // '["oddly-shaped-key"]'
Path.toAccess('');                   // ''
```

Numeric segments become `[N]`; identifier-shaped segments become `.name`; non-identifier segments are quoted with bracket notation.

## `Resolver`

`Resolver.merge(base, override)` returns a fresh object with `override`'s defined keys overwriting `base`. `undefined` keys in `override` do not erase base values - this is the per-call option-merge pattern used throughout json-tology.

```ts
import { Resolver } from 'json-tology';

const base = { enableDefaults: true, enableValidation: true };
const merged = Resolver.merge(base, { enableDefaults: false });
// { enableDefaults: false, enableValidation: true }

Resolver.merge(base, { enableDefaults: undefined });
// { enableDefaults: true, enableValidation: true }
```

## `Hash`

`Hash.value(input)` returns a hex FNV-1a hash. Object keys are sorted before serialization, so two objects that differ only in key order produce the same hash.

```ts
import { Hash } from 'json-tology';

Hash.value({ isbn: '9780140449136', title: 'War and Peace' });
// 'abc12345' (deterministic, hex)

Hash.value({ title: 'War and Peace', isbn: '9780140449136' }) ===
  Hash.value({ isbn: '9780140449136', title: 'War and Peace' });
// true - key order does not matter
```

Used internally by `registerAnonymous` to mint synthetic `$id` values from schema content. Use it directly when you need a stable cache key for a structured value.

## `Lift`

The `Lift` module exposes interop helpers between RDF/JS quads (from libraries like `n3` or `eyereasoner`) and json-tology's internal quad shape, plus the `liftInstances` function that powers `JsonTology.fromQuads`.

```ts
import { Lift } from 'json-tology';
import type { QuadInterface } from 'json-tology/types';

// rdfQuads from an external RDF/JS source (e.g. n3.Parser)
const internal: QuadInterface[] = rdfQuads.map(q => Lift.fromQuad(q));

// pass to JsonTology.fromQuads
const books = bookstoreEntities.fromQuads('https://bookstore.example/Book', internal);
```

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

```ts
import { Path } from 'json-tology';
import { bookstoreEntities, OrderSchema } from './bookstore/index.js';

const errs = bookstoreEntities.validate(OrderSchema.$id, {
  id:         'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  customerId: 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  placedAt:   '2026-01-15T10:30:00Z',
  total:      50,
  items:      [{ bookIsbn: '9780140449136', quantity: 0, unitPrice: 14.99 }],
});

for (const err of errs) {
  const accessPath = Path.toAccess(err.path);
  console.log(accessPath, err.message);
}
// 'items[0].quantity' 'must be >= 1'
```

### Example 3: Resolver: merge per-call options without mutating the base

Override a single flag for one call without constructing a full options object each time.

```ts
import { Resolver } from 'json-tology';

const defaultOpts = { enableDefaults: true, enableValidation: true, enableThrow: false };

// Per-call: turn off defaults for one strict parse
const strictOpts = Resolver.merge(defaultOpts, { enableDefaults: false });
// { enableDefaults: false, enableValidation: true, enableThrow: false }

// undefined does not erase base values
const sameAsDefault = Resolver.merge(defaultOpts, { enableDefaults: undefined });
// { enableDefaults: true, enableValidation: true, enableThrow: false }
```

### Example 4: Hash: stable cache key for a schema content fingerprint

Use `Hash.value` to produce a deterministic fingerprint for a schema object. Two structurally identical schemas with different key order produce the same hash.

```ts
import { Hash } from 'json-tology';

const schemaA = { type: 'object', properties: { isbn: { type: 'string' }, title: { type: 'string' } } };
const schemaB = { properties: { title: { type: 'string' }, isbn: { type: 'string' } }, type: 'object' };

Hash.value(schemaA) === Hash.value(schemaB); // → true (key order does not matter)

// Use as a cache key
const cache = new Map<string, unknown>();
const key = Hash.value(schemaA);
if (!cache.has(key)) {
  cache.set(key, computeExpensiveResult(schemaA));
}
```

### Example 5: Lift: integrate an external n3 RDF/JS source

Convert quads produced by the `n3` parser into json-tology's internal quad shape for `fromQuads`.

```ts
import { Lift } from 'json-tology';
import { Parser } from 'n3';
import type { QuadInterface } from 'json-tology/types';
import { bookstoreEntities } from './bookstore/index.js';

const turtle = `
  <https://bookstore.example/books/9780140449136>
    a <https://bookstore.example/Book> ;
    <https://bookstore.example/isbn> "9780140449136" ;
    <https://bookstore.example/title> "Crime and Punishment" .
`;

const parser = new Parser();
const rdfQuads = parser.parse(turtle);
const internal: QuadInterface[] = rdfQuads.map(q => Lift.fromQuad(q));

const books = bookstoreEntities.fromQuads('https://bookstore.example/Book', internal);
// books[0].isbn === '9780140449136'
// books[0].title === 'Crime and Punishment'
```

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
