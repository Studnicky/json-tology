# OWL 2 TBox import (`fromTbox`) <Badge type="tip" text="v0.10.0+" />

`fromTbox` is the inverse of `toTbox`. It reads an OWL 2 TBox (as JSON-LD, a quad array, or an N-Quads string) and reconstructs JSON Schema objects for every declared class, along with invariants, property characteristics, `owl:sameAs` pairs, and named individuals.

The round-trip contract is:

```
fromTbox ∘ toTbox ≈ identity   (on the supported OWL 2 axiom set)
```

"Approximately identity" because the OWL TBox encodes a subset of JSON Schema semantics. Primitive type facets (`minLength`, `minimum`, `format`, etc.) are not OWL class axioms and are not carried back through a generic OWL round-trip. The contract holds for all axioms listed in the **Supported axioms** table below.

## API

### Static helper (no registry state)

<!-- inline-ts-ok: API signature pseudocode; optional parameters use ?: syntax which is not runnable standalone -->
```ts
import { JsonTology } from 'json-tology';

const result: OwlImportResult = JsonTology.fromTbox(
  jsonLdStringOrQuads,   // string | object | QuadInterface[]
  { baseIRI?: string; prefixes?: Record<string, string> }
);
```

The static helper is stateless: it constructs a transient `OwlImporter` and discards it. Use it when you only need the reconstructed schemas as plain objects.

### Instance method (registers into the live registry)

<!-- inline-ts-ok: API signature pseudocode; optional parameters use ?: syntax which is not runnable standalone -->
```ts
const jt = JsonTology.create({ baseIRI: 'https://example.org' });
const result: OwlImportResult = jt.fromTbox(
  jsonLdStringOrQuads,
  { register?: boolean }  // default: true
);
```

When `register: true` (the default), all produced schemas are passed to `registry.set()`, invariants are registered, `sameAs` pairs are applied, and property characteristics are recorded. This makes the imported vocabulary immediately available for `validate()` / `instantiate()` / `materialize()` calls.

### Return type: `OwlImportResult`

| Field | Type | Description |
|-------|------|-------------|
| `schemas` | `JsonSchemaDocumentObjectType[]` | One schema per declared class IRI |
| `invariants` | `{ invariant, schemaId }[]` | Structural invariants from OWL axioms |
| `characteristics` | `{ characteristic, propertyIri }[]` | OWL property characteristics |
| `sameAs` | `[string, string][]` | `owl:sameAs` identity pairs |
| `individuals` | `{ iri, types, properties }[]` | Named individuals (ABox) |
| `unsupported` | `{ axiomIri, subjectIri }[]` | Axioms no dispatcher handled |

## Supported axioms

