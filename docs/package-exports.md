# Package exports map

json-tology ships nine `exports` subpaths. Each subpath is a separate entry point with its own `import` condition and `.d.ts`. Tree-shaking works at the subpath boundary — importing from `json-tology/types` does not pull in the runtime classes from `json-tology`, and vice versa.

## Subpath reference

### `json-tology` (root — `.`)

The main runtime entry. Exports:

- **`JsonTology`** — the facade class: `JsonTology.create`, `instantiate`, `validate`, `is`, `materialize`, `set`, `dump`, `ontology`, `encode`, `addComputed`, `addInvariant`, and more.
- **`Compose`** — schema derivation combinators: `extend`, `pick`, `omit`, `partial`, `required`, `intersection`, `discriminatedUnion`, `equivalent`, `subClassOf`, `restrictions`, and more.
- **`Transform`** — transform registration: `Transform.create`, `Transform.brand`, `Transform.chain`, `Transform.getDecoder`.
- **All error classes** — `BaseError`, `SchemaError`, `GraphError`, `InstantiationError`, `MaterializationError`, `CoercionError`, `DecodeError`, `EncodeError`, `TransformError`, `OwlImportError`, `ValidationErrors`.
- **Error-code constants** — `SchemaErrorCode`, `GraphErrorCode`, `InstantiationErrorCode`, `MaterializationErrorCode`, `CoercionErrorCode`, `TransformErrorCode`, `OwlImportErrorCode`. Import these to compare `error.code` without using magic strings.
- Runtime utilities: `AboxGraph`, `GraphEngine`, `Hash`, `Curie`, `Value`, `Changeset`, `Operations`, `Path`, `Resolver`, `Lift`, `Materializer`, `OntologyBuilder`, `GraphOntologySerializer`, `Loaders`.

**What is NOT in the root entry:** type aliases, interface contracts, and type-only utilities. These live behind `json-tology/types` and `json-tology/interfaces` respectively. This is by design — see below.

<!-- inline-ts-ok: published-package import surface for the root entry; documents the export map, not a runnable scenario. -->
```ts
import { JsonTology, Compose, Transform } from 'json-tology';
import { InstantiationError, SchemaErrorCode } from 'json-tology';
```

### `json-tology/value`

Value utilities and data-operation primitives for consumers who do not need the full registry. Exports:

- `Value`, `Changeset`, `Operations`, `Hash`

<!-- inline-ts-ok: published-package import surface for json-tology/value; documents the export, not a runnable scenario. -->
```ts
import { Value, Operations, Hash } from 'json-tology/value';
```

### `json-tology/schema`

Schema registration and composition without the graph or ontology modules. Exports:

- `Compose`, `SchemaRegistry`, `FormatRegistry`, `Transform`

Use this entry when you want the authoring and validation surface but do not need OWL/SHACL output or ABox projection.

<!-- inline-ts-ok: published-package import surface for json-tology/schema; documents the export, not a runnable scenario. -->
```ts
import { Compose, SchemaRegistry } from 'json-tology/schema';
```

### `json-tology/ontology`

Ontology serialization and graph utilities. Exports:

- `GraphOntologySerializer`, `GraphShaclSerializer`, `GraphSchemaSerializer`, `OntologyBuilder`

<!-- inline-ts-ok: published-package import surface for json-tology/ontology; documents the export, not a runnable scenario. -->
```ts
import { OntologyBuilder } from 'json-tology/ontology';
```

### `json-tology/types`

**Type aliases and compile-time utilities.** This subpath is types-only — it emits no runtime JavaScript. Exports every type alias and compile-time type declared in `src/types/`:

- `InferType<T>`, `InferSchemaType<T, TRoot, TRefs>`, `ParseOutputType<T>`, `MaterializedSchemaType<T>`, `LooseInputType<T>`, `SchemaReferencesMapType<T>`, `SchemaMapFromTupleType<T>`
- Branded primitive types, constraint brands (`MinLength`, `Pattern`, etc.), `Brand<T, Tag>`
- `JsonTologyTypeConfigInterface` for module augmentation (brand-disable configuration)

<!-- inline-ts-ok: published-package type-only import surface for json-tology/types; documents the export, not a runnable scenario. -->
```ts
import type { InferType, SchemaReferencesMapType } from 'json-tology/types';
```

### `json-tology/interfaces`

**Interface contracts.** This subpath is types-only — zero runtime output. Exports every interface declared in `src/interfaces/`:

- `SubClassOfSchemaInterface`, `ComposeInterface`, `CompositionAccumulatorInterface`
- `GraphEngineInterface`, `MaterializerInterface`, `SchemaRegistryInterface`
- `ValueInterface`, `CurieInterface`, `ChangesetInterface`
- `LoggerInterface`, `InvariantInterface`, `FormatRegistryInterface`
- All other interface contracts used in the public API

