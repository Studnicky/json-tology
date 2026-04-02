/**
 * JsonTology
 *
 * Declare your schemas once and get types, runtime validation, materialization,
 * and a data ontology for free — all from a single object.
 *
 * @example
 * const jt = JsonTology.create({
 *   baseIRI: 'https://myapp.io',
 *   schemas: [UserSchema, OrderSchema] as const,
 * });
 *
 * type User = InferType<typeof UserSchema>;
 *
 * const user = jt.coerce(UserSchema.$id, data); // typed as User
 * jt.validate(UserSchema.$id, data);
 * jt.ontology().jsonLd();
 */

import { GraphSchemaSerializer } from './modules/ontology/graphSchemaSerializer.js';
import { quadsToJsonLdNodes } from './modules/rdf/Projection.js';
import { liftInstances } from './modules/rdf/Lift.js';
import type { QuadInterface } from './interfaces/Quad.js';

import type { JSONSchema7Definition } from 'json-schema';
import type {
  InferSchemaType, MaterializedSchemaType, SchemaPointerPathsType
} from './types/Infer.js';
import type {
  SchemaEntryType, SchemaMapFromTupleType, UniqueSchemaIdsType
} from './types/Registry.js';
import { FormatRegistry } from './modules/format/FormatRegistry.js';
import type { MaterializerInterface } from './interfaces/MaterializerImpl.js';
import type { RegistryOptionsInterface } from './interfaces/Registry.js';
import type { SchemaRegistryInterface } from './interfaces/SchemaRegistry.js';
import type {
  ParseOutputType, TransformedType
} from './types/Transform.js';
import type { ValidationErrors } from './errors/ValidationErrors.js';
import type { ValueInterface } from './interfaces/ValueImpl.js';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { Materializer } from './modules/materialization/materializer.js';
import { Value } from './modules/data/value.js';
import { OntologyBuilder } from './modules/ontology/ontologyBuilder.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { Transform } from './modules/transform/transform.js';
import type { JsonTologyOptionsInterface } from './interfaces/Config.js';
import { DEFAULT_PREFIXES } from './constants/PREFIXES.js';
import { Curie } from './modules/rdf/curie.js';
import { SchemaError } from './errors/SchemaError.js';

/**
 * JsonTology — unified type system, validation, materialization, and ontology.
 *
 * @typeParam TMap — accumulated schema type map. Built automatically via
 * `create()` or chained `register()` calls.
 */
export class JsonTology<TMap = Record<never, never>> {
  /**
   * Creates a {@link JsonTology} instance with constructor-time schemas and full type inference.
   *
   * @param options - Configuration including `baseIRI`, optional `schemas`, prefixes, format validators, and more.
   * @returns A fully configured instance with all provided schemas registered.
   */
  public static create<const TSchemas extends ReadonlyArray<{ readonly '$id': string; }>>(options: JsonTologyOptionsInterface<TSchemas> & { 'schemas'?: UniqueSchemaIdsType<TSchemas> }): JsonTology<SchemaMapFromTupleType<TSchemas>> {
    const jt = new JsonTology(options);

    if (options.schemas && options.schemas.length > 0) {
      // Cast needed: const generic TSchemas preserves literal types that don't widen to Record<string, unknown>
      jt.registry.register(options.schemas as unknown as Array<Record<string, unknown>>);
    }

    // Cast needed: narrows default TMap to the inferred schema map computed from TSchemas
    return jt as unknown as JsonTology<SchemaMapFromTupleType<TSchemas>>;
  }
  private readonly baseIRI: string;

  public readonly materializer: MaterializerInterface;
  private ontologyCache: null | OntologyBuilder = null;
  private readonly ontologySerializer: GraphOntologySerializer;
  private readonly prefixes: Record<string, string>;
  /**
   * Direct access to the underlying schema registry for advanced use cases.
   *
   * Provides access to `engine()` for direct GraphEngine execution with custom
   * options, `graph()` for schema graph introspection, `validator()` for embedding
   * compiled validators in middleware, and `listGraphs()` for custom ontology tooling.
   *
   * Most consumers should use the facade methods (validate, coerce, errors, etc.)
   * instead of accessing the registry directly.
   */
  public readonly registry: SchemaRegistryInterface;