| OWL 2 axiom | Serialised predicate IRI | JSON Schema mapping |
|-------------|--------------------------|---------------------|
| Class declaration | `rdf:type owl:Class` | `{ $id: classIri, type: 'object' }` stub |
| `rdfs:subClassOf` | `rdfs:subClassOf` | `allOf: [{ $ref: parentIri }]` |
| `owl:equivalentClass` | `owl:equivalentClass` | `$ref: equivalentIri` |
| `owl:disjointWith` | `owl:disjointWith` | `disjointWith: otherIri` (symmetric) |
| `owl:complementOf` | `owl:complementOf` | `not: { $ref: complementIri }` |
| `owl:disjointUnionOf` | `owl:disjointUnionOf` | `oneOf` on member IRIs |
| `owl:ObjectProperty` with domain+range | `rdfs:domain` / `rdfs:range` | `properties[name]: { $ref: rangeIri }` |
| `owl:DatatypeProperty` with xsd:string range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'string' }` |
| `owl:DatatypeProperty` with xsd:boolean range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'boolean' }` |
| `owl:DatatypeProperty` with xsd:integer / xsd:int range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'integer' }` |
| `owl:DatatypeProperty` with xsd:decimal / xsd:double range | `rdfs:domain` / `rdfs:range` | `properties[name]: { type: 'number' }` |
| `owl:oneOf` datatype enumeration | `owl:oneOf` / `rdf:rest` / `rdf:first` | `enum: [...]` |
| Property characteristics | `rdf:type owl:FunctionalProperty` etc. | Recorded in `characteristics` |
| `owl:NamedIndividual` | `rdf:type owl:NamedIndividual` | Recorded in `individuals` |
| `owl:sameAs` | `owl:sameAs` | Recorded in `sameAs` |
| `rdfs:subPropertyOf` | `rdfs:subPropertyOf` | Recorded in `characteristics` |

## Example

<RunnableExample src="examples/docs/advanced/90-owl-import-roundtrip" />

## Limitations

The following OWL 2 constructs are not yet mapped to JSON Schema constraints:

| OWL 2 construct | Axiom IRI | Status |
|-----------------|-----------|--------|
| Qualified cardinality (`owl:minQualifiedCardinality`, `owl:maxQualifiedCardinality`) | `owl:onClass` | Not mapped to `minItems` / `maxItems` |
| Anonymous restriction nodes (`owl:Restriction` + `owl:someValuesFrom` / `owl:allValuesFrom`) outside the json-tology serialiser output | `owl:Restriction` | Reconstructed as `jt:restrictions` from json-tology TBox; not generalised for arbitrary OWL serialisations |
| `owl:intersectionOf` on class expressions | `owl:intersectionOf` | Partially handled via `allOf`; complex nested class expressions are logged as `unsupported` |
| `owl:unionOf` on class expressions | `owl:unionOf` | Partially handled via `oneOf`; complex anonymous class union nodes are logged as `unsupported` |
| `rdfs:comment` / `rdfs:label` literal annotations | `rdfs:comment`, `rdfs:label` | Not carried into `title` or `description` (annotation triples are consumed but not mapped) |
| Datatype facets (XSD `owl:withRestrictions`) | `owl:withRestrictions` | Not mapped to `minLength` / `minimum` / `pattern` |
| `owl:hasValue` restrictions | `owl:hasValue` | Not implemented |
| `owl:hasSelf` restrictions | `owl:hasSelf` | Not implemented |

If the input contains any of the above, the affected axiom IRI appears in `result.unsupported`. Round-tripping a TBox that was exported by json-tology's own `toTbox()` will produce zero unsupported entries because `toTbox()` only emits axioms in the supported set.

## Round-trip fidelity

Run `fromTbox(toTbox(schemas).jsonLd())` against the canonical bookstore registry to confirm the supported axiom set round-trips cleanly. The example in the previous section demonstrates this: it exports the bookstore TBox, reimports it into a fresh registry, and asserts that every OWL class axiom (subClassOf, disjointWith, complementOf, equivalentClass, property domain + range) is reconstructed correctly. The full source is at `examples/docs/advanced/90-owl-import-roundtrip.ts`.

## Compile-time types via codegen

`JsonTology.fromTbox` (and the `OwlImporter` underneath it) resolve an OWL TBox at **runtime**. TypeScript's type system operates at **compile time**: it cannot reach into an external file, execute it, and derive types from the result. This means that even though `fromTbox` reconstructs accurate JSON Schema objects, the static type of those schemas is `JsonSchemaDocumentObjectType`, not a narrow `as const` literal from which `InferType<…>` can extract a meaningful compile-time type.

The solution is a build-step code generator: run the ontology through a code generator once, write the resulting TypeScript module to disk, and then import that module as ordinary source. The generated module contains `as const` schema literals identical to what you would write by hand, so `InferType<typeof PersonSchema>` works exactly as it does for hand-authored schemas.

### Codegen workflow

```
ontology JSON-LD → json-tology owl-gen → TypeScript source → consumer imports
```

1. **Input**: any JSON-LD string or file that `fromTbox` accepts.
2. **Generator**: the `owl-gen` subcommand (or the `generateFromTbox` programmatic API).
3. **Output**: a `.ts` module that exports one `as const` schema literal per OWL class, with a matching `export type` per class derived via `InferType`.
4. **Consumption**: import the generated module in your application the same way you import hand-authored schemas.

### CLI

```bash
npx json-tology owl-gen ./foaf.jsonld --out ./src/generated/foaf.ts
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--out <path>` | stdout | Write the generated TypeScript source to `<path>`. |
| `--name <id>` | input filename basename (sanitized) | Identifier prefix used for namespace exports. |
| `--base-iri <iri>` | (none) | Override `baseIRI` passed to `fromTbox`. |

### Programmatic API

<!-- inline-ts-ok: API signature pseudocode; generateFromTbox parameters use ?: syntax which is not runnable standalone -->
```ts
import { generateFromTbox } from 'json-tology/owl-gen';

