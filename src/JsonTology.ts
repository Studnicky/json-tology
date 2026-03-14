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
 * const user = jt.parse(UserSchema.$id, data); // typed as User
 * jt.validate(UserSchema.$id, data);
 * jt.ontology().jsonLd();
 */

import { GraphSchemaSerializer } from './modules/ontology/GraphSchemaSerializer.js';
import { quadsToJsonLdNodes } from './modules/rdf/Projection.js';

import type { JSONSchema7Definition as JSONSchemaType } from 'json-schema';
import type { InferSchemaType } from './types/infer.js';
import type {
  SchemaEntryType, SchemaMapFromTupleType
} from './interfaces/registry.js';
import { FormatRegistry } from './modules/format/FormatRegistry.js';
import type { RegistryOptionsInterface } from './interfaces/registry.js';
import type {
  ParseOutputType, TransformedType
} from './types/transform.js';
import type { ValidationErrors } from './errors/ValidationErrors.js';
import { SchemaRegistry } from './modules/registry/SchemaRegistry.js';
import { Materializer } from './modules/materialization/Materializer.js';
import { OntologyBuilder } from './modules/ontology/OntologyBuilder.js';
import { GraphOntologySerializer } from './modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from './modules/ontology/GraphShaclSerializer.js';
import { Transform } from './modules/transform/Transform.js';
import type { JsonTologyOptionsInterface } from './interfaces/config.js';


const DEFAULT_PREFIXES: Record<string, string> = {
  'jt': 'https://json-tology.dev/vocab#',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#'
};

/**
 * JsonTology — unified type system, validation, materialization, and ontology.
 *
 * @typeParam TMap — accumulated schema type map. Built automatically via
 * `create()` or chained `register()` calls.
 */
export class JsonTology<TMap = {}> {
  /**
   * Create a JsonTology instance with constructor-time schemas and full type inference.
   *
   * @example
   * const jt = JsonTology.create({
   *   baseIRI: 'https://myapp.io',
   *   schemas: [UserSchema, OrderSchema] as const,
   * });
   * const user = jt.parse(UserSchema.$id, data); // typed
   */
  public static create<const TSchemas extends ReadonlyArray<{ readonly '$id': string; }>>(options: JsonTologyOptionsInterface<TSchemas>): JsonTology<SchemaMapFromTupleType<TSchemas>> {
    const jt = new JsonTology(options);

    if (options.schemas && options.schemas.length > 0) {
      jt.registry.register(options.schemas as unknown as Array<Record<string, unknown>>);
    }

    return jt as unknown as JsonTology<SchemaMapFromTupleType<TSchemas>>;
  }
  private readonly baseIRI: string;

  public readonly materializer: Materializer;
  private ontologyCache: null | OntologyBuilder = null;
  private readonly ontologySerializer: GraphOntologySerializer;
  private readonly prefixes: Record<string, string>;
  public readonly registry: SchemaRegistry;

