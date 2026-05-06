# References

External standards, comparable libraries, and tooling referenced throughout the docs. This page is the canonical home for outbound links - other pages reference back here rather than re-stating URLs.

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
| [RDF Schema 1.1](https://www.w3.org/TR/rdf-schema/) | `rdfs:Class`, `rdfs:domain`, `rdfs:range`, `rdfs:subClassOf` emission. |
| [OWL 2 Web Ontology Language](https://www.w3.org/TR/owl2-overview/) | TBox emission via `JsonTology.toTbox()` / `entities.ontology()`. |
| [SHACL Shapes Constraint Language](https://www.w3.org/TR/shacl/) | SHACL shape emission via `JsonTology.toShacl()`. |
| [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/) | TBox/quad serialization format via `dump`/`dumpJson`. |
| [XSD Datatypes](https://www.w3.org/TR/xmlschema11-2/) | Mapping JSON Schema `format` to XSD types in the RDF projection. |
| [Schema.org](https://schema.org/) | Default vocabulary for property predicates. |
| [Dublin Core Terms](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) | Optional metadata predicates. |
| [Turtle (W3C)](https://www.w3.org/TR/turtle/) | Round-trippable serialization (via downstream tooling). |

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

## Where these are referenced

Comparison blocks: every operator page (`/validation/*`, `/composition/*`, `/transforms/*`, `/serialization/*`, `/registry/*`).

Standards prose: `/advanced/ontology`, `/advanced/quads`, `/advanced/sub-schemas`, `/advanced/graph-concepts`, `/schemas/jt-keywords`, `/errors/views`.