const source: string = generateFromTbox({
  input: jsonLdStringOrObject,  // string | object
  name?: string,                // identifier prefix (e.g. 'foaf')
  baseIRI?: string,             // passed through to fromTbox
});
```

`generateFromTbox` returns the generated TypeScript source as a string. Writing it to disk is the caller's responsibility: use `fs.writeFileSync` or pass `--out` on the CLI.

### Runnable example

<<< ../../examples/docs/advanced/91-owl-codegen-generated.ts

### Build-time integration

**`package.json` prebuild hook.** Run the generator before every TypeScript compilation so the generated file is always current before `tsc` or your bundler starts:

```json
{
  "scripts": {
    "gen:foaf": "json-tology owl-gen ./ontologies/foaf.jsonld --out ./src/generated/foaf.ts",
    "prebuild": "npm run gen:foaf"
  }
}
```

This is the simplest option. Every `npm run build` re-generates the file first. CI receives the generated file baked into the source tree (commit it); or generate-on-CI and exclude it from the repo. Either pattern works.

**Vite plugin.** Wrap `generateFromTbox` in a Vite plugin's `buildStart` hook to integrate with the dev-server watch cycle. The plugin calls `generateFromTbox`, writes the result to disk, and invalidates the dependent module so HMR re-processes consumers. This is appropriate when the source ontology lives in `public/` or arrives via a remote URL that changes during development.

**Husky pre-commit hook.** Add a pre-commit script that regenerates all `.ts` outputs and `git add`s them. If the generated file changed, the commit captures the update automatically. This is a lightweight "always fresh" guarantee that does not require separate CI steps for code generation.

### Limitations

- **OWL-induced invariants are not serialised into the generated TypeScript.** Property characteristics (`owl:FunctionalProperty`, `owl:TransitiveProperty`, etc.) and cross-field invariants are recorded in `OwlImportResult.characteristics` and `OwlImportResult.invariants` at runtime. The code generator emits the structural schema only. Register characteristics and invariants programmatically after importing the generated module if you need them at runtime.
- **Generated files are one-way.** When the source ontology changes, regenerate the TypeScript file and commit the update. Do not hand-edit generated files; they will be overwritten on the next generation run.

## Generating a full registry directory <Badge type="tip" text="v0.12.0+" />

For production canonical domains, the **registry-directory mode** generates the same layout as the canonical bookstore example: one `entities/<Name>.ts` file per OWL class, plus an `index.ts` that imports all entities, constructs the registry, and re-exports all types and schema constants.

**When to use each mode:**

| Mode | When to use |
|------|-------------|
| Single-file (`--out foo.ts`) | Quick demos, prototypes, CLI pipelines where one file is easier to handle |
| Registry-directory (`--out foo/`) | Production canonical domains: mirrors the bookstore layout, each class gets its own file and type export |

The registry-directory output is structurally identical to a hand-authored domain: entity files use `export const <Name>Schema = { ... } as const` and `export type <Name> = InferType<typeof <Name>Schema>`, while `index.ts` constructs `JsonTology.create({ baseIRI, schemas })` in dependency order.

### CLI

```bash
# Auto-detect: trailing slash or no .ts extension → registry-directory mode
npx json-tology owl-gen ./foaf.jsonld --out ./src/generated/foaf/

# Explicit mode flag
npx json-tology owl-gen ./foaf.jsonld --out ./src/generated/foaf --mode directory
```

### Programmatic API

<!-- inline-ts-ok: API signature pseudocode; optional parameters use ?: syntax which is not runnable standalone -->
```ts
import { generateRegistryDirectory } from 'json-tology/owl-gen';

