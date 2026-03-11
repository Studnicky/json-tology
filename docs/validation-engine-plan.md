# Unified Coverage Plan

## Objective

Build `json-tology` as a single graph-native type system whose end-state coverage subsumes the overlapping capabilities of:

- TypeBox
- `json-schema-to-ts`
- TypeScript's compile-time type system
- JSON-LD
- SHACL
- AJV

The project must be able to express, execute, and serialize the cases these systems cover through one canonical semantic backbone.

## Research Envelope

The target coverage comes from these source systems:

- **TypeBox**: JSON Schema authoring builders, static typing, value operations, schema compilation, transform/codec patterns, and TypeScript-shaped schema ergonomics.
- **`json-schema-to-ts`**: schema typing, schema-to-TypeScript inference, refs/definitions, composition keywords, extension hooks, deserialization mappings, and type-guard-adjacent typing.
- **TypeScript**: unions, intersections, conditionals, mapped types, indexed access, template literal types, generics, narrowing, `typeof`, `keyof`, `satisfies`, branded/opaque patterns, and compile-time compatibility rules.
- **JSON-LD**: graph identifiers, contexts, compaction, expansion, flattening, framing, named graphs, lists, sets, value objects, node objects, RDF conversion, and linked-data semantics.
- **SHACL**: node shapes, property shapes, targets, datatype/class/node-kind constraints, cardinality, property paths, logical composition, closed shapes, qualified value shapes, and SPARQL-based constraint expression.
- **AJV**: JSON Schema draft coverage, validation runtime behavior, formats, vocabularies, refs, dynamic refs, discriminators, standalone compilation/codegen, strictness controls, extension points, and adjacent dialect support such as JTD.

## Common Functional Core

Despite different interfaces, these systems share a common semantic center:

### Shape Definition

They all define or consume structured constraints over values, entities, and relationships.

Shared concepts include:

- primitives and datatypes
- objects/records and properties
- arrays/lists/tuples
- requiredness and cardinality
- enumerations and constants
- unions, intersections, exclusions, and conditionals
- references and reusable definitions
- annotations and metadata

### Identity and Addressability

They all need stable ways to identify and reuse definitions.

Shared concepts include:

- schema IDs
- local and external references
- anchors or graph identifiers
- reusable named definitions
- addressable substructures

### Static and Dynamic Semantics

They all connect structure to behavior across different phases:

- compile-time typing and inference
- build-time transformation and generation
- runtime validation and normalization
- graph serialization and reasoning

### Extensibility

They all need controlled extension points:

- custom vocabularies or keywords
- transforms/codecs/deserializers
- custom constraints and validators
- domain-specific semantic annotations

## What Must Become Canonical

The project should not imitate each source system separately.

It should instead internalize the shared semantic core in one canonical graph.

That graph must be able to represent:

- value shapes
- entity/class shapes
- property entities
- datatype relations
- domain and range
- composition and conditional structures
- references and definitions
- constraint components
- annotations and provenance
- execution metadata
- serialization metadata

Everything else should be a view, compiler, serializer, or execution mode over that graph.

## End-State System Model

### Authored Source

The primary authored source remains JSON Schema-based.

That authored source may be enriched with project-owned metadata where needed, but JSON Schema remains the main user-facing authoring form.

### Canonical Backbone

The single source of truth is one graph-native representation.

That graph is:

- the compile-time semantic source
- the build-time generation source
- the runtime execution source
- the ontology and shape serialization source

### Derived Views

From that one graph, the system must be able to derive:

- TypeScript-compatible static types
- executable runtime validators
- normalization/materialization behavior
- JSON Schema serialization
- JSON-LD / RDF serialization
- SHACL serialization
- TBox and ABox graphs
- build-time generated artifacts

## Capability Targets

### TypeBox-Class Capabilities

The end goal must cover:

- ergonomic schema construction patterns
- first-class static typing from authored definitions
- runtime value operations and transforms
- schema-driven compilation/runtime helpers
- strong TypeScript authoring ergonomics without separate type duplication

### `json-schema-to-ts`-Class Capabilities

The end goal must cover:

- project-owned schema typing
- project-owned schema-to-TypeScript inference
- refs/definitions-aware inference
- composition-aware inference
- transform/deserialization-aware type output
- extension-aware inference

### TypeScript-Class Capabilities

The end goal must remain compatible with:

- structural typing
- unions and intersections
- generics
- conditional typing
- mapped/indexed access semantics
- literal inference
- narrowing and type guards
- template-literal-compatible key and string modeling

### JSON-LD-Class Capabilities

The end goal must cover:

- stable graph/node/property identifiers
- `@context`, `@id`, `@type`, `@graph`
- value objects, lists, sets, and language/datatype handling
- compaction/expansion/flattening/framing-compatible graph structure
- conversion to RDF-compatible output

### SHACL-Class Capabilities

The end goal must cover:

- node and property shapes
- targets
- datatype/class/node-kind constraints
- length, count, and range constraints
- logical constraint composition
- closed-world property restrictions
- qualified value constraints
- path-based constraints
- advanced or custom constraint expression hooks

### AJV-Class Capabilities

The end goal must cover:

- practical JSON Schema draft execution coverage
- vocabularies and draft-aware behavior
- refs, anchors, dynamic refs, and remote resolution models
- formats and strictness modes
- validator compilation and caching
- standalone or generated execution artifacts
- extensibility for custom keywords or equivalent semantic constraints

## Compile / Build / Runtime / Serialize

### Compile Time

The system must provide TypeScript-compatible typing from the same semantics used at runtime.

Long-term, this should be dependency-free and project-owned rather than delegated to a third-party schema-to-type engine.

### Build Time

The system must treat the canonical graph as a build artifact that can be:

- inspected
- transformed
- validated for consistency
- serialized into external artifacts
- used for codegen and documentation

### Runtime

The system must execute directly against the canonical graph for:

- validation
- normalization
- coercion
- materialization
- graph projection
- constraint reporting

### Serialization

The system must serialize from the canonical graph to:

- JSON Schema
- TypeScript type artifacts or declarations
- JSON-LD / RDF / N3
- SHACL

without inventing semantics late in the pipeline.

## Coverage Principle

The end goal is not “feature parity by name.”

The end goal is semantic coverage of the cases these systems can represent or execute.

When two systems expose the same underlying concept differently, `json-tology` should model the concept once in the canonical graph and provide the relevant authored, execution, and serialization surfaces from that one model.

## Long-Term Direction

To reach the target end-state, the project should converge on:

- one project-owned schema type model
- one project-owned schema/graph-to-TypeScript inference model
- one graph-native execution engine
- one graph-native materialization system
- one serialization layer that can emit JSON Schema, JSON-LD/RDF, SHACL, and TS-facing outputs

## Working Vocabulary

Use these terms consistently:

- **authored schema**: developer-written JSON Schema source
- **canonical graph**: the single internal semantic and runtime representation
- **translation**: producing the canonical graph from authored schema
- **inference**: deriving TypeScript-compatible types from canonical semantics
- **materialization**: projecting graph execution into JS values and ABox-like instance graphs
- **serialization**: emitting JSON Schema, JSON-LD/RDF, SHACL, or TS artifacts from canonical semantics

Avoid wording that implies multiple runtime semantic backbones.
