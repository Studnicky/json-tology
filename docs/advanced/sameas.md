# `JsonTology.prototype.sameAs` <Badge type="tip" text="Runtime" />

**Declaration.** Records an `owl:sameAs` assertion between two individuals (ABox-level identity). Both IRIs denote the same real-world entity. Emitted at `toQuads()` time as a pair of symmetric quads.

```ts
jt.sameAs(instanceIriA: string, instanceIriB: string): void
```

**Use this when** you want to declare that two distinct IRIs refer to the same real-world entity. The canonical use is linking a current stable IRI to a legacy IRI after a system migration, or linking identifiers across two authoritative sources (e.g. an internal customer ID alongside a third-party marketplace ID). This is the ABox counterpart to `Compose.equivalent` (which is class-level via `owl:equivalentClass`).

**Don't use this when** the two schemas have different structure or you need class-level identity (use [`Compose.equivalent`](/composition/equivalent)). Don't use it to express that two records *should* be merged - `sameAs` asserts they *already* refer to the same individual and downstream reasoners will treat their property values as belonging to one entity. Don't try to declare an instance is `sameAs` a class; OWL forbids cross-level identity.

## Examples

### Example 1: Link a legacy CRM identifier to a stable customer IRI

The bookstore migrated from a legacy CRM in 2024. Customer Alice Smith carries her bookstore IRI alongside the legacy CRM ID (`cust-00042`) the bookstore inherited from the old system. Declaring `sameAs` lets a reasoner merge facts about both — Alice's new email address from the bookstore and her old purchase history from the CRM resolve to one logical individual.

```ts
import { bookstoreEntities, CustomerSchema, aboxFixtures } from './bookstore/index.js';

bookstoreEntities.sameAs(
  'urn:bookstore:customer:alice-smith',
  'urn:legacy-crm:cust-00042'
);

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);
// quads include both directions:
//   <urn:bookstore:customer:alice-smith> owl:sameAs <urn:legacy-crm:cust-00042>
//   <urn:legacy-crm:cust-00042>          owl:sameAs <urn:bookstore:customer:alice-smith>
```

### Example 2: Cross-catalog book identity

Alice ordered a rare first-edition Frank Herbert's *Dune* (Chilton Books, 1965). The bookstore catalogs it under one IRI; WorldCat's union catalog references the same physical edition under an OCLC record IRI. Declaring `sameAs` lets a bibliographic reasoner unify metadata (publisher, page count, ISBN-13) regardless of which authority the fact came from.

```ts
import { bookstoreEntities, RareBookSchema, aboxFixtures } from './bookstore/index.js';

bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:dune-1965-chilton',
  'http://www.worldcat.org/oclc/463127'
);

const quads = bookstoreEntities.toQuads(RareBookSchema, aboxFixtures.rareBook);
// → both IRIs now resolve to the same rare-book individual across the
//   internal catalog and any partner reasoner that consults WorldCat.
```

### Example 3: Idempotence: duplicate and reverse pairs are no-ops

Recording the same pair twice, or in reverse order, is a no-op. Self-pairs are silently dropped.

```ts
import { bookstoreEntities } from './bookstore/index.js';

bookstoreEntities.sameAs('urn:bookstore:customer:alice-smith', 'urn:legacy-crm:cust-00042');
bookstoreEntities.sameAs('urn:legacy-crm:cust-00042', 'urn:bookstore:customer:alice-smith'); // no-op — pair already recorded
bookstoreEntities.sameAs('urn:bookstore:customer:alice-smith', 'urn:bookstore:customer:alice-smith'); // no-op — self-pair
```

### Example 4: Symmetric emission

`owl:sameAs` is symmetric by definition, but reasoners differ in whether they materialize the symmetric edge. `sameAs` emits both directions so consumers see the relation regardless of reasoner behaviour.

