---
title: Library comparisons
description: Feature-by-feature comparison of json-tology against Zod, Valibot, TypeBox, AJV, Pydantic, Yup, Joi, io-ts, Effect Schema, ArkType, and Runtypes.
---

# Library comparisons

Capability matrix across the validators, codecs, and ontology tools most often compared to json-tology. Rows are concrete features; each cell is **Yes** / **Limited** / **No** / **N/A** with a one-line note where the answer needs context.

For runnable performance numbers see [Benchmarks](/benchmarks). For inline side-by-side code samples on individual methods, every reference page (under Validation, Composition, Transforms, Registry, etc.) includes a `code-group` showing the equivalent code in each peer library where supported.

> **Methodology.** Cells reflect each library's current public API as of 2026-05. Where a library can express a concept indirectly (e.g. `is`-style guards in plain TS), the cell says **Limited** with a note. **N/A** means the feature is structurally out of scope for that library (Pydantic is Python-only, AJV is JS-only, etc.).

## Authoring & type inference

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Authoring language | **JSON Schema** | TS DSL | TS pipe DSL | TS DSL → JSON Schema | JSON Schema | Python classes | TS DSL | JS DSL | TS combinators | TS combinators | TS string DSL | TS combinators |
| Static `T = Infer<schema>` | Yes | Yes | Yes | Yes | No | N/A (runtime classes) | Yes | Limited (typings) | Yes | Yes | Yes | Yes |
| Compile-time `$ref` resolution | Yes | No | No | Limited | No | N/A | No | No | Limited | Limited | No | No |
| Compile-time duplicate-`$id` check | Yes | N/A | N/A | No | No | N/A | N/A | N/A | No | No | N/A | No |
| Editor "go to definition" on `$id` | Yes | Yes (variable) | Yes (variable) | Yes | No | Yes | Yes (variable) | No | Yes | Yes | Limited | Yes |

## JSON Schema interop

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Authored *as* JSON Schema | Yes | No | No | Yes | Yes | No | No | No | No | No | No | No |
| Export to JSON Schema | Yes | Limited (3rd-party) | Limited (`@valibot/to-json-schema`) | Yes (identity) | Yes (identity) | Yes (`model_json_schema()`) | Limited (3rd-party) | No | No | Yes (`@effect/schema/JSONSchema`) | Yes | No |
| Import existing JSON Schema | Yes | No | No | Limited | Yes | Limited (`TypeAdapter`) | No | No | No | No | No | No |
| Draft 2020-12 | Yes | N/A | N/A | Limited | Yes | Limited | N/A | N/A | N/A | Limited | N/A | N/A |
| `$ref` between schemas | Yes | No | No | Limited | Yes | Limited | No | No | No | No | No | No |
| Custom keywords | Yes (vocab plugins) | No | No | Limited | Yes | Limited | No | No | No | No | No | No |

## Runtime validation

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Validate (errors only) | Yes (`validate`) | Yes (`safeParse`) | Yes (`safeParse`) | Yes (`Check`/`Errors`) | Yes | Yes | Yes | Yes | Yes (`decode`) | Yes | Yes | Yes (`check`) |
| Parse / instantiate (throw on fail) | Yes (`instantiate`) | Yes (`parse`) | Yes (`parse`) | Yes (`Decode`) | No (validate only) | Yes (`model_validate`) | Yes (`validate`) | Yes (`validateAsync`) | Yes | Yes (`decode`) | Yes | Yes (`parse`) |
| Type guard / predicate | Yes (`is`) | Limited | Yes (`is`) | Yes (`Check`) | No | No | No | No | Yes (`is`) | Yes (`is`) | Yes (`assert`/`allows`) | Yes (`guard`) |
| All-errors mode | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Limited |
| Async validators | Limited | Limited (`refine` w/ async) | Yes (`asyncParse`) | No | Limited | Yes (`@field_validator`) | Yes | Yes (`validateAsync`) | Limited | Yes (Effect) | No | No |
| Compiled validators (codegen) | Limited (graph cache) | No | No | Limited (compile) | **Yes (codegen)** | No | No | No | No | No | No | No |

## Coercion & transforms

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| String → number/boolean cast | Yes (`cast` / `enableTypeCast`) | Yes (`z.coerce.*`) | Yes (`coerce`) | Limited | No | Yes | Yes | Yes | No | Yes | Limited | No |
| Strip unknown keys | Yes (`clean`) | Yes (`.strip()`) | Yes (`strip*`) | No | No | Yes (`extra='ignore'`) | Yes (`.noUnknown()`) | Yes (`.unknown(false)`) | No | Yes | No | No |
| Decode → typed value (codec) | Yes (Transform) | Yes (`.transform()`) | Yes (`transform`) | Limited | No | Yes (validators) | Yes (`.transform()`) | Yes (custom) | Yes (`Type<A, O, I>`) | Yes (codec-first) | No | No |
| Encode → wire format (codec) | Yes (`Transform.encode` / `dump`) | Limited | Limited | Limited | No | Yes (`model_dump`) | No | No | Yes | Yes | No | No |
| Branded / nominal types | Yes (constraint brands) | Yes (`z.brand`) | Yes (`brand`) | Yes | No | No | No | No | Yes | Yes | Yes | Yes |
| Default values | Yes | Yes (`.default()`) | Yes (`optional` w/ default) | Yes | Yes | Yes | Yes | Yes | Limited | Yes | Yes | Limited |
| Computed properties | Yes (`addComputed`) | Limited (`.transform()`) | Limited | No | No | Yes (`@computed_field`) | No | No | No | Yes | No | No |

