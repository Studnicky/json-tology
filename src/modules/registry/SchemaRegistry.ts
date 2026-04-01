/**
 * Schema Registry
 *
 * Single in-repo graph engine shared by validation, parsing, materialization, and
 * pointer-based sub-schema execution.
 */

import { BaseError } from '../../errors/BaseError.js';
import { CoercionError } from '../../errors/CoercionError.js';
import { SchemaError } from '../../errors/SchemaError.js';
import { ValidationErrors } from '../../errors/ValidationErrors.js';
import { Transform } from '../transform/transform.js';
import type { CompiledValidatorInterface } from '../../interfaces/Compiler.js';
import type { FormatRegistryInterface } from '../../interfaces/FormatRegistry.js';
import type { KeywordDefinitionInterface } from '../../interfaces/GraphEngine.js';
import type { GraphEngineInterface } from '../../interfaces/GraphEngineImpl.js';
import type { SchemaCompilerInterface } from '../../interfaces/SchemaCompilerImpl.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import { GraphEngine } from '../graph/graphEngine.js';
import { Hash } from '../hash/hash.js';
import { Materializer } from '../materialization/materializer.js';
import { SchemaGraph } from '../graph/schemaGraph.js';
import { SchemaCompiler } from '../validation/schemaCompiler.js';
import type { LoggerInterface } from '../../interfaces/Logger.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { VocabularyPluginInterface } from '../../interfaces/VocabularyPlugin.js';
import type { RegistryOptionsInterface } from '../../interfaces/Registry.js';
import type { SchemaRegistryInterface } from '../../interfaces/SchemaRegistry.js';
import { Curie } from '../rdf/curie.js';
import { DEFAULT_PREFIXES } from '../../constants/PREFIXES.js';
import { SILENT_LOGGER } from '../../constants/LOGGER.js';
import {
  CURRENT_DIALECT_PREFIX, DRAFT_NAME
} from '../../constants/DIALECT.js';


const EMPTY_ERROR_LIST: string[] = Object.freeze([]) as unknown as string[];
const EMPTY_VALIDATION_ERRORS = new ValidationErrors([]);

const CAST_OPTIONS = Object.freeze({
  'applyDefaults': true,
  'castTypes': true,
  'collectErrors': false
});
const CLEAN_OPTIONS = Object.freeze({
  'collectErrors': false,
  'enforceSchemaProperties': true
});
const CONVERT_OPTIONS = Object.freeze({
  'castTypes': true,
  'collectErrors': false
});
const COLLECT_ERRORS_OPTIONS = Object.freeze({ 'collectErrors': true });

import type { SchemaRegistryEntryInterface } from '../../interfaces/SchemaRegistryEntry.js';

export class SchemaRegistry implements SchemaRegistryInterface {
  public readonly castTypes: boolean;
  private readonly coerceOptions: Readonly<Record<string, boolean>>;
  private readonly compiler: SchemaCompilerInterface;

  public readonly curie: CurieInterface | undefined;
  private readonly formatRegistry: FormatRegistryInterface | undefined;
  private readonly keywords: KeywordDefinitionInterface[] | undefined;
  private readonly logger: LoggerInterface;
  private readonly schemaHashes = new Map<string, string>();
  private readonly schemas = new Map<string, SchemaRegistryEntryInterface>();
  private readonly strict: boolean;
  private readonly vocabularies: readonly VocabularyPluginInterface[];

