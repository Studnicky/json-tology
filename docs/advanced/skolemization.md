# Skolemization

> Skolemization is the process of replacing blank nodes in an RDF graph with deterministic IRIs so consumers can refer to those nodes stably across calls and stores. The W3C term comes from `Skolem(1920)`'s function: every existential variable becomes a fresh constant. In RDF, every anonymous node becomes a fresh IRI.

json-tology projects every typed value into ABox quads via `toQuads`. By default, every emitted object gets a deterministic IRI of the form `<baseIRI>/instances/<classId>-<contentHash>`. Sometimes that's exactly right — content-addressed IRIs are stable, deduplicating, and need no external coordination. Sometimes you want something else: a property-derived IRI, a UUID, an explicit override, or genuine blank nodes. The `iriFor` option (and the `Skolemize` helper class) gives you that control.

Relevant standards:

- [W3C RDF 1.1 §3.5 — Replacing Blank Nodes with IRIs](https://www.w3.org/TR/rdf11-concepts/#section-skolemization)
- [W3C RDFC-1.0 — RDF Dataset Canonicalization](https://www.w3.org/TR/rdf-canon/)

## The four built-in strategies

`Skolemize` is a static-only helper class exposing four reusable minting strategies. Each returns a `SkolemizeFnType` — a function `(ctx) => string | undefined` suitable for the `iriFor` option on `toQuads`.

### `Skolemize.hash({ baseIRI })`

Default-equivalent. Hashes the value with FNV-1a and emits `<baseIRI>/instances/<hash>`. Deterministic — equal values produce equal IRIs across calls and processes.

```ts
import { Skolemize } from 'json-tology';

entities.toQuads(BookSchema, book, {
  iriFor: Skolemize.hash({ baseIRI: 'https://books.example.com' })
});
// → https://books.example.com/instances/a1b2c3d4
```

### `Skolemize.wellKnownGenid(baseIRI)`

Mints IRIs matching the [RDF 1.1 §3.5 well-known genid pattern](https://www.w3.org/TR/rdf11-concepts/#section-skolemization): `<baseIRI>/.well-known/genid/<hash>`. These IRIs are intentionally reversible — `fromQuads({ deskolemize: true })` recognizes the pattern and rewrites the IRIs back to blank nodes during lift.

```ts
const quads = entities.toQuads(OrderSchema, order, {
  iriFor: Skolemize.wellKnownGenid('https://shop.example.com')
});

// Round-trip back to blank-node semantics:
const [restored] = entities.fromQuads(OrderSchema.$id, quads, { deskolemize: true });
```

Use this strategy when you want to publish RDF over the wire (which requires named subjects) but preserve blank-node identity on the receiving end.

### `Skolemize.uuid()`

Mints `urn:uuid:<v4>`. Non-deterministic — every emission gets a fresh identity. Useful when you want unique IRIs and don't care about content addressing or external joins.

```ts
entities.toQuads(EventSchema, event, { iriFor: Skolemize.uuid() });
// → urn:uuid:f81d4fae-7dec-11d0-a765-00a0c91e6bf6
```

### `Skolemize.fromProperty(name, { baseIRI, fallback })`

Mints `<baseIRI>/<value[name]>` when the value has a non-empty string at `value[name]`. Otherwise delegates to `fallback` (defaults to `Skolemize.hash`).

```ts
entities.toQuads(BookSchema, book, {
  iriFor: Skolemize.fromProperty('isbn', { baseIRI: 'https://books.example.com/isbn' })
});
// → https://books.example.com/isbn/9780140449136
```

The fallback runs whenever the property is missing or not a non-empty string, so heterogeneous instance trees still produce IRIs for every object.

### `Skolemize.compose(...strategies)`

Tries each strategy in order; the first non-`undefined` return wins. Use this to build per-class minting policies:

```ts
const strategy = Skolemize.compose(
  Skolemize.fromProperty('id', { baseIRI: 'https://shop.example.com/by-id' }),
  Skolemize.fromProperty('isbn', { baseIRI: 'https://books.example.com/isbn' }),
  Skolemize.hash({ baseIRI: 'https://shop.example.com' })
);
```

## Custom strategies

`iriFor` accepts any function with the `SkolemizeFnType` signature:

```ts
type SkolemizeFnType = (ctx: {
  path: string;   // JSON Pointer-style path to the current value
  value: unknown; // the object being projected
  depth: number;  // 0 at the root, +1 per nested object
}) => string | undefined;
```

Returning `undefined` falls through to the default `Skolemize.hash` minter. Within a single `projectAbox` call, results are memoized by value reference: the same input object always produces the same IRI within one emission.

```ts
entities.toQuads(OrderSchema, order, {
  iriFor: (ctx) => {
    if (ctx.depth === 0 && typeof ctx.value === 'object' && ctx.value !== null) {
      const id = (ctx.value as { id?: string }).id;
      if (typeof id === 'string') {
        return `https://shop.example.com/orders/${id}`;
      }
    }
    return undefined; // fall through
  }
});
```

## Two shorthand strings

For the most common cases, `iriFor` accepts a string literal:

- A regular IRI: `iriFor: 'https://shop.example.com/orders/A-1234'` — applied at the root only (depth 0). Nested objects fall through to the default minter. This matches the v1 `subjectIRI: string` behavior.
- The literal `'blank-node'`: emits `_:b<n>` blank nodes for every projected object. The counter is scoped to one `projectAbox` call, so two calls in a row both start at `_:b0`.

## Registry-level defaults

`JsonTology.create` accepts the same options as call sites, applied as defaults that per-call options override:

```ts
const jt = JsonTology.create({
  baseIRI: 'https://shop.example.com',
  iriFor: Skolemize.wellKnownGenid('https://shop.example.com'),
  defaultGraphIRI: 'https://shop.example.com/graphs/main',
  defaultDeskolemize: true,
  schemas: [OrderSchema, BookSchema]
});

// Uses registry defaults:
const quads = jt.toQuads(OrderSchema, order);

// Per-call override wins:
const named = jt.toQuads(OrderSchema, order, {
  iriFor: 'https://shop.example.com/orders/A-1234'
});
```

The `'blank-node'` registry-level default is re-instantiated on every call so the per-call counter starts fresh.

## Choosing a strategy

| Situation | Strategy |
|-----------|----------|
| Content-addressed identity (deterministic, dedup-safe) | `Skolemize.hash` (default) |
| Domain identifier on the value | `Skolemize.fromProperty` |
| Wire transport with blank-node round-trip | `Skolemize.wellKnownGenid` + `fromQuads({ deskolemize: true })` |
| Fresh anonymous identity, every time | `Skolemize.uuid` |
| Pure RDF blank nodes (no IRI at all) | `iriFor: 'blank-node'` |
| Complex per-class rules | `Skolemize.compose` or a custom function |
| Single fixed root IRI override | `iriFor: 'https://...'` |

## Related

- [RDF round-trip with `toQuads` / `fromQuads`](/advanced/quads) — the projection API
- [Graph concepts](/advanced/graph-concepts) — canonical graph structure
- [Getting started — graph emission](/getting-started#graph-emission) — registry-level options
