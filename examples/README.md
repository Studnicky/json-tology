# json-tology examples

Runnable example scripts demonstrating core json-tology features.

## Prerequisites

Build the project before running any example:

```bash
npm run build
```

## Examples

| File | Description |
|------|-------------|
| `01-validation.mjs` | Register schemas and validate data with `validate()`, `is()`, and `errors()` |
| `02-parse-and-materialize.mjs` | Parse with defaults applied, materialize full objects from partials |
| `03-ontology.mjs` | Generate an OWL ontology (JSON-LD) from schemas with `$ref` relationships |
| `04-shacl.mjs` | Generate SHACL shapes with constraint predicates from schema keywords |
| `05-abox.mjs` | Project validated instance data to ABox RDF quads (JSON-LD) |
| `06-composition.mjs` | Extend, pick, and partial schemas with the `Compose` utility |

## Run a single example

```bash
node examples/01-validation.mjs
```

## Run all examples

```bash
for f in examples/*.mjs; do echo "=== $f ==="; node "$f"; echo; done
```
