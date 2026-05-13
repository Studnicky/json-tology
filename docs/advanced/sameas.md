# `JsonTology.prototype.sameAs` <Badge type="tip" text="Runtime" />

## Declaration

```ts
jt.sameAs(instanceIriA: string, instanceIriB: string): void
```

Records an `owl:sameAs` assertion between two individuals (ABox-level identity). Both IRIs denote the same individual. Emitted at `toQuads()` time as a pair of symmetric quads.

## Use this when

You want to declare that two distinct IRIs refer to the same real-world entity. This is the ABox counterpart to `Compose.equivalent` (which is class-level via `owl:equivalentClass`).

```ts
import { JsonTology } from 'json-tology';

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [PersonSchema] as const,
});

// Alice has two identifiers — declare them equal
jt.sameAs(
  'https://example.com/people/alice',
  'https://example.com/people/alice-from-legacy-system'
);

const quads = jt.toQuads(PersonSchema, aliceData);
// quads now include both directions:
//   <alice> owl:sameAs <alice-from-legacy-system>
//   <alice-from-legacy-system> owl:sameAs <alice>
```

## Symmetric emission

`owl:sameAs` is symmetric by definition, but reasoners differ in whether they materialize the symmetric edge. `JsonTology.prototype.sameAs` emits both directions so consumers see the relation regardless of reasoner behaviour.

## Idempotence

Recording the same pair twice (or in either direction) is a no-op. Self-pairs (`a sameAs a`) are silently dropped.

```ts
jt.sameAs('urn:a', 'urn:b');
jt.sameAs('urn:b', 'urn:a'); // no-op
jt.sameAs('urn:a', 'urn:a'); // no-op
```

## Don't use this when

* Use [`Compose.equivalent`](/composition/equivalent) for class-level identity (`owl:equivalentClass`). `sameAs` is for individuals, not classes.
* Don't use `sameAs` to express that two records *should* be merged. It is an OWL assertion that they *already* refer to the same individual — downstream reasoners will treat their property values as belonging to one entity.
* Don't try to declare an instance is `sameAs` a class. OWL forbids cross-level identity.

## Future / not implemented

* `owl:differentFrom` — the negation of `sameAs`. Tracked separately.

## Related

* [`Compose.equivalent`](/composition/equivalent) — `owl:equivalentClass` for class identity
* [OWL class restrictions](/composition/restrictions) — TBox-level constraints
* [Graph concepts (TBox / ABox)](/advanced/graph-concepts)
* [`toQuads` / `fromQuads`](/advanced/quads)