## Composition

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Extend / merge | Yes (`Compose.extend`) | Yes (`.extend()`) | Yes (`merge`) | Yes (`Intersect`) | Yes (`allOf`) | Yes (inherit) | Yes (`.concat()`) | Yes (`.concat()`) | Yes (`intersection`) | Yes | Yes | Yes |
| Pick / omit | Yes | Yes | Yes | Yes (`Pick`/`Omit`) | No | Yes (`model_fields`) | Yes (`.pick`/`.omit`) | No | No | Yes | Yes | Yes |
| Partial / required | Yes | Yes (`.partial()`) | Yes (`partial`) | Yes (`Partial`) | No | Yes | Yes (`.partial`) | No | No | Yes | Yes | Yes |
| Intersection | Yes | Yes (`.and()`) | Yes (`intersect`) | Yes (`Intersect`) | Yes (`allOf`) | N/A | No | No | Yes | Yes | Yes (`&`) | Yes |
| Discriminated union | Yes | Yes (`.discriminatedUnion`) | Yes (`variant`) | Yes (`Union` + tag) | Yes (`oneOf` + discriminator) | Yes (`Union` + tag) | No | No | Yes (`taggedUnion`) | Yes | Yes | Yes |
| Structural equivalence detection | Yes (`findDuplicates`) | No | No | No | No | No | No | No | No | No | No | No |

## Ontology & RDF

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Canonical graph representation | Yes | No | No | No | No | No | No | No | No | No | No | No |
| OWL TBox emission | Yes (`toTbox`) | No | No | No | No | No | No | No | No | No | No | No |
| SHACL shape emission | Yes (`toShacl`) | No | No | No | No | No | No | No | No | No | No | No |
| RDF quad round-trip | Yes (`toQuads`/`fromQuads`) | No | No | No | No | No | No | No | No | No | No | No |
| `owl:sameAs` / ABox identity | Yes | No | No | No | No | No | No | No | No | No | No | No |
| Schema visualization | Yes (Cytoscape via `viz`) | Limited (3rd-party) | No | No | Limited | No | No | No | No | No | No | No |

## Runtime & platform

| Capability | json-tology | Zod | Valibot | TypeBox | AJV | Pydantic | Yup | Joi | io-ts | Effect Schema | ArkType | Runtypes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Browser runtime | Yes | Yes | Yes | Yes | Yes (bundle) | No (Python) | Yes | Limited | Yes | Yes | Yes | Yes |
| Node ≥ 24 | Yes | Yes | Yes | Yes | Yes | N/A | Yes | Yes | Yes | Yes | Yes | Yes |
| Bun / Deno | Yes | Yes | Yes | Yes | Yes | N/A | Yes | Limited | Yes | Yes | Yes | Yes |
| Tree-shakable | Limited | Limited | **Yes** | Yes | Limited | N/A | Yes | No | Yes | Limited | Yes | Yes |
| Zero runtime dependencies | Limited (`commander` for CLI only) | Yes | Yes | Yes | No | N/A | No | No | Yes | No (Effect runtime) | Yes | Yes |
| TypeScript strict-mode clean | Yes | Yes | Yes | Yes | Limited | N/A | Limited | Limited | Yes | Yes | Yes | Yes |
| Federated / dynamic schema loading | Yes (`prefetch` + snapshot) | No | No | No | Yes (`loadSchema`) | Limited (`TypeAdapter`) | No | No | No | No | No | No |

## When to reach for each

- **json-tology** — your schemas need to act as both a TypeScript type source *and* a knowledge graph (OWL/SHACL/RDF). You author in JSON Schema once and project from there.
- **Zod** — pure runtime validation with first-class TS inference and a friendly DSL. The default reach for TS-first apps with no graph requirements.
- **Valibot** — same niche as Zod but tree-shakable and roughly 10× smaller bundle on minimal use.
- **TypeBox** — you want JSON Schema as the canonical artifact but author in a TS-typed DSL. The closest comparator to json-tology on the schema-as-output axis.
- **AJV** — pure JSON Schema validation, no TS inference, fastest in cold-path validation throughput. Pair with TypeBox for typed authoring.
- **Pydantic** — Python. Sets the bar for type-first runtime validation in the Python ecosystem; cross-language reference.
- **Yup / Joi** — older DSL-first validators; common in legacy forms / web APIs. Yup is TS-friendly; Joi is JS-first.
- **io-ts** — pure functional codec library. Decoder/encoder symmetry is its strength; fp-ts integration is its tax.
- **Effect Schema** — codec library inside the Effect ecosystem. Strong when the rest of the app already uses Effect; heavy import otherwise.
- **ArkType** — DSL is a string with TS-typed grammar (literal-types magic). Speed-competitive; novel ergonomics.
- **Runtypes** — combinator library. Smaller and simpler than io-ts; less powerful codec story.

## See also

- [Benchmarks](/benchmarks) — runnable performance comparisons.
- [References](/references) — links to every library's docs.
- [Picking a method](/picking-a-method) — choosing between `validate` / `instantiate` / `is` inside json-tology.
