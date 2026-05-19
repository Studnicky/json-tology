# CLI <Badge type="tip" text="Runtime" />

> Validation modes: [Validation modes reference](/validation-modes)

`json-tology build` compiles JSON Schema files to graph artifacts, reconstructed schemas, OWL ontologies, or SHACL shapes.

`json-tology viz` generates a self-contained HTML visualization of the schema graph.

## Usage

```
json-tology build --schema <glob> --output <dir> [options]
```

**Required:**

- `--schema <glob>` -- glob pattern for schema files (e.g. `'schemas/*.json'`)
- `--output <dir>` -- output directory

**Options:**

- `--format <format>` (default: `artifact`)
  - `artifact` -- per-schema binary graph artifact (`.artifact.json`)
  - `schema` -- reconstructed JSON Schema from canonical graph (`.schema.json`)
  - `ontology` -- unified OWL JSON-LD (`ontology.jsonld`)
  - `shacl` -- SHACL shapes JSON-LD (`shacl.jsonld`)
- `--base-iri <iri>` -- base IRI for ontology output (defaults to first schema's `$id` domain)
- `--output-file <filename>` -- custom output filename (for ontology/shacl formats)

## Simple

`json-tology build` compiles schemas into an OWL ontology.

```bash
json-tology build --schema 'schemas/*.json' --output dist/ --format ontology
```

Output: `dist/ontology.jsonld`

The file contains a JSON-LD document with `@context`, `@graph`, `@type: owl:Ontology`, and all classes/properties derived from the schemas.

## Typical

### All four formats

```bash
# Graph artifacts -- one .artifact.json per schema
json-tology build --schema 'schemas/*.json' --output dist/artifacts --format artifact

# Reconstructed schemas from canonical graph
json-tology build --schema 'schemas/*.json' --output dist/schemas --format schema

# Unified OWL ontology
json-tology build --schema 'schemas/*.json' --output dist/ontology --format ontology

# SHACL shapes
json-tology build --schema 'schemas/*.json' --output dist/shacl --format shacl
```

Output structure:

```
dist/
  artifacts/
    User.artifact.json
    Order.artifact.json
  schemas/
    User.schema.json
    Order.schema.json
  ontology/
    ontology.jsonld
  shacl/
    shacl.jsonld
```

### Custom base IRI and output filename

```bash
json-tology build \
  --schema 'schemas/*.json' \
  --output dist/ \
  --format ontology \
  --base-iri 'https://myorg.io/vocab' \
  --output-file 'myorg-vocab.jsonld'
```

Output: `dist/myorg-vocab.jsonld` with `@id: "https://myorg.io/vocab/ontology/"`.

Without `--base-iri`, the IRI is derived from the first schema's `$id` domain.

## Advanced

### Build pipeline integration

CLI targets integrate with `package.json` scripts:

```json
{
  "scripts": {
    "build:artifacts": "json-tology build --schema 'schemas/*.json' --output dist/artifacts --format artifact",
    "build:ontology": "json-tology build --schema 'schemas/*.json' --output dist/ontology --format ontology",
    "build:shacl": "json-tology build --schema 'schemas/*.json' --output dist/shacl --format shacl",
    "build:schemas": "json-tology build --schema 'schemas/*.json' --output dist/schemas --format schema",
    "build": "tsc && npm run build:artifacts && npm run build:ontology"
  }
}
```

### Pre-compiled artifacts for production

The `artifact` format serializes the canonical graph for fast loading without re-parsing schemas at startup. Use it when schema compilation cost matters.

```bash
# Build step
json-tology build --schema 'schemas/*.json' --output dist/artifacts --format artifact

# Load in application code (the artifact is a JSON file)
# import artifact from './dist/artifacts/User.artifact.json' assert { type: 'json' };
```

### Roundtrip verification

The `schema` format reconstructs schemas from the canonical graph, allowing a diff against the originals to verify graph fidelity.

```bash
# Reconstruct schemas from canonical graph
json-tology build --schema 'schemas/*.json' --output dist/roundtrip --format schema

# Diff original vs reconstructed
diff schemas/User.json dist/roundtrip/User.schema.json
```

Any differences indicate schema features not yet captured in the graph. This is useful during development to validate graph fidelity.

---

## viz

`json-tology viz` generates a self-contained HTML visualization of the schema graph using Cytoscape.js.

### Usage

```
json-tology viz --schema <glob> [--output <file>] [--no-open]
```

**Required:**

- `--schema <glob>` -- glob pattern for schema files (e.g. `'schemas/*.json'`)

**Options:**

- `--output <file>` (default: `schema-graph.html`) -- output HTML file path
- `--no-open` -- skips auto-opening the file in the browser

### Simple

```bash
json-tology viz --schema 'schemas/*.json'
```

Output: `schema-graph.html`

Opens the visualization in the default browser. The page renders an interactive graph where nodes represent schemas and edges represent `$ref` relationships between them.

### Typical

```bash
json-tology viz --schema 'schemas/*.json' --output dist/graph.html --no-open
```

Output: `dist/graph.html`

Writes the visualization to a custom path without opening it. Useful in CI or when piping into other tooling.

### Graph layout

Nodes are colored by primary type:

- **blue** -- `object`
- **green** -- `array`
- **orange** -- `string`
- **purple** -- all other types

Edges connect schemas linked by `$ref`. Clicking a node opens a side panel with four tabs:

- **TypeScript type** -- derived type declaration
- **JSON Schema** -- original authored schema
- **OWL ontology** -- OWL class/property representation
- **SHACL shapes** -- SHACL NodeShape representation

### Standalone output

The HTML file is fully self-contained. It loads Cytoscape.js from CDN and embeds all graph data inline -- no local server or additional assets required. Share the file directly or host it on any static file server.

---

## owl-gen <Badge type="tip" text="v0.11.0+" />

`json-tology owl-gen` reads an OWL 2 TBox (JSON-LD file) and emits a TypeScript source module with `as const` schema literals, a registered registry constant, and `InferType`-backed per-class type aliases. The generated file is a standard build artefact: commit it alongside your source, or add it to `.gitignore` and regenerate in CI.

### Usage

```
json-tology owl-gen <input> --out <path> [options]
```

**Required:**

- `<input>` -- path to a JSON-LD OWL 2 TBox file

**Options:**

- `--out <path>` -- output path; omit the `.ts` extension (or append `/`) for registry-directory mode
- `--name <id>` -- identifier prefix for namespace exports (defaults to the stem of `--out` or `"ontology"`)
- `--base-iri <iri>` -- override `baseIRI` passed to `fromTbox`
- `--mode directory` -- force registry-directory output even when `--out` has a `.ts` extension

### Single-file mode

Emits all schemas + one registry constant into a single `.ts` file:

```bash
json-tology owl-gen ./ontologies/foaf.jsonld --out ./src/generated/foaf.ts
```

### Registry-directory mode

Emits one `entities/<Name>.ts` per OWL class plus an `index.ts` that mirrors the canonical bookstore layout. Triggered automatically when `--out` ends with `/` or has no `.ts` extension:

```bash
json-tology owl-gen ./ontologies/foaf.jsonld --out ./src/generated/foaf/
```

### Build-time integration

Add a `prebuild` script so generated files are always current before `tsc` starts:

```json
{
  "scripts": {
    "gen:foaf": "json-tology owl-gen ./ontologies/foaf.jsonld --out ./src/generated/foaf.ts",
    "prebuild": "npm run gen:foaf",
    "build": "tsc"
  }
}
```

## Related

- [OWL 2 TBox import (`fromTbox`)](/advanced/owl-import) - full `fromTbox` API, codegen options, real-ontology examples
- [Ontology and Graphs](/advanced/ontology) - the same `toTbox`, `toShacl`, `ontology` methods the CLI calls
- [Schemas](/schemas) - schema registration used by the CLI loader

## See also

- [Graph-native authoring](/advanced/graph-native-authoring) - authoring conventions that produce correct CLI output
- [Bookstore domain](/bookstore-domain) - example schema set for CLI experimentation
