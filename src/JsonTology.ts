/**
 * JsonTology
 *
 * The primary entry point for json-tology.
 *
 * Declare your schemas once and get types, runtime validation, materialization,
 * and a data ontology for free — all from a single object.
 *
 * @example
 * const jt = new JsonTology({
 *   baseIRI: 'https://myapp.io',
 *   schemas: [UserSchema, OrderSchema],
 * });
 *
 * // Types (compile-time)
 * type User = Infer<typeof UserSchema>;
 *
 * // Validation
 * jt.validate(UserSchema.$id, data);
 * jt.parse(UserSchema, data);
 *
 * // Materialization
 * jt.materialize(UserSchema, { name: 'Alice' });
 *
 * // Ontology — derived automatically from registered schemas
 * jt.ontology().n3();
 * jt.ontology().jsonLd();
 */

import type {
  FromSchema, JSONSchema
} from 'json-schema-to-ts';
import {
  type RegistryOptions, SchemaRegistry
} from './schema/SchemaRegistry.js';
import { Materializer } from './schema/Materializer.js';
import { OntologyBuilder } from './ontology/OntologyBuilder.js';
import { GraphOntologySerializer } from './ontology/GraphOntologySerializer.js';
import type { ParseResult } from './schema/FailResult.js';
import type { ValidationErrors } from './schema/ValidationErrors.js';
import {
  type ParseOutput, Transform, type Transformed
} from './schema/Transform.js';
import type { JsonTologyOptions } from './interfaces/config.js';

export type { JsonTologyOptions } from './interfaces/config.js';

/**
 * Standard OWL/RDF/XSD prefixes included automatically in all ontology output.
 */
const DEFAULT_PREFIXES: Record<string, string> = {
  'jt': 'https://json-tology.dev/vocab#',
  'owl': 'http://www.w3.org/2002/07/owl#',
  'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
  'xsd': 'http://www.w3.org/2001/XMLSchema#'
};


/**
 * JsonTology — unified type system, validation, materialization, and ontology.
 */
export class JsonTology {
  private readonly baseIRI: string;
  public readonly materializer: Materializer;

  private readonly ontologySerializer: GraphOntologySerializer;
  private ontologyCache: null | OntologyBuilder = null;
  private readonly prefixes: Record<string, string>;
  public readonly registry: SchemaRegistry;

  public constructor(options: JsonTologyOptions) {
    let baseIRI = options.baseIRI;

    while (baseIRI.endsWith('/')) {
      baseIRI = baseIRI.slice(0, -1);
    }
    this.baseIRI = baseIRI;

    this.prefixes = {
      ...DEFAULT_PREFIXES,
      ...options.prefixes
    };

    const registryOptions: RegistryOptions = {
      ...(options.logger === undefined ? {} : { 'logger': options.logger }),
      ...(options.coerce === undefined ? {} : { 'coerce': options.coerce })
    };

    this.registry = new SchemaRegistry(registryOptions);
    this.materializer = new Materializer(this.registry, options.materializer);
    this.ontologySerializer = new GraphOntologySerializer();

    if (options.schemas && options.schemas.length > 0) {
      this.registry.register(options.schemas as Array<Record<string, unknown>>);
    }
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  /**
   * Materialize an entity instance with schema defaults applied.
   * Return type is inferred from the schema.
   */
  public materialize<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    partial?: Partial<FromSchema<TSchema>>,
  ): FromSchema<TSchema>;
  public materialize(
    schema: Record<string, unknown> & { '$id': string },
    partial?: Record<string, unknown>
  ): unknown {
    return (this.materializer.materialize as (s: typeof schema, p?: typeof partial) => unknown)(
      schema,
      partial
    );
  }

