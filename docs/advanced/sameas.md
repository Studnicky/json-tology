# `JsonTology.prototype.sameAs` <Badge type="tip" text="Runtime" />

**Declaration.** Records an `owl:sameAs` assertion between two individuals (ABox-level identity). Both IRIs denote the same real-world entity. Emitted at `toQuads()` time as a pair of symmetric quads.

```ts
jt.sameAs(instanceIriA: string, instanceIriB: string): void
```

**Use this when** you want to declare that two distinct IRIs refer to the same real-world entity. The canonical use is linking a current stable IRI to a legacy IRI after a system migration, or linking identifiers across two authoritative sources (e.g. an internal customer ID alongside a third-party marketplace ID). This is the ABox counterpart to `Compose.equivalent` (which is class-level via `owl:equivalentClass`).

**Don't use this when** the two schemas have different structure or you need class-level identity (use [`Compose.equivalent`](/composition/equivalent)). Don't use it to express that two records *should* be merged — `sameAs` asserts they *already* refer to the same individual and downstream reasoners will treat their property values as belonging to one entity. Don't try to declare an instance is `sameAs` a class; OWL forbids cross-level identity.

## Examples

### Example 1: Link a legacy CRM identifier to a stable IRI

The bookstore migrated from a legacy CRM. Customer Alice carries both her current stable IRI and her legacy CRM IRI. Declaring `sameAs` lets reasoners merge facts about both.

```ts
import { JsonTology } from 'json-tology';
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

entities.sameAs(
  'urn:bookstore:customer:AliceSmith',
  'urn:bookstore:customer:AliceSmithLegacy'
);

const aliceData = {
  id:    'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  email: 'alice@bookstore.example',
  name:  'Alice Smith',
};

const quads = entities.toQuads(CustomerSchema, aliceData);
// quads include both directions:
//   <urn:bookstore:customer:AliceSmith> owl:sameAs <urn:bookstore:customer:AliceSmithLegacy>
//   <urn:bookstore:customer:AliceSmithLegacy> owl:sameAs <urn:bookstore:customer:AliceSmith>
```

### Example 2: Cross-source book identity

A book is known by a different IRI in a partner catalog feed. Declaring `sameAs` lets a reasoner unify its properties from both sources.

```ts
import { bookstoreEntities as entities } from './bookstore/index.js';

// Internal catalog IRI and partner feed IRI for the same title
entities.sameAs(
  'https://bookstore.example/books/9780140449136',
  'https://partnercatalog.example/items/crimeandpunishment-dostoevsky'
);
// → downstream reasoners treat both IRIs as denoting the same book
```

### Example 3: Idempotence — duplicate and reverse pairs are no-ops

Recording the same pair twice, or in reverse order, is a no-op. Self-pairs are silently dropped.

```ts
import { bookstoreEntities as entities } from './bookstore/index.js';

entities.sameAs('urn:a', 'urn:b');
entities.sameAs('urn:b', 'urn:a'); // no-op — pair already recorded
entities.sameAs('urn:a', 'urn:a'); // no-op — self-pair
```

### Example 4: Symmetric emission

`owl:sameAs` is symmetric by definition, but reasoners differ in whether they materialize the symmetric edge. `sameAs` emits both directions so consumers see the relation regardless of reasoner behaviour.

```ts
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

entities.sameAs('urn:bookstore:customer:c1', 'urn:bookstore:customer:c1-legacy');
const quads = entities.toQuads(CustomerSchema, customerData);

const sameAsQuads = quads.filter(q => q.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs');
// sameAsQuads.length === 2 — both directions always emitted
```

## Bad examples — what NOT to do

### Anti-pattern 1: Using sameAs for class-level identity

```ts
import { bookstoreEntities as entities } from './bookstore/index.js';

// ✗ Don't do this — sameAs is for individuals; use Compose.equivalent for classes
entities.sameAs(
  'https://bookstore.example/Book',     // a class IRI
  'https://bookstore.example/CatalogItem' // another class IRI
);
// OWL forbids owl:sameAs between class URIs — this produces invalid RDF

// ✓ Do this — use Compose.equivalent for class-level identity
import { Compose } from 'json-tology';
import { BookSchema } from './bookstore/index.js';
const CatalogItemSchema = Compose.equivalent(BookSchema, {
  $id: 'https://bookstore.example/CatalogItem',
});
```

### Anti-pattern 2: Using sameAs to express a "should merge" intent

```ts
// ✗ Don't do this — sameAs is not a merge request; it is an ontological assertion
// that downstream reasoners act on immediately. If these records differ in
// property values, reasoners will merge those values.
entities.sameAs('urn:customer:c1', 'urn:customer:c2');
// If c1 and c2 have different email addresses, reasoners will now treat
// BOTH addresses as belonging to the same individual.

// ✓ Do this — use sameAs only when you are certain the IRIs denote the same entity
```

### Anti-pattern 3: Calling sameAs after toQuads instead of before

```ts
import { bookstoreEntities as entities, CustomerSchema } from './bookstore/index.js';

const quads = entities.toQuads(CustomerSchema, customerData); // sameAs not yet recorded

entities.sameAs('urn:customer:c1', 'urn:customer:c1-legacy'); // ✗ too late — not in quads

// ✓ Do this — record sameAs assertions before calling toQuads
entities.sameAs('urn:customer:c1', 'urn:customer:c1-legacy');
const quads2 = entities.toQuads(CustomerSchema, customerData);
```

## Comparison

::: code-group

```ts [json-tology]
entities.sameAs('urn:bookstore:customer:c1', 'urn:bookstore:customer:c1-legacy');
// Emits both directions at toQuads() time as owl:sameAs quads.
```

```ts [Zod]
// Zod has no RDF or identity layer. There is no equivalent concept.
// You would need a separate RDF library (n3, rdflib) to assert owl:sameAs.
```

```ts [Valibot]
// Valibot has no RDF or identity layer. No equivalent concept.
```

```ts [AJV]
// AJV is a validator only — no graph model, no RDF output.
// Emit owl:sameAs manually in your RDF serialization layer.
```

```ts [rdflib.js]
import { graph, sym, Statement } from 'rdflib';
const store = graph();
const OWL = 'http://www.w3.org/2002/07/owl#';
store.add(new Statement(sym('urn:c1'), sym(`${OWL}sameAs`), sym('urn:c1-legacy'), sym('urn:g')));
store.add(new Statement(sym('urn:c1-legacy'), sym(`${OWL}sameAs`), sym('urn:c1'), sym('urn:g')));
// Limitation: both directions must be added manually; no schema validation
// or typed instance pipeline; standalone RDF store without JSON Schema authoring.
```

```py [rdflib (Python)]
from rdflib import Graph, URIRef, OWL
g = Graph()
c1 = URIRef('urn:bookstore:customer:c1')
c1_legacy = URIRef('urn:bookstore:customer:c1-legacy')
g.add((c1, OWL.sameAs, c1_legacy))
g.add((c1_legacy, OWL.sameAs, c1))
# Limitation: manual symmetric emission; no schema-validated pipeline.
```

:::

## Future / not implemented

`owl:differentFrom` — the negation of `sameAs`. Tracked separately.

## Related

- [`Compose.equivalent`](/composition/equivalent) — `owl:equivalentClass` for class identity
- [OWL class restrictions](/composition/restrictions) — TBox-level constraints
- [Graph concepts (TBox / ABox)](/advanced/graph-concepts)
- [`toQuads` / `fromQuads`](/advanced/quads)

## See also

- [Bookstore domain](/bookstore-domain) — schema definitions used in examples