  private readonly shaclSerializer: GraphShaclSerializer;

  /**
   * Value operations — schema-aware (instance: cast, clean, coerce, convert, create)
   * and pure (static: clone, diff, hash, applyOp).
   */
  public readonly value: ValueInterface<TMap>;

  /**
   * Constructs a new {@link JsonTology} instance (use {@link JsonTology.create} for the public API).
   *
   * @param options - Configuration including `baseIRI`, prefixes, format validators, castTypes, strict, and logger.
   */
  private constructor(options: JsonTologyOptionsInterface) {
    let baseIRI = options.baseIRI;

    while (baseIRI.endsWith('/')) {
      baseIRI = baseIRI.slice(0, -1);
    }
    this.baseIRI = baseIRI;

    this.prefixes = {
      ...DEFAULT_PREFIXES,
      ...options.prefixes
    };

    const formatRegistry = FormatRegistry.builtin();

    if (options.formats) {
      for (const [
        name,
        validator
      ] of Object.entries(options.formats)) {
        formatRegistry.register(name, validator);
      }
    }

    const registryOptions: RegistryOptionsInterface = {
      'formatRegistry': formatRegistry,
      'prefixes': this.prefixes,
      ...(options.logger === undefined ? {} : { 'logger': options.logger }),
      ...(options.castTypes === undefined ? {} : { 'castTypes': options.castTypes }),
      ...(options.keywords === undefined ? {} : { 'keywords': options.keywords }),
      ...(options.strict === undefined ? {} : { 'strict': options.strict }),
      ...(options.vocabularies === undefined ? {} : { 'vocabularies': options.vocabularies }),
      ...(options.maxDepth === undefined ? {} : { 'maxDepth': options.maxDepth })
    };

    this.registry = new SchemaRegistry(registryOptions);
    // Cast needed: Value is unparameterized at runtime; aligns with compile-time generic TMap
    this.value = new Value(this.registry) as unknown as ValueInterface<TMap>;
    this.materializer = new Materializer(this.registry, options.materializer);

    // Create Curie with merged prefixes from registry
    const curie = this.registry.curie ?? new Curie(this.prefixes);
    const vocabularies = options.vocabularies ?? [];

    this.ontologySerializer = new GraphOntologySerializer(curie, vocabularies);
    this.shaclSerializer = new GraphShaclSerializer(curie, vocabularies);
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Validates data against a registered schema, applying defaults and stripping unknown properties.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to coerce (deep-cloned before mutation).
   * @returns The validated and normalized value.
   * @throws {@link CoercionError} when the data fails validation.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public coerce<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K];
  public coerce<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema, data: unknown
  ): ParseOutputType<TSchema>;
  public coerce(schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }), data: unknown): unknown {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    return this.registry.coerce(typeof schema === 'string' ? schema : schema.$id, data);
  }
  /**
   * Encodes a decoded value back to its wire representation using the schema's registered {@link Transform}.
   *
   * @param schema - The schema with an associated transform decoder.
   * @param value - The decoded value to encode.
   * @returns The wire-format representation inferred from the schema.
   */
  public encode<TSchema extends JSONSchema7Definition & { readonly '$id': string; }, TOut extends unknown>(
    schema: TransformedType<TSchema, TOut>,
    value: TOut
  ): InferSchemaType<TSchema> {
    return (Transform.getDecoder(schema as object)?.encode(value) ?? value) as InferSchemaType<TSchema>;
  }
  /**
   * Validates data and returns structured {@link ValidationErrors}.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to validate.
   * @returns A {@link ValidationErrors} instance (empty when data is valid).
   */
  public errors<K extends keyof TMap & string>(schemaId: K, data: unknown): ValidationErrors;
  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  public errors(schema: Record<string, unknown> & { '$id': string; }, data: unknown): ValidationErrors;
  public errors(schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }), data: unknown): ValidationErrors {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    return this.registry.errors(typeof schema === 'string' ? schema : schema.$id, data);
  }
  /**
   * Lifts RDF quads back into typed JS objects.
   *
   * Inverse of {@link toQuads}: given quads produced by projection, a reasoning
   * engine, or any RDF source, recovers plain JS objects matching the target schema.
   * Each returned object is validated through {@link coerce} to apply defaults,
   * transforms, and type safety.
   *
   * @param schemaId - The `$id` of a registered schema to reconstruct.
   * @param quads - RDF quads in the module's internal format.
   * @returns Array of validated, typed objects.
   */
  public fromQuads<K extends keyof TMap & string>(schemaId: K, quads: QuadInterface[]): Array<TMap[K]>;
  public fromQuads(schemaId: string, quads: QuadInterface[]): unknown[];
  public fromQuads(schemaId: string, quads: QuadInterface[]): unknown[] {
    const raw = liftInstances(schemaId, quads, this.registry);

    return raw.map((instance) => {
      return this.registry.coerce(schemaId, instance);
    });
  }
  /**
   * Retrieves a registered schema by its `$id`.
   *
   * @param schemaId - The `$id` of the schema to look up.
   * @returns The schema object, or `undefined` if not registered.
   */
  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.registry.get(schemaId);
  }
  /**
   * Checks whether a schema with the given `$id` is registered.
   *
   * @param schemaId - The `$id` to look up.
   * @returns `true` if a schema with that ID exists in the registry.
   */
  public has(schemaId: string): boolean {
    return this.registry.get(schemaId) !== undefined;
  }

  /**
   * Type guard that returns `true` if data satisfies the schema.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to check.
   * @returns Whether the data conforms to the schema.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public is<K extends keyof TMap & string>(schemaId: K, data: unknown): data is TMap[K];
  public is(schema: Record<string, unknown> & { '$id': string; }, data: unknown): boolean;
  public is(schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }), data: unknown): boolean {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    return this.registry.is(typeof schema === 'string' ? schema : schema.$id, data);
  }
  /**
   * Lists the `$id` of every registered schema.
   *
   * @returns Array of registered schema ID strings.
   */
  public list(): string[] {
    return this.registry.list()
      .map((schema) => {
        return schema.$id as string;
      })
      .filter((id) => {
        return typeof id === 'string';
      });
  }
  /**
   * Materializes an entity instance with schema defaults applied, optionally merging partial input.
   *
   * @param schema - The schema describing the target shape.
   * @param partial - Optional partial data to merge with schema defaults.
   * @returns A fully materialized instance with all defaults populated.
   */
  public materialize<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    partial?: Partial<InferSchemaType<TSchema>>
  ): MaterializedSchemaType<TSchema> {
    return (this.materializer.materialize as (s: typeof schema, p?: typeof partial) => MaterializedSchemaType<TSchema>)(
      schema,
      partial
    );
  }
  /**
   * Generates ontology output (OWL + SHACL) derived from all registered schemas.
   *
   * @returns An {@link OntologyBuilder} for further serialization (JSON-LD, Turtle, etc.).
   */
  public ontology(): OntologyBuilder {
    if (this.ontologyCache) {
      return this.ontologyCache;
    }

    const graph = this.ontologySerializer.serialize(this.registry.listGraphs());
    const shaclShapes = this.shaclSerializer.serialize(this.registry.listGraphs());

    this.ontologyCache = new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'graphSources': [graph],
      'prefixes': this.prefixes
    });
    this.ontologyCache.addShacl(shaclShapes);

    return this.ontologyCache;
  }

  /**
   * Registers one or more schemas and returns `this` with the schema types accumulated.
   *
   * @param schema - A single schema or array of schemas, each with a `$id`.
   * @returns This instance with the new schema types merged into `TMap`.
   * @throws {@link SchemaError} when a schema lacks `$id`, has duplicate anchors, or fails structure validation.
   */
  public register<const T extends { readonly '$id': string; }>(
    schema: T
  ): JsonTology<SchemaEntryType<T> & TMap>;
  public register<const T extends ReadonlyArray<{ readonly '$id': string; }>>(
    schemas: T & UniqueSchemaIdsType<T>
  ): JsonTology<SchemaMapFromTupleType<T> & TMap>;
  // ---------------------------------------------------------------------------
  // Materialization
  // ---------------------------------------------------------------------------
  public register(schemaOrSchemas: ReadonlyArray<{ readonly '$id': string; }> | { readonly '$id': string; }): JsonTology<TMap> {
    const list = Array.isArray(schemaOrSchemas) ? schemaOrSchemas : [schemaOrSchemas];

    // Cast needed: const generic preserves literal types that don't widen to Record<string, unknown>
    this.registry.register(list as unknown as Array<Record<string, unknown>>);
    this.ontologyCache = null;

    // Cast needed: TypeScript cannot track that register() accumulates into the TMap type parameter
    return this as unknown as JsonTology<TMap>;
  }
  /**
   * Registers a schema that may lack a `$id`, assigning a content-hash-based synthetic ID if needed.
   *
   * @param schema - The schema object; if it already has a `$id`, delegates to {@link register}.
   * @returns The `$id` used for registration (original or synthetic).
   */
  public registerAnonymous(schema: Record<string, unknown>): string {
    return this.registry.registerAnonymous(schema);
  }

  /**
   * Projects instance data to RDF quads and returns an {@link OntologyBuilder} for serialization.
   *
   * Inverse of {@link fromQuads}: `toQuads` lowers typed objects into ABox quads,
   * `fromQuads` lifts quads back into typed objects.
   *
   * @param schema - The schema describing the data shape.
   * @param data - The instance data to project into quads.
   * @returns An {@link OntologyBuilder} containing the projected nodes.
   */
  public toQuads<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    data: InferSchemaType<TSchema>
  ): OntologyBuilder {
    const quads = this.materializer.projectAbox(
      // Cast needed: JSONSchema7Definition includes boolean; runtime guarantees object with $id
      schema as unknown as Record<string, unknown> & { '$id': string; },
      data,
      this.baseIRI
    );
    const nodes = quadsToJsonLdNodes(quads);

    return new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'graphSources': [nodes],
      'prefixes': this.prefixes
    });
  }

  // ---------------------------------------------------------------------------
  // Ontology
  // ---------------------------------------------------------------------------

  /**
   * Reconstructs a JSON Schema document from the canonical graph for a registered schema.
   *
   * @param schemaId - The `$id` of the schema.
   * @returns The reconstructed schema object, or `undefined` if not registered.
   */
  public toSchema(schemaId: string): Record<string, unknown> | undefined {
    const graph = this.registry.graph(schemaId);

    if (graph === undefined) {
      return undefined;
    }

    return new GraphSchemaSerializer().serialize(graph);
  }

  /**
   * Validates data against a registered schema and returns human-readable error messages.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param data - The data to validate.
   * @returns Array of human-readable error strings, empty if valid.
   */
  public validate<K extends keyof TMap & string>(schemaId: K, data: unknown): string[];
  public validate(schema: Record<string, unknown> & { '$id': string; }, data: unknown): string[];
  public validate(schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }), data: unknown): string[] {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    return this.registry.validate(typeof schema === 'string' ? schema : schema.$id, data);
  }

  /**
   * Validates data against a sub-schema identified by a JSON Pointer within a registered schema.
   *
   * @param schemaId - The `$id` of a registered schema, or a schema object with `$id`.
   * @param pointer - JSON Pointer path (e.g. `/properties/name`) into the schema.
   * @param data - The data to validate against the sub-schema.
   * @returns Array of human-readable error strings, empty if valid.
   */
  public validateAt<K extends keyof TMap & string>(schemaId: K, pointer: string, data: unknown): string[];
  public validateAt<TSchema extends JSONSchema7Definition & { readonly '$id': string; }>(
    schema: TSchema,
    pointer: (Record<never, never> & string) | SchemaPointerPathsType<TSchema>,
    data: unknown
  ): string[];
  public validateAt(schema: Record<string, unknown> & { '$id': string; }, pointer: string, data: unknown): string[];
  public validateAt(schema: (keyof TMap & string) | (Record<string, unknown> & { '$id': string; }), pointer: string, data: unknown): string[] {
    if ((schema as unknown) === null || (schema as unknown) === undefined) {
      throw new SchemaError('SCHEMA_INVALID_INPUT', 'schema must not be null or undefined');
    }

    const schemaId = typeof schema === 'string' ? schema : schema.$id;
    const validationResult = this.registry.validateAt(schemaId, pointer, data);

    return validationResult;
  }
}