  /**
   * Constructs a new {@link SchemaRegistry} with optional configuration.
   *
   * @param options - Registry configuration including castTypes, strict, format registry, keywords, logger, and vocabularies.
   */
  public constructor(options?: RegistryOptionsInterface) {
    this.logger = options?.logger ?? SILENT_LOGGER;
    this.castTypes = options?.castTypes ?? false;
    this.coerceOptions = Object.freeze({
      'applyDefaults': true,
      'castTypes': this.castTypes,
      'collectErrors': true,
      'removeAdditionalProperties': true
    });
    this.strict = options?.strict ?? false;
    this.vocabularies = options?.vocabularies ?? [];

    // Merge plugin prefixes with user prefixes
    const mergedPrefixes = { ...DEFAULT_PREFIXES };

    for (const plugin of this.vocabularies) {
      Object.assign(mergedPrefixes, plugin.prefixes);
    }
    if (options?.prefixes) {
      Object.assign(mergedPrefixes, options.prefixes);
    }

    this.curie = Object.keys(mergedPrefixes).length > 0 ? new Curie(mergedPrefixes) : undefined;
    this.formatRegistry = options?.formatRegistry;
    this.keywords = options?.keywords;
    this.compiler = new SchemaCompiler({
      'lookupCompiled': (schemaId) => {
        return this.schemas.has(schemaId)
          ? this.compiled(schemaId)
          : undefined;
      }
    });
  }

  /**
   * Validates data with type coercion and default application, returning the coerced value.
   *
   * @param schemaOrId - Schema object with `$id` or the schema ID string.
   * @param data - The data to cast (deep-cloned before mutation).
   * @returns The coerced and default-applied value.
   */
  public cast(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.validate(structuredClone(data), CAST_OPTIONS).value;
  }

  /**
   * Validates data and strips unknown properties, returning the cleaned value.
   *
   * @param schemaOrId - Schema object with `$id` or the schema ID string.
   * @param data - The data to clean (deep-cloned before mutation).
   * @returns The value with unknown properties removed.
   */
  public clean(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.validate(structuredClone(data), CLEAN_OPTIONS).value;
  }