```ts
import { bookstoreEntities, CustomerSchema, aboxFixtures } from './bookstore/index.js';

bookstoreEntities.sameAs('urn:bookstore:customer:alice-smith', 'urn:legacy-crm:cust-00042');
const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

const sameAsQuads = quads.filter(q => q.predicate.value === 'http://www.w3.org/2002/07/owl#sameAs');
// sameAsQuads.length === 2 — both directions always emitted
```

## Bad examples: what NOT to do

### Anti-pattern 1: Using sameAs for class-level identity

```ts
import { bookstoreEntities } from './bookstore/index.js';

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

### Anti-pattern 2: Declaring sameAs between two editions of the same title

```ts
// ✗ Don't do this — sameAs asserts identity of individuals, not "they share
// a title". The 1965 Chilton first edition and the 1990 Ace mass-market
// paperback of Dune are two different physical books with different ISBNs,
// publishers, page counts, prices, and condition notes. They share an
// author and a title — that is what `Compose.equivalent` / shared $ref to
// the title primitive expresses at the class level, not what `sameAs`
// expresses at the instance level.
bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:dune-1965-chilton',     // First edition, hardcover, $12,500
  'urn:bookstore:rarebook:dune-1990-ace-paperback' // Mass-market paperback, $9.99
);
// A reasoner that consumes both edges will now treat one logical book as
// having two ISBNs, two publishers, two prices, and two condition reports —
// silently corrupting the catalog.

// ✓ Do this — use sameAs only across two IRIs that authoritatively name the
//   same physical or logical individual (one record in two systems, one
//   customer across a CRM migration, one book in two union catalogs).
bookstoreEntities.sameAs(
  'urn:bookstore:rarebook:dune-1965-chilton',
  'http://www.worldcat.org/oclc/463127'
);
```

### Anti-pattern 3: Calling sameAs after toQuads instead of before

```ts
import { bookstoreEntities, CustomerSchema, aboxFixtures } from './bookstore/index.js';

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer); // sameAs not yet recorded

bookstoreEntities.sameAs('urn:bookstore:customer:alice-smith', 'urn:legacy-crm:cust-00042'); // ✗ too late — not in quads

// ✓ Do this — record sameAs assertions before calling toQuads
bookstoreEntities.sameAs('urn:bookstore:customer:alice-smith', 'urn:legacy-crm:cust-00042');
const quads2 = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);
```

## Comparison

::: code-group

```ts [json-tology]
bookstoreEntities.sameAs('urn:bookstore:customer:alice-smith', 'urn:legacy-crm:cust-00042');
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
const alice = sym('urn:bookstore:customer:alice-smith');
const aliceCrm = sym('urn:legacy-crm:cust-00042');
store.add(new Statement(alice, sym(`${OWL}sameAs`), aliceCrm, sym('urn:g')));
store.add(new Statement(aliceCrm, sym(`${OWL}sameAs`), alice, sym('urn:g')));
// Limitation: both directions must be added manually; no schema validation
// or typed instance pipeline; standalone RDF store without JSON Schema authoring.
```

```py [rdflib (Python)]
from rdflib import Graph, URIRef, OWL
g = Graph()
alice = URIRef('urn:bookstore:customer:alice-smith')
alice_crm = URIRef('urn:legacy-crm:cust-00042')
g.add((alice, OWL.sameAs, alice_crm))
g.add((alice_crm, OWL.sameAs, alice))
# Limitation: manual symmetric emission; no schema-validated pipeline.
```

:::

## Future / not implemented

`owl:differentFrom`: the negation of `sameAs`. Tracked separately.

## Related

- [`Compose.equivalent`](/composition/equivalent) - `owl:equivalentClass` for class identity
- [OWL class restrictions](/composition/restrictions) - TBox-level constraints
- [Graph concepts (TBox / ABox)](/advanced/graph-concepts)
- [`toQuads` / `fromQuads`](/advanced/quads)

## See also

- [Bookstore domain](/bookstore-domain) - schema definitions used in examples