const result = generateRegistryDirectory({
  input: jsonLdStringOrObject,  // string | object | QuadInterface[]
  outDir: './src/generated/foaf',
  name?: string,                // registry constant name (e.g. 'foaf')
  baseIRI?: string,
  sourceLabel?: string,
});
// result.entityFiles — [{ path, iri, name }, ...]
// result.indexFile  — absolute path of the written index.ts
```

### Runnable examples

<<< ../../examples/docs/advanced/95-foaf-registry-dir.ts

### Entity file ↔ canonical bookstore symmetry

Each generated `entities/<Name>.ts` follows the same convention as `examples/docs/bookstore/entities/<Name>.ts`: a single `export const <Name>Schema = { ... } as const` plus a co-located `export type <Name> = InferType<typeof <Name>Schema>`. Cross-class `$ref`s remain as raw IRI strings inside the schema literal; the registry resolves them at construction time just as it does for hand-authored schemas.

## Real-ontology round-trip examples <Badge type="tip" text="v0.11.1+" /> {#real-ontology-examples}

The examples below run the full `fromTbox → generateFromTbox → validate` pipeline against three real-world standard vocabularies. Each fixture is a hand-authored concise subset, not the full upstream ontology, so it fits on a page and compiles in milliseconds.

The committed generated files (`examples/docs/ontologies/generated/*.generated.ts`) are refreshed by running `npm run regen:ontology-fixtures` when the codegen output format changes.

### FOAF (Friend of a Friend)

FOAF is a classic semantic-web vocabulary for describing people and their social relationships. The interesting round-trip detail: `owl:disjointWith` between `foaf:Person` and `foaf:Group` is encoded symmetrically; both class schemas carry `disjointWith` pointing at each other.

**Input ontology fixture:**

<<< ../../examples/docs/ontologies/foaf-subset.jsonld

**Generated TypeScript (`npm run regen:ontology-fixtures`):**

<<< ../../examples/docs/ontologies/generated/foaf.generated.ts

**Runnable round-trip:**

<<< ../../examples/docs/advanced/92-foaf-roundtrip.ts

### DCAT-AP (Data Catalog Vocabulary)

DCAT is a W3C recommendation for describing data catalogs and datasets published on the Web. The interesting round-trip detail: the `rdfs:subClassOf` chain reaches `dcterms:Resource`, an external IRI not defined in this subset. `fromTbox` handles this gracefully: `dcterms:Resource` becomes a class stub, and `dcat:Dataset` and `dcat:Catalog` carry `allOf: [{ $ref: "http://purl.org/dc/terms/Resource" }]` pointing to it.

**Input ontology fixture:**

<<< ../../examples/docs/ontologies/dcat-subset.jsonld

**Generated TypeScript:**

<<< ../../examples/docs/ontologies/generated/dcat.generated.ts

**Runnable round-trip:**

<<< ../../examples/docs/advanced/93-dcat-roundtrip.ts

### schema.org (Structured Data Vocabulary)

schema.org is a collaborative vocabulary for structured data on the Web, widely used for search-engine markup and data exchange. The interesting round-trip detail: `schema:IsbnType` is declared as an `rdfs:Datatype` with an `owl:withRestrictions` XSD pattern facet (`^\d{13}$`). This round-trips losslessly: the generated `IsbnTypeSchema` carries `type: 'string', pattern: '^\d{13}$'` and `BookSchema.properties.isbn` is a `$ref` pointing to `IsbnTypeSchema`.

**Input ontology fixture:**

<<< ../../examples/docs/ontologies/schema-org-subset.jsonld

**Generated TypeScript:**

<<< ../../examples/docs/ontologies/generated/schema-org.generated.ts

**Runnable round-trip:**

<<< ../../examples/docs/advanced/94-schema-org-roundtrip.ts

## Related

- [`jt.toTbox()`](/advanced/ontology#jt-totbox): OWL TBox emission (the inverse operation)
- [`jt.toShacl()`](/advanced/ontology#jt-toshacl): SHACL shapes emission
- [RDF round-trip (toQuads / fromQuads)](/advanced/quads): ABox data round-trip
- `OwlImporter` (`src/modules/ontology/OwlImporter.ts`): low-level class if you need to reuse a single importer across multiple inputs