<!-- inline-ts-ok: published-package type-only import surface for json-tology/interfaces; documents the export, not a runnable scenario. -->
```ts
import type { SubClassOfSchemaInterface } from 'json-tology/interfaces';
import type { MaterializerInterface } from 'json-tology/interfaces';
```

### `json-tology/viz`

HTML renderer and visualization utilities. Exports `HtmlRenderer`, `VizDataCollector`, `TypeStringEmitter`. Used by the runnable documentation examples.

<!-- inline-ts-ok: published-package import surface for json-tology/viz; documents the export, not a runnable scenario. -->
```ts
import { HtmlRenderer } from 'json-tology/viz';
```

### `json-tology/owl-gen`

Browser-safe programmatic API for OWL TBox → TypeScript codegen. Returns generated source as strings; performs no file I/O. Exports `generateFromTbox`, `generateRegistryDirectory`.

<!-- inline-ts-ok: published-package usage sketch for json-tology/owl-gen; `myJsonLd` is an illustrative placeholder, not a runnable scenario. -->
```ts
import { generateFromTbox } from 'json-tology/owl-gen';
const source = generateFromTbox({ input: myJsonLd, name: 'bookstore' });
```

### `json-tology/owl-gen-node`

Node-only file-writing wrapper over `json-tology/owl-gen`. Adds `writeFromTbox` and `writeRegistryDirectory` which write the generated source to disk. Import from build scripts and CLI tooling only.

<!-- inline-ts-ok: published-package usage sketch for json-tology/owl-gen-node; `myJsonLd` is an illustrative placeholder, not a runnable scenario. -->
```ts
import { writeFromTbox } from 'json-tology/owl-gen-node';
writeFromTbox({ input: myJsonLd, name: 'bookstore', output: './src/bookstore-registry.ts' });
```

---

## Why interface contracts and type aliases are on subpaths, not the root

The root entry (`json-tology`) exports only runtime classes and error codes. Interface contracts (`json-tology/interfaces`) and type aliases (`json-tology/types`) are deliberately on separate subpaths.

The comment at the top of `src/index.ts` states the reason:

> Type aliases live behind `json-tology/types`; interface contracts live behind `json-tology/interfaces`. Importing those from this top-level entry is forbidden — it forces consumers' bundlers to pull the entire type graph when they only wanted the runtime, and it invites circular import cycles when internal modules look up to the package root for a single type.

This means `import type { SubClassOfSchemaInterface } from 'json-tology/interfaces'` is **the intended import**, not a workaround. The same applies to `InferType`, `InferSchemaType`, and every other type alias — they live in `json-tology/types`.

<!-- inline-ts-ok: import-path illustration (correct vs incorrect); documents the intended published import paths, not a runnable scenario. -->
```ts
// CORRECT — the intended import paths
import { JsonTology, Compose } from 'json-tology';
import type { InferType } from 'json-tology/types';
import type { SubClassOfSchemaInterface } from 'json-tology/interfaces';

// INCORRECT — SubClassOfSchemaInterface is not in the root barrel
// import type { SubClassOfSchemaInterface } from 'json-tology'; // compile error
```

Since both `json-tology/interfaces` and `json-tology/types` are type-only exports, they add no weight to your bundle and no runtime module to your graph. The subpath separation exists to keep internal import topologies acyclic and to let bundlers tree-shake the runtime classes cleanly without the full type graph attached.

---

## Quick reference

| Subpath | Runtime code | What you get |
|---|---|---|
| `json-tology` | Yes | `JsonTology`, `Compose`, `Transform`, error classes, error codes |
| `json-tology/value` | Yes | `Value`, `Changeset`, `Operations`, `Hash` |
| `json-tology/schema` | Yes | `Compose`, `SchemaRegistry`, `FormatRegistry`, `Transform` |
| `json-tology/ontology` | Yes | Serializers, `OntologyBuilder` |
| `json-tology/types` | No (types only) | `InferType`, `InferSchemaType`, constraint brands, `SchemaReferencesMapType` |
| `json-tology/interfaces` | No (types only) | `SubClassOfSchemaInterface`, `MaterializerInterface`, all interface contracts |
| `json-tology/viz` | Yes | `HtmlRenderer`, `VizDataCollector`, `TypeStringEmitter` |
| `json-tology/owl-gen` | Yes | `generateFromTbox`, `generateRegistryDirectory` (browser-safe) |
| `json-tology/owl-gen-node` | Yes | `writeFromTbox`, `writeRegistryDirectory` (Node.js, disk I/O) |

## Related

- [Getting Started](/getting-started#sub-path-imports) — sub-path import examples
- [Type Inference](/types/infer) — `InferType`, `InferSchemaType`, `SchemaReferencesMapType`
- [Static helpers](/static-helpers) — `JsonTology.create` options
