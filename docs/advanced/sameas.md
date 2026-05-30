# `JsonTology.prototype.sameAs` <Badge type="tip" text="Runtime" />

**Declaration.** Records an `owl:sameAs` assertion between two individuals (ABox-level identity). Both IRIs denote the same real-world entity. Emitted at `toQuads()` time as a pair of symmetric quads.

<<< ../../examples/docs/advanced/42-sameas-signature.ts

**Use this when** you want to declare that two distinct IRIs refer to the same real-world entity. The canonical use is linking a current stable IRI to a legacy IRI after a system migration, or linking identifiers across two authoritative sources (e.g. an internal customer ID alongside a third-party marketplace ID). This is the ABox counterpart to `Compose.equivalent` (which is class-level via `owl:equivalentClass`).

**Don't use this when** the two schemas have different structure or you need class-level identity (use [`Compose.equivalent`](/composition/equivalent)). Don't use it to express that two records *should* be merged - `sameAs` asserts they *already* refer to the same individual and downstream reasoners will treat their property values as belonging to one entity. Don't try to declare an instance is `sameAs` a class; OWL forbids cross-level identity.

## Examples

### Example 1: Link a legacy CRM identifier to a stable customer IRI

The bookstore migrated from a legacy CRM in 2024. Customer Bastian Balthazar Bux carries the current bookstore IRI alongside the legacy CRM ID (`cust-00042`) the bookstore inherited from the old system. Declaring `sameAs` lets a reasoner merge facts about both. The new email from the bookstore and the old purchase history from the CRM resolve to one logical individual.

<<< ../../examples/docs/advanced/43-sameas-legacy-crm.ts

### Example 2: Cross-catalog book identity

Bastian ordered a rare first-edition Michael Ende's *Die unendliche Geschichte* (Klett Books, 1979). The bookstore catalogs it under one IRI; WorldCat's union catalog references the same physical edition under an OCLC record IRI. Declaring `sameAs` lets a bibliographic reasoner unify metadata (publisher, page count, ISBN-13) regardless of which authority the fact came from.

<<< ../../examples/docs/advanced/44-sameas-cross-catalog-book.ts

### Example 3: Idempotence: duplicate and reverse pairs are no-ops

Recording the same pair twice, or in reverse order, is a no-op. Self-pairs are silently dropped.

<<< ../../examples/docs/advanced/45-sameas-idempotence.ts

### Example 4: Symmetric emission

`owl:sameAs` is symmetric by definition, but reasoners differ in whether they materialize the symmetric edge. `sameAs` emits both directions so consumers see the relation regardless of reasoner behaviour.

<<< ../../examples/docs/advanced/46-sameas-symmetric-emission.ts

## Bad examples: what NOT to do

### Anti-pattern 1: Using sameAs for class-level identity

<<< ../../examples/docs/advanced/47-sameas-antipattern-class-level.ts

### Anti-pattern 2: Declaring sameAs between two editions of the same title

<<< ../../examples/docs/advanced/48-sameas-antipattern-two-editions.ts

### Anti-pattern 3: Calling sameAs after toQuads instead of before

<<< ../../examples/docs/advanced/49-sameas-antipattern-after-toquads.ts

## Comparison

::: code-group

```ts [json-tology]
bookstoreEntities.sameAs('urn:bookstore:customer:bastian-bux', 'urn:legacy-crm:cust-00042');
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
const bastian = sym('urn:bookstore:customer:bastian-bux');
const bastianCrm = sym('urn:legacy-crm:cust-00042');
store.add(new Statement(bastian, sym(`${OWL}sameAs`), bastianCrm, sym('urn:g')));
store.add(new Statement(bastianCrm, sym(`${OWL}sameAs`), bastian, sym('urn:g')));
// Limitation: both directions must be added manually; no schema validation
// or typed instance pipeline; standalone RDF store without JSON Schema authoring.
```

```py [rdflib (Python)]
from rdflib import Graph, URIRef, OWL
g = Graph()
bastian = URIRef('urn:bookstore:customer:bastian-bux')
bastian_crm = URIRef('urn:legacy-crm:cust-00042')
g.add((bastian, OWL.sameAs, bastian_crm))
g.add((bastian_crm, OWL.sameAs, bastian))
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
