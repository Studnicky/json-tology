# json-tology examples

Runnable example scripts demonstrating core json-tology features.

## Prerequisites

Build the project before running any example:

```bash
npm run build
```

Examples are strict TypeScript and run with `tsx`.

## Examples

| File | Description |
|------|-------------|
| `01-validation.ts` | Registers schemas and validates data with `validate()`, `is()`, and `errors()` |
| `02-parse-and-materialize.ts` | Instantiates with defaults applied, materializes full objects from partials |
| `03-ontology.ts` | Generates an OWL ontology (JSON-LD) from schemas with `$ref` relationships |
| `04-shacl.ts` | Generates SHACL shapes with constraint predicates from schema keywords |
| `05-abox.ts` | Projects validated instance data to ABox RDF quads (JSON-LD) |
| `06-composition.ts` | Extends, picks, and partials schemas with the `Compose` utility |
| `06b-abox-stable-iri.ts` | Projects ABox quads with stable canonical IRIs via `iriFor`/`graphIRI` |

### End-to-end walkthroughs

These TypeScript examples use a shared FOAF (Friend of a Friend) domain fixture (`test/fixtures/foaf.ts`) and cover the full value chain.

| File | Description |
|------|-------------|
| `e2e-types.ts` | Compile-time type inference, branded IDs, transforms, composition |
| `e2e-validation.ts` | Runtime validation pipeline: validate, coerce, value ops, sub-schema checks |
| `e2e-reasoning.ts` | TBox/ABox extraction → N3 serialization → EYE reasoner → social network inference |

## Run a single example

```bash
tsx examples/01-validation.ts
tsx examples/e2e-types.ts
```

## Run all examples

```bash
for f in examples/*.ts; do echo "=== $f ==="; tsx "$f"; echo; done
for f in examples/e2e-*.ts; do echo "=== $f ==="; tsx "$f"; echo; done
```