  /**
   * Coerces and validates data against a registered schema, applying defaults and stripping unknown properties.
   *
   * @param schema - Schema object with `$id` or the schema ID string.
   * @param data - The data to coerce (deep-cloned before mutation).
   * @returns The validated and normalized value, optionally decoded by a registered {@link Transform}.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   * @throws {@link CoercionError} when the data fails validation.
   */
  public coerce(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): unknown {
    const entry = typeof schema === 'string'
      ? this.schemas.get(this.resolve(schema))
      : this.schemas.get(schema.$id);

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${String(typeof schema === 'string' ? schema : schema.$id)}. Call register() first.`);
    }

    const compiled = this.compiledFromEntry(entry);
    const result = compiled.validate(structuredClone(data), this.coerceOptions);

    if (!result.valid) {
      throw new CoercionError(new ValidationErrors(result.errors));
    }

    const schemaObj = typeof schema === 'string' ? entry.schema : schema;
    const decoder = Transform.getDecoder(schemaObj);

    return decoder === undefined ? result.value : decoder.decode(result.value);
  }

  private collectAnchors(schema: Record<string, unknown>, seen: Set<string>, schemaId: string): void {
    if (typeof schema.$anchor === 'string') {
      if (seen.has(schema.$anchor)) {
        throw new SchemaError(
          'SCHEMA_DUPLICATE_ANCHOR',
          `Duplicate $anchor "${schema.$anchor}" in schema "${schemaId}"`,
          schemaId
        );
      }
      seen.add(schema.$anchor);
    }
    if (typeof schema.$dynamicAnchor === 'string') {
      if (seen.has(schema.$dynamicAnchor)) {
        throw new SchemaError(
          'SCHEMA_DUPLICATE_ANCHOR',
          `Duplicate $dynamicAnchor "${schema.$dynamicAnchor}" in schema "${schemaId}"`,
          schemaId
        );
      }
      seen.add(schema.$dynamicAnchor);
    }

    for (const value of Object.values(schema)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        this.collectAnchors(value as Record<string, unknown>, seen, schemaId);
      }
    }
  }

  private compiled(schemaId: string): CompiledValidatorInterface | undefined {
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    return this.compiledFromEntry(entry);
  }

  private compiledFromEntry(entry: SchemaRegistryEntryInterface): CompiledValidatorInterface {
    if (entry.compiled === undefined) {
      const engine = this.engine(entry.schema);

      entry.compiled = this.compiler.compile(engine);
    }

    return entry.compiled;
  }

  /**
   * Validates data with type coercion only (no defaults), returning the coerced value.
   *
   * @param schemaOrId - Schema object with `$id` or the schema ID string.
   * @param data - The data to convert (deep-cloned before mutation).
   * @returns The coerced value.
   */
  public convert(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string, data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.validate(structuredClone(data), CONVERT_OPTIONS).value;
  }

  /**
   * Creates a default instance of the schema by materializing all declared defaults.
   *
   * @param schemaId - The `$id` of a registered schema.
   * @returns A new object populated with schema defaults.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public create(schemaId: string): unknown {
    const entry = this.schemas.get(this.resolve(schemaId));

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No schema registered for: ${schemaId}`, schemaId);
    }

    const materializer = new Materializer(this);

    return materializer.createDefault(entry.schema as Record<string, unknown> & { '$id': string });
  }

  /**
   * Returns the {@link GraphEngine} for a registered schema, creating it on first access.
   *
   * @param schema - Schema object whose `$id` identifies the registered entry.
   * @returns The lazily-initialized graph engine for the schema.
   * @throws {@link SchemaError} when no schema is registered for the given `$id`.
   */
  public engine(schema: Record<string, unknown>): GraphEngineInterface {
    const schemaId = schema.$id as string;
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      throw new SchemaError('SCHEMA_VALIDATOR_MISSING', `No validator registered for schema: ${schemaId}`, schemaId);
    }
    entry.engine ??= new GraphEngine(entry.schema, {
      ...(this.formatRegistry ? { 'formatRegistry': this.formatRegistry } : {}),
      ...(this.keywords && this.keywords.length > 0 ? { 'keywords': this.keywords } : {}),
      'lookupSchema': (lookupSchemaId) => {
        return this.schemas.get(lookupSchemaId)?.schema;
      }
    });

    return entry.engine;
  }

  /**
   * Validates data and returns structured {@link ValidationErrors}.
   *
   * @param schema - Schema object with `$id` or the schema ID string.
   * @param data - The data to validate.
   * @returns A {@link ValidationErrors} instance (empty when data is valid).
   */
  public errors(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): ValidationErrors {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      return new ValidationErrors([{
        'keyword': 'unknown',
        'message': `No validator registered for schema: ${schemaId}`,
        'params': {},
        'path': ''
      }]);
    }

    const result = compiled.validate(data, COLLECT_ERRORS_OPTIONS);

    return result.errors.length === 0 ? EMPTY_VALIDATION_ERRORS : new ValidationErrors(result.errors);
  }

  private execute(
    schema: Record<string, unknown>,
    data: unknown,
    options: {
      'applyDefaults': boolean;
      'castTypes': boolean;
      'collectErrors': boolean;
      'removeAdditionalProperties': boolean;
    },
    pointer = ''
  ) {
    const engine = this.engine(schema);

    return engine.execute(data, pointer, options);
  }

  /**
   * Retrieves a registered schema by its `$id`.
   *
   * @param schemaId - The `$id` of the schema to look up.
   * @returns The schema object, or `undefined` if not registered.
   */
  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.schemas.get(this.resolve(schemaId))?.schema;
  }

  /**
   * Returns the canonical {@link SchemaGraph} for a registered schema.
   *
   * @param schemaId - The `$id` of the schema.
   * @returns The schema graph, or `undefined` if the schema is not registered.
   */
  public graph(schemaId: string): SchemaGraphInterface | undefined {
    const entry = this.schemas.get(this.resolve(schemaId));

    if (entry === undefined) {
      return undefined;
    }

    return this.graphOf(entry);
  }

  private graphOf(entry: SchemaRegistryEntryInterface): SchemaGraphInterface {
    entry.graph ??= new SchemaGraph(entry.schema, this.vocabularies);

    return entry.graph;
  }

  private hashSchema(schema: Record<string, unknown>): string {
    const {
      '$id': _, ...rest
    } = schema;

    return Hash.value(rest);
  }

  /**
   * Returns `true` if data satisfies the schema, `false` otherwise.
   *
   * @param schema - Schema object with `$id` or the schema ID string.
   * @param data - The data to check.
   * @returns Whether the data conforms to the schema.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public is(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): boolean {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `Schema not registered: ${schemaId}. Call register() first.`, schemaId);
    }

    return compiled.check(data);
  }

  /**
   * Lists all registered schema objects.
   *
   * @returns An array of all registered schema objects.
   */
  public list(): ReadonlyArray<Record<string, unknown>> {
    return [...this.schemas.values()].map((entry) => {
      return entry.schema;
    });
  }

  /**
   * Lists the canonical {@link SchemaGraph} for every registered schema.
   *
   * @returns An array of schema graphs, one per registered schema.
   */
  public listGraphs(): readonly SchemaGraphInterface[] {
    return [...this.schemas.values()].map((entry) => {
      return this.graphOf(entry);
    });
  }

  /**
   * Registers one or more schemas, validating structure and anchor uniqueness.
   *
   * @param schemas - A single schema object or an array of schema objects, each requiring a `$id`.
   * @throws {@link SchemaError} when a schema lacks `$id`, has duplicate anchors, or fails structure validation.
   */
  public register(schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>): void {
    const list: ReadonlyArray<Record<string, unknown>> = Array.isArray(schemas) ? schemas : [schemas];

    for (const element of list) {
      this.registerSingle(element);
    }
  }

  /**
   * Registers a schema that may lack a `$id`, assigning a content-hash-based synthetic ID if needed.
   *
   * @param schema - The schema object; if it already has a `$id`, delegates to {@link register}.
   * @returns The `$id` used for registration (original or synthetic).
   */
  public registerAnonymous(schema: Record<string, unknown>): string {
    if (typeof schema.$id === 'string' && schema.$id !== '') {
      this.register(schema);

      return schema.$id;
    }

    const hash = this.hashSchema(schema);
    const syntheticId = `urn:json-tology:hash:${hash}`;
    const withId = {
      ...schema,
      '$id': syntheticId
    };

    this.register(withId);

    return syntheticId;
  }


  private registerSingle(schema: Record<string, unknown>): void {
    const schemaId = schema.$id as string | undefined;

    if (schemaId === undefined || schemaId === '') {
      throw new SchemaError('SCHEMA_MISSING_ID', 'Schema must have a $id property');
    }

    if (this.strict && typeof schema.$schema === 'string' && !schema.$schema.startsWith(CURRENT_DIALECT_PREFIX)) {
      throw new SchemaError(
        'SCHEMA_DIALECT_UNSUPPORTED',
        `Strict mode requires draft ${DRAFT_NAME} but schema "${schemaId}" declares "${schema.$schema}"`,
        schemaId
      );
    }

    // Validate anchor uniqueness within the schema
    if (typeof schema === 'object') {
      const anchors = new Set<string>();

      this.collectAnchors(schema, anchors, schemaId);
    }

    const hash = this.hashSchema(schema);

    if (this.schemas.has(schemaId)) {
      const existing = this.schemas.get(schemaId);

      if (existing === undefined) {
        return;
      }

      if (existing.hash === hash) {
        // Same content — preserve any transform decoder from the new object
        const hasNewDecoder = Transform.getDecoder(schema) !== undefined;
        const lacksExistingDecoder = Transform.getDecoder(existing.schema) === undefined;

        if (existing.schema !== schema && hasNewDecoder && lacksExistingDecoder) {
          existing.schema = schema;
        }
        this.logger.trace(`Schema already registered (identical): ${schemaId}`);

        return;
      }
      throw new SchemaError(
        'SCHEMA_DUPLICATE_ID',
        `Schema "${schemaId}" is already registered with different content. Unregister first or use the same schema object.`,
        schemaId
      );
    }

    const existingId = this.schemaHashes.get(hash);

    if (existingId !== undefined && existingId !== schemaId) {
      this.logger.warn(`Schema content already registered under different ID: existing="${existingId}" new="${schemaId}"`);
    }

    // Validate structure BEFORE committing to maps — failed registration must be a no-op
    const entry: SchemaRegistryEntryInterface = {
      hash,
      schema
    };
    const graph = this.graphOf(entry);
    const warnings = graph.validateStructure();

    if (warnings.length > 0) {
      throw new SchemaError(
        'SCHEMA_STRUCTURE_INVALID',
        `Structure validation failed for schema "${schemaId}": ${warnings.map((warning) => {
          return warning.message;
        }).join('; ')}`,
        schemaId
      );
    }

    this.schemas.set(schemaId, entry);
    this.schemaHashes.set(hash, schemaId);
    this.logger.trace(`Schema registered: ${schemaId}`);
  }

  private resolve(schemaId: string): string {
    if (this.curie === undefined) {
      return schemaId;
    }

    return this.curie.expand(schemaId);
  }

  private resolveSchemaId(schemaOrId: (Record<string, unknown> & { '$id': string; }) | string): string {
    const raw = typeof schemaOrId === 'string' ? schemaOrId : schemaOrId.$id;

    return this.resolve(raw);
  }

  /**
   * Validates data against a registered schema and returns human-readable error messages.
   *
   * @param schema - Schema object with `$id` or the schema ID string.
   * @param data - The data to validate.
   * @returns Array of human-readable error strings, empty if valid.
   */
  public validate(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    data: unknown
  ): string[] {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      return [`No validator registered for schema: ${schemaId}`];
    }

    if (compiled.compiled && compiled.check(data)) {
      return EMPTY_ERROR_LIST;
    }

    const result = compiled.validate(data, COLLECT_ERRORS_OPTIONS);

    if (result.errors.length === 0) {
      return EMPTY_ERROR_LIST;
    }

    return BaseError.formatErrors(result.errors);
  }

  /**
   * Validates data against a sub-schema identified by a JSON Pointer within a registered schema.
   *
   * @param schema - Schema object with `$id` or the schema ID string.
   * @param pointer - JSON Pointer path (e.g. `/properties/name`) into the schema.
   * @param data - The data to validate against the sub-schema.
   * @returns Array of human-readable error strings, empty if valid.
   */
  public validateAt(
    schema: (Record<string, unknown> & { '$id': string; }) | string,
    pointer: string,
    data: unknown
  ): string[] {
    const schemaId = typeof schema === 'string' ? this.resolve(schema) : schema.$id;
    const entry = this.schemas.get(schemaId);

    if (!entry) {
      return [`No schema registered for: ${schemaId}`];
    }

    try {
      const errors = this.execute(entry.schema, data, {
        'applyDefaults': false,
        'castTypes': false,
        'collectErrors': true,
        'removeAdditionalProperties': false
      }, pointer).errors;

      if (errors.length === 0) {
        return EMPTY_ERROR_LIST;
      }

      return BaseError.formatErrors(errors);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return [`Failed to compile validator for ${schemaId}#${pointer}: ${errorMessage}`];
    }
  }

  /**
   * Returns the compiled validator for a registered schema.
   *
   * @param schemaId - The `$id` of the schema.
   * @returns The {@link CompiledValidatorInterface} for the schema.
   * @throws {@link SchemaError} when no schema is registered for the given ID.
   */
  public validator(schemaId: string): CompiledValidatorInterface {
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new SchemaError('SCHEMA_NOT_REGISTERED', `No schema registered for: ${schemaId}`, schemaId);
    }

    return compiled;
  }
}