  public abox<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    data: unknown,
  ): OntologyBuilder;
  public abox(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): OntologyBuilder {
    const graph = this.materializer.projectAbox(schema, data, this.baseIRI);

    return new OntologyBuilder({
      'baseIRI': this.baseIRI,
      'graphSources': [graph],
      'prefixes': this.prefixes
    });
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * Encode a decoded value back to its wire representation using the schema's
   * encode function (set via transform()). If the schema has no transform,
   * the value is returned unchanged.
   *
   * @example
   * const wire = jt.encode(DateSchema, new Date('2024-01-01'));
   * // wire = '2024-01-01T00:00:00.000Z'
   */
  public encode<TSchema extends JSONSchema & { readonly '$id': string }, TOut>(
    schema: Transformed<TSchema, TOut>,
    value: TOut,
  ): FromSchema<TSchema>;
  public encode(
    schema: Record<string, unknown> & { '$id': string },
    value: unknown
  ): unknown {
    return Transform.getDecoder(schema)?.encode(value) ?? value;
  }

  /**
   * Validate data and return a ValidationErrors instance.
   * Provides .format(), .flatten(), .messages(), .length, and iteration.
   */
  public errors(schemaId: string, data: unknown): ValidationErrors {
    return this.registry.errors(schemaId, data);
  }

  /**
   * Get a registered schema by its $id.
   */
  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.registry.get(schemaId);
  }

  /**
   * Type guard — returns true if data satisfies the schema.
   */
  public is<T = unknown>(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): data is T {
    return this.registry.is<T>(schema, data);
  }

  /**
   * Generate ontology output derived automatically from all registered schemas.
   *
   * Returns an OntologyBuilder pre-populated with graph nodes for every
   * registered schema — no manual graph callbacks required.
   *
   * @example
   * jt.ontology().n3();
   * jt.ontology().jsonLd();
   * jt.ontology().jsonLdObject();
   */
  public ontology(): OntologyBuilder {
    if (!this.ontologyCache) {
      const graph = this.ontologySerializer.serialize(this.registry.listGraphs());

      this.ontologyCache = new OntologyBuilder({
        'baseIRI': this.baseIRI,
        'graphSources': [graph],
        'prefixes': this.prefixes
      });
    }

    return this.ontologyCache;
  }

  /**
   * Parse and validate data against a schema, applying defaults.
   * If the schema was wrapped with transform(), the decode function is applied
   * after validation and the decoded type is returned.
   * Throws ParseError on invalid data.
   */
  public parse<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    data: unknown,
  ): ParseOutput<TSchema>;
  public parse(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): unknown {
    return (this.registry.parse as (s: typeof schema, d: unknown) => unknown)(schema, data);
  }

  /**
   * Register one or more schemas. Returns `this` for fluent setup chaining.
   */
  public register(schema: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): this {
    this.registry.register(schema as Array<Record<string, unknown>> | Record<string, unknown>);
    this.ontologyCache = null;

    return this;
  }
  // ---------------------------------------------------------------------------
  // Building
  // ---------------------------------------------------------------------------

  /**
   * Parse and validate data, returning a discriminated union result.
   * Never throws. Return type is inferred from the schema.
   * If the schema was wrapped with withCatch(), returns the fallback on failure.
   */
  public safeParse<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    data: unknown,
  ): ParseResult<ParseOutput<TSchema>>;
  public safeParse(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): ParseResult<unknown> {
    return (this.registry.safeParse as (s: typeof schema, d: unknown) => ParseResult<unknown>)(
      schema,
      data
    );
  }

  // ---------------------------------------------------------------------------
  // Ontology
  // ---------------------------------------------------------------------------

  /**
   * Validate data against a registered schema.
   *
   * @returns Array of error strings (empty if valid)
   */
  public validate(schemaId: string, data: unknown): string[] {
    return this.registry.validate(schemaId, data);
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  /**
   * Validate data against a nested schema definition via JSON Pointer.
   *
   * @example jt.validateAt(BaseTypes.Schema.$id, '/$defs/Pagination', data)
   */
  public validateAt(schemaId: string, pointer: string, data: unknown): string[] {
    const errors = this.registry.validateAt(schemaId, pointer, data);

    return errors;
  }
}
