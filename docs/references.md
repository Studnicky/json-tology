# References

External standards, comparable libraries, and tooling referenced throughout the docs. This page is the canonical home for outbound links - other pages reference back here rather than re-stating URLs.

## Supported dialect

json-tology targets **JSON Schema draft 2020-12** (`https://json-schema.org/draft/2020-12/schema`). All examples and documentation assume this dialect. The specification is on track for Proposed Standard via the [IETF JSON Schema Working Group](https://datatracker.ietf.org/wg/jsonschema/about/).

## Standards conformance

> **W3C / RDF / OWL / SHACL conformance is aspirational and a work in progress.** json-tology emits OWL TBox and SHACL shapes from the canonical graph and round-trips RDF quads, but full normative conformance with each spec is still being built out. Output is intended to load into tools like [Protege](https://protege.stanford.edu/), [TopBraid Composer](https://www.topquadrant.com/products/topbraid-composer/), and standards-track reasoners; expect rough edges as the projection layers catch up to the specs.

If you hit a conformance gap, open an issue at [github.com/Studnicky/json-tology/issues](https://github.com/Studnicky/json-tology/issues).

## Standards

| Spec | Where used in json-tology |
|------|---------------------------|
| [JSON Schema 2020-12](https://json-schema.org/specification.html) | The authoring language. Every schema literal is a draft-2020-12 document. |
| [JSON Pointer (RFC 6901)](https://datatracker.ietf.org/doc/html/rfc6901) | Error paths, `subschemaAt`, `$ref` fragments. |
| [Problem Details (RFC 7807)](https://datatracker.ietf.org/doc/html/rfc7807) | `ValidationErrors.report()` shape. |
| [RDF 1.2 Concepts](https://www.w3.org/TR/rdf12-concepts/) | Quad model, IRIs, literals. |
| [RDF 1.1 §3.5 Skolemization](https://www.w3.org/TR/rdf11-concepts/#section-skolemization) | Well-known genid IRI pattern minted by `Skolemize.wellKnownGenid`. |
| [RDFC-1.0 (RDF Dataset Canonicalization)](https://www.w3.org/TR/rdf-canon/) | Reference for deterministic identification of RDF nodes in the skolemization design. |
| [RDF Schema 1.1](https://www.w3.org/TR/rdf-schema/) | `rdfs:Class`, `rdfs:domain`, `rdfs:range`, `rdfs:subClassOf` emission. |
| [OWL 2 Web Ontology Language](https://www.w3.org/TR/owl2-overview/) | TBox emission via `JsonTology.toTbox()` / `entities.ontology()`. |
| [SHACL Shapes Constraint Language](https://www.w3.org/TR/shacl/) | SHACL shape emission via `JsonTology.toShacl()`. |
| [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) | TBox/quad serialization format via `toTbox`, `toShacl`, `ontology`. |
| [XSD Datatypes](https://www.w3.org/TR/xmlschema11-2/) | Mapping JSON Schema `format` to XSD types in the RDF projection. |
| [Schema.org](https://schema.org/) | Default vocabulary for property predicates. |
| [Dublin Core Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) | Optional metadata predicates. |
| [Turtle (W3C)](https://www.w3.org/TR/turtle/) | Round-trippable serialization (via downstream tooling). |

## Tooling and ecosystem

External JSON Schema tooling and commentary that frame json-tology's positioning. json-tology is one node in a wider JSON Schema ecosystem; these references are where to look when the question is about JSON Schema as a language rather than json-tology as a library.

### [sourcemeta/jsonschema](https://github.com/sourcemeta/jsonschema)

The reference command-line tool for JSON Schema authors - linting, formatting, bundling, dereferencing, dialect upgrades, schema-level unit tests, and binary encoding, supporting every dialect from Draft 0 through 2020-12. It is the right tool for treating JSON Schema documents themselves as a build artifact: pre-commit format checks, CI lint gates, bundle-for-distribution. json-tology authors who keep schemas in a shared registry should run sourcemeta/jsonschema alongside json-tology's TypeScript-side checks.

### [AI only speaks JSON Schema](https://www.sourcemeta.com/blog/ai-only-speaks-json-schema/)

Sourcemeta essay documenting that every major LLM provider (OpenAI, Anthropic, Google, xAI, Mistral, DeepSeek) converged on JSON Schema as the sole schema language for structured outputs and tool calling - not Protocol Buffers, not Avro, not OpenAPI, not Pydantic-as-source. This is the external argument for json-tology's wager: if JSON Schema is what models speak, then the authoring language should be JSON Schema and everything else (TypeScript types, OWL TBox, SHACL shapes, RDF) should be projections of it.

### [IETF JSON Schema Working Group](https://datatracker.ietf.org/wg/jsonschema/about/)

The active IETF working group taking JSON Schema toward a Proposed Standard RFC, chaired by Paul E. Hoffman with target publication May 2027. The WG charter scopes a single RFC covering features already in known use, plus IANA media-type registration and security considerations. json-tology's contract - "JSON Schema is the authoring language" - is a bet on this standardization track; users who care about long-term spec stability should track the WG's drafts and milestones.

## Comparable libraries

| Library | Language | Where compared |
|---------|----------|----------------|
| [Zod](https://zod.dev/) | TypeScript | Validation, coercion, transforms - DSL-first vs json-tology's JSON-Schema-first |
| [Valibot](https://valibot.dev/) | TypeScript | Validation, transforms - tree-shakable functional API |
| [TypeBox](https://github.com/sinclairzx81/typebox) | TypeScript | Closest comparator - TypeBox schemas are JSON Schema |
| [AJV](https://ajv.js.org/) | JavaScript | Pure JSON Schema validator - no TS inference, no ontology output |
| [Pydantic](https://docs.pydantic.dev/) | Python | Cross-language reference for the type-first runtime-validating model |
| [Yup](https://github.com/jquense/yup) | TypeScript | Older DSL-first validator |
| [Joi](https://joi.dev/) | JavaScript | Older DSL-first validator |
| [io-ts](https://gcanti.github.io/io-ts/) | TypeScript | Functional codec library |
| [Effect Schema](https://effect.website/docs/schema/introduction) | TypeScript | Codec library inside the Effect ecosystem |
| [ArkType](https://arktype.io/) | TypeScript | DSL-first with TS-string-literal grammar |
| [Runtypes](https://github.com/runtypes/runtypes) | TypeScript | Functional combinator library |

Comparison code-group blocks throughout the docs show the equivalent code in each library where supported, with `Limitation:` notes where the peer library cannot express the concept.

## Reasoners and graph tooling

| Tool | Use |
|------|-----|
| [eye-js / eyereasoner](https://github.com/eyereasoner/eye-js) | N3-rule reasoner; embedded in dev dependencies for testing TBox round-trips |
| [N3.js](https://github.com/rdfjs/N3.js) | Quad parser/serializer used by the RDF round-trip layer |
| [@rdfjs/types](https://rdf.js.org/data-model-spec/) | Standard quad-shape interfaces |
| [Comunica](https://comunica.dev/) | SPARQL engine over RDF/JS sources (compatible target for emitted graphs) |
| [Apache Jena](https://jena.apache.org/) | Standards-track Java reasoner; useful for cross-checking emitted TBox |
| [Protege](https://protege.stanford.edu/) | Visual ontology editor; loads emitted TBox |
| [TopBraid Composer](https://www.topquadrant.com/products/topbraid-composer/) | Commercial ontology IDE |
| [WebVOWL](http://vowl.visualdataweb.org/webvowl.html) | Visual notation for OWL ontologies |

## Languages and runtimes

- [TypeScript](https://www.typescriptlang.org/) - inference engine for `InferType`.
- [Node.js](https://nodejs.org/) - runtime; minimum `>=24.0.0`.
- [Vite](https://vitejs.dev/) - bundler used by the docs site.
- [VitePress](https://vitepress.dev/) - documentation framework.
- [Cytoscape.js](https://js.cytoscape.org/) - the live graph at [Your types are a graph](/your-types-are-a-graph).

## Visual identity

The seven hex nodes that flank the JST badge in the README and ring the sidebar are stylized references to. Each links to its canonical home:

- **[TypeScript](https://www.typescriptlang.org/)** (`#3178c6` adjacent) - the inference engine
- **[JSON Schema](https://json-schema.org/)** - the source-of-truth language
- **[Validation](https://json-schema.org/draft/2020-12/json-schema-validation)** - the JSON Schema Validation vocabulary spec
- **[RDF](https://www.w3.org/TR/rdf12-concepts/)** - the canonical graph model (RDF 1.2 Concepts)
- **[W3C](https://www.w3.org/)** - standards alignment
- **[Node.js](https://nodejs.org/api/)** - the runtime
- **[json-tology](https://studnicky.github.io/json-tology/)** - the center JST node, this project

The center JST node uses a teal gradient (`#7FE7D8` -> `#24A5B5` -> `#08717A`) with `#BDF6F2` circuit accents. These are the project's brand colors and drive the doc-site palette.

## Benchmarks {#benchmarks}

json-tology's performance against comparators: AJV, Zod, TypeBox (interpreted `Value` and compiled `TypeCompiler`), Valibot, io-ts, plus `JSON.stringify` and `structuredClone` for serialization and clone scenarios. Numbers come from the bench suite under `bench/`. Run `npm run bench:report` to regenerate.

Most of the per-call cost in json-tology comes from the canonical-graph-first execution model: every `validate` goes through the graph, which buys downstream features (ABox projection, OWL/SHACL emission, semantic round-trip, registry-wide reasoning) but adds work that a code-gen-only validator does not do.

### How to read the tables

- `ops/s` — operations per second after warmup. Higher is better.
- `ns/op` — nanoseconds per operation. Lower is better.
- `json-tology vs this` — multiplier between json-tology and the listed library on the same scenario. `2.39x faster` means json-tology runs 2.39 ops for every 1 op of the comparator; `2.39x slower` means the inverse. The cell reads `-` on the json-tology row itself.
- `N/A` — the comparator does not implement the scenario's surface (e.g. AJV has no coerce mode; `JSON.stringify` is not a validator).

The latest run is auto-generated from `bench/results/latest.md` and is included in full at the end of this section.

### What's in scope

| Suite | json-tology surface | Comparators |
| - | - | - |
| Validation | `registry.validate` | AJV `validate`, TypeBox `TypeCompiler.Check`, Zod `safeParse`, Valibot `safeParse`, io-ts `decode` |
| Instantiation | `registry.instantiate` (no coercion) | TypeBox `Value.Parse`, Zod `parse`, Valibot `parse`, io-ts `decode` |
| Coerce | `registry.instantiate` with `castTypes: true`, defaults | TypeBox `Value.Parse`, Zod `parse`, Valibot `parse`, io-ts `decode` |
| Value operations | `Value.clone`, `Value.diff`, `registry.clean`, `registry.convert` | TypeBox `Value.Clean / Convert / Diff`, `structuredClone` |
| Transforms | `Transform.create` decode + facade `encode` | TypeBox `Value.Decode / Value.Encode`, Zod `.transform`, io-ts custom codec `decode`/`encode` |
| Composition | `Compose.extend / intersection / discriminatedUnion` | TypeBox `Type.Composite / Intersect / Union`, Zod `.extend / intersection / discriminatedUnion`, Valibot `variant` |
| Serialization | `dump`, `dumpJson`, facade `encode` | `JSON.stringify`, `structuredClone`, TypeBox `Value.Encode` |
| Registry | cold register + first validate, warm validate | TypeBox `TypeCompiler.Compile + Check`, Zod, Valibot |
| Compiled vs Interpreted | `SchemaCompiler` vs `GraphEngine.execute` | internal — measures the speedup of the compile path |

### What's unique

These are operations no comparator implements. They appear only as a single-library row in the report and are included for completeness, not as head-to-head wins.

- `toTbox` — OWL TBox projection from the canonical graph.
- `toShacl` — SHACL shape projection.
- `toQuads` / `fromQuads` — RDF round-trip via projection.
- ABox projection through `Materializer.projectAbox`.
- `findDuplicates` over the registry.
- The `jt:` keyword set (computed properties, invariants, decoders, brands).
- OWL / SHACL emission through `OntologyBuilder`.

### Where we have work to do

Scenarios where json-tology is more than 5x slower than the median comparator. Each is a known issue.

- `simple valid` validation (~6x slower than median) — the per-validate graph traversal cost dominates a 5-property flat schema. Tracked: rework hot path so flat schemas skip subgraph dispatch when no $refs are present.
- `nested valid` validation (~7x slower than median) — same root cause as `simple valid`, amplified by per-property subschema lookup. Tracked: precompile a flattened property dispatch table per schema graph.
- `convert simple` (~32x slower than TypeBox) — `castTypes: true` runs a separate normalize pass over the value before validate. Tracked: fold normalize into the compiled validator.
- `extend + validate` cold path (~12x slower than TypeBox) — registering a derived schema rebuilds the canonical graph from scratch per call. Tracked: cache subgraph fragments at register time.
- `intersection` cold path (~12x slower than Zod) — same root cause as `extend + validate`.
- `dumpJson nested` (~8x slower than `JSON.stringify`) — `dump` walks the schema graph for every property. Tracked: short-circuit when no Transform encoders are attached anywhere in the subgraph.
- `discriminated union` warm (~74x slower than TypeBox compiled) — every variant is currently re-resolved through `oneOf` semantics. Tracked: discriminator-aware fast path that switches directly on the discriminator key.
- `cold first validate` (~156x slower than Valibot) — Valibot has no compile step at all; the cold path is the warm path. Our cold path includes graph construction, subschema linking, and JIT compilation. Acceptable cost because subsequent calls are fast, but the gap is honest. Tracked: lazy subgraph build for unreachable parts of the schema.

### Reproduce

```bash
npm install
npm run bench:report
```

The runner prints to console and writes `bench/results/latest.md`. Bench numbers move with hardware. CI runs are uploaded as workflow artifacts (see `.github/workflows/bench.yml`); use those as the canonical reference once bench-in-CI is established.

For deeper investigation:

```bash
npm run bench         # human-readable console output, no markdown
npm run bench:flame   # 0x flame graph profiling under .flame/
```

### Latest run

The block below is auto-generated. To refresh it, run `npm run bench:report`.

<!--@include: ../bench/results/latest.md-->

## Where these are referenced

Comparison blocks: every operator page (`/validation/*`, `/composition/*`, `/transforms/*`, `/serialization/*`, `/registry/*`).

Standards prose: `/advanced/ontology`, `/advanced/quads`, `/advanced/sub-schemas`, `/advanced/graph-concepts`, `/schemas/jt-keywords`, `/errors/views`.
