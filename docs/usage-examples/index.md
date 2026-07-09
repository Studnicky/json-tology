# Usage Examples

Runnable, scenario-driven walkthroughs that combine multiple json-tology APIs to solve one real problem end to end. Each page below assumes the [core concepts](/your-types-are-a-graph) and the [bookstore domain](/bookstore-domain); use this index to jump to the scenario that matches what you're building.

## [Custom format validators](./custom-formats)

Use this page when you need to validate a field format json-tology doesn't ship (an ISBN checksum, a slug pattern) or replace a built-in format validator (`date`, `email`, `uuid`) with your own.

## [Transform recipes](./transforms-recipes)

Use this page when you need a ready-made `Transform.create` (or `Transform.chain`) recipe for a common wire-to-runtime conversion — ISO date-time to `Date`, epoch milliseconds to `Date`, Temporal `PlainDate`, and other everyday decode/encode pairs.

## [Class hydration](./class-hydration)

Use this page when you want `jt.instantiate` to return a real class instance (not a plain object) — methods, getters, `instanceof` — and need to choose between the lift strategies (`Reflect.construct`, `fromPlain`, prototype swap) and understand their tradeoffs.

## [Class hydration: ORM recipes](./class-hydration-orm)

Use this page when the class you're hydrating into is an ORM entity or a DDD value object — TypeORM, Prisma, Mikro-ORM, Drizzle, Active Record — and you need the recipe for that specific pattern rather than the general lift strategies.

## [Sub-schema patterns](./sub-schema-patterns)

Use this page when you're working with registered `$ref` sub-schemas and need to see how validation, defaults, coercion, Transform decoders, and TBox emission each behave across a reference — including self-referential cycles.

## [Bookstore OWL taxonomy](./bookstore-owl-taxonomy)

Use this page when you're modeling an OWL class hierarchy on top of the bookstore domain — `subClassOf`, `disjointWith`, `complementOf`, property restrictions, invariants, and `sameAs` — and want to see how each axiom shows up in the TBox/ABox graph.

## [Multi-format ETL](./multi-format-etl)

Use this page when you need to ingest the same domain from several source shapes (multiple external APIs or message formats) into one canonical schema, and re-encode back out to a source shape — a fan-in/fan-out pivot-codec pipeline with `owl:sameAs` for cross-source provenance.

## Related

- [Bookstore domain](/bookstore-domain) - the schemas every example builds on
- [Picking a method](/picking-a-method) - choosing between `instantiate`, `validate`, `materialize`, and friends
- [`Transform.create` and `jt.encode`](/transforms/decode-encode) - the underlying decode/encode API used throughout this section
