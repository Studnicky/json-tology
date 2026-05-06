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
import { fromRdfQuad } from 'json-tology';
import type { QuadInterface } from 'json-tology/types';

// rdfQuads from an external RDF/JS source (e.g. n3.Parser)
const internal: QuadInterface[] = rdfQuads.map(fromRdfQuad);

// pass to JsonTology.fromQuads
const books = entities.fromQuads('https://bookstore.example/Book', internal);
```

For the typed round-trip use the `JsonTology` facade ([RDF round-trip](/advanced/quads)). Reach for `Lift` only when integrating with an external RDF/JS library directly.

## Related

- [RDF round-trip](/advanced/quads) - `toQuads` / `fromQuads` use these utilities under the hood
- [Graph concepts](/advanced/graph-concepts) - canonical graph structure

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions referenced in snippets