  private readonly shaclSerializer: GraphShaclSerializer;

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
      ...(options.logger === undefined ? {} : { 'logger': options.logger }),
      ...(options.coerce === undefined ? {} : { 'coerce': options.coerce }),
      ...(options.keywords === undefined ? {} : { 'keywords': options.keywords }),
      ...(options.strict === undefined ? {} : { 'strict': options.strict })
    };

    this.registry = new SchemaRegistry(registryOptions);
    this.materializer = new Materializer(this.registry, options.materializer);
    this.ontologySerializer = new GraphOntologySerializer();
    this.shaclSerializer = new GraphShaclSerializer();
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public abox<TSchema extends JSONSchemaType & { readonly '$id': string; }>(
    schema: TSchema,
    data: unknown
  ): OntologyBuilder {
    const quads = this.materializer.projectAbox(
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
  /**
   * Encode a decoded value back to its wire representation.
   */
  public encode<TSchema extends JSONSchemaType & { readonly '$id': string; }, TOut>(
    schema: TransformedType<TSchema, TOut>,
    value: TOut
  ): InferSchemaType<TSchema> {
    return (Transform.getDecoder(schema as object)?.encode(value) ?? value) as InferSchemaType<TSchema>;
  }
  /**
   * Validate data and return a ValidationErrors instance.
   */
  public errors<K extends keyof TMap & string>(schemaId: K, data: unknown): ValidationErrors;
  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  public errors(schema: Record<string, unknown> & { '$id': string; }, data: unknown): ValidationErrors;
  public errors(schema: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): ValidationErrors {
    return this.registry.errors(schema as string, data);
  }
  /**
   * Get a registered schema by its $id.
   */
  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.registry.get(schemaId);
  }

  /**
   * Check whether a schema with the given $id is registered.
   */
  public has(schemaId: string): boolean {
    return this.registry.get(schemaId) !== undefined;
  }
  /**
   * Type guard — returns true if data satisfies the schema.
   */
  public is<K extends keyof TMap & string>(schemaId: K, data: unknown): data is TMap[K];
  public is(schema: Record<string, unknown> & { '$id': string; }, data: unknown): boolean;
  public is(schema: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): boolean {
    return this.registry.is(schema as string, data);
  }
  /**
   * List all registered schema $id strings.
   */
  public list(): string[] {
    return this.registry.list().map((s) => {
      return s.$id as string;
    })
      .filter((id) => {
        return typeof id === 'string';
      });
  }
  /**
   * Materialize an entity instance with schema defaults applied.
   */
  public materialize<TSchema extends JSONSchemaType & { readonly '$id': string; }>(
    schema: TSchema,
    partial?: Partial<InferSchemaType<TSchema>>
  ): InferSchemaType<TSchema> {
    return (this.materializer.materialize as (s: typeof schema, p?: typeof partial) => InferSchemaType<TSchema>)(
      schema,
      partial
    );
  }

  /**
   * Generate ontology output derived automatically from all registered schemas.
   */
  public ontology(): OntologyBuilder {
    if (!this.ontologyCache) {
      const graph = this.ontologySerializer.serialize(this.registry.listGraphs());
      const shaclShapes = this.shaclSerializer.serialize(this.registry.listGraphs());

      this.ontologyCache = new OntologyBuilder({
        'baseIRI': this.baseIRI,
        'graphSources': [graph],
        'prefixes': this.prefixes
      });
      this.ontologyCache.addShacl(shaclShapes);
    }

    return this.ontologyCache;
  }
  /**
   * Parse and validate data against a registered schema, applying defaults.
   * Throws ParseError on invalid data.
   */
  public parse<K extends keyof TMap & string>(schemaId: K, data: unknown): TMap[K];
  public parse<TSchema extends JSONSchemaType & { readonly '$id': string; }>(
    schema: TSchema, data: unknown
  ): ParseOutputType<TSchema>;
  public parse(schema: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    return this.registry.parse(schema as string, data);
  }
  /**
   * Register one or more schemas. Returns `this` with schema types accumulated.
   */
  public register<const T extends { readonly '$id': string; }>(
    schema: T
  ): JsonTology<SchemaEntryType<T> & TMap>;
  public register<const T extends ReadonlyArray<{ readonly '$id': string; }>>(
    schemas: T
  ): JsonTology<SchemaMapFromTupleType<T> & TMap>;
  // ---------------------------------------------------------------------------
  // Materialization
  // ---------------------------------------------------------------------------
  public register(schemaOrSchemas: ReadonlyArray<{ readonly '$id': string; }> | { readonly '$id': string; }): JsonTology<TMap> {
    const list = Array.isArray(schemaOrSchemas) ? schemaOrSchemas : [schemaOrSchemas];

    this.registry.register(list as unknown as Array<Record<string, unknown>>);
    this.ontologyCache = null;

    return this as unknown as JsonTology<TMap>;
  }

  /**
   * Register a schema without an explicit $id. Returns the synthetic $id assigned.
   */
  public registerAnonymous(schema: Record<string, unknown>): string {
    return this.registry.registerAnonymous(schema);
  }

  // ---------------------------------------------------------------------------
  // Ontology
  // ---------------------------------------------------------------------------

  /**
   * Reconstruct a JSON Schema document from the canonical graph for a registered schema.
   */
  public toSchema(schemaId: string): Record<string, unknown> | undefined {
    const graph = this.registry.graph(schemaId);

    if (graph === undefined) {
      return undefined;
    }

    return new GraphSchemaSerializer().serialize(graph);
  }

  /**
   * Validate data against a registered schema.
   * @returns Array of error strings (empty if valid)
   */
  public validate<K extends keyof TMap & string>(schemaId: K, data: unknown): string[];
  public validate(schema: Record<string, unknown> & { '$id': string; }, data: unknown): string[];
  public validate(schema: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): string[] {
    return this.registry.validate(schema as string, data);
  }

  /**
   * Validate data against a nested schema definition via JSON Pointer.
   */
  public validateAt<K extends keyof TMap & string>(schemaId: K, pointer: string, data: unknown): string[];
  public validateAt(schema: Record<string, unknown> & { '$id': string; }, pointer: string, data: unknown): string[];
  public validateAt(schema: (Record<string, unknown> & { '$id': string; }) | string, pointer: string, data: unknown): string[] {
    return this.registry.validateAt(schema as string, pointer, data);
  }
}
