/**
 * Schema Registry
 *
 * Single in-repo graph engine shared by validation, parsing, materialization, and
 * pointer-based sub-schema execution.
 */

import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { Transform } from './Transform.js';
import type { FormatRegistry } from './FormatRegistry.js';
import type { KeywordDefinition } from './GraphEngine.js';
import { GraphEngine } from './GraphEngine.js';
import { SchemaGraph } from './SchemaGraph.js';
import { SchemaCompiler, type CompiledValidator } from './SchemaCompiler.js';
import type {
  RegistryLogger, RegistryOptions
} from '../interfaces/registry.js';
import { SilentLogger } from '../SilentLogger.js';

export type {
  RegistryLogger, RegistryOptions
} from '../interfaces/registry.js';

const NO_ERRORS: string[] = Object.freeze([]) as unknown as string[];
const NO_VALIDATION_ERRORS = new ValidationErrors([]);

interface SchemaRegistryEntry {
  'compiled'?: CompiledValidator;
  'engine'?: GraphEngine;
  'graph'?: SchemaGraph;
  'hash': string;
  'schema': Record<string, unknown>;
}

export class SchemaRegistry {
  public readonly coerce: boolean;

  private readonly compiler: SchemaCompiler;
  private readonly formatRegistry: FormatRegistry | undefined;
  private readonly keywords: KeywordDefinition[] | undefined;
  private readonly logger: RegistryLogger;
  private readonly schemaHashes = new Map<string, string>();
  private readonly schemas = new Map<string, SchemaRegistryEntry>();

  public constructor(options?: RegistryOptions) {
    this.logger = options?.logger ?? SilentLogger;
    this.coerce = options?.coerce ?? false;
    this.formatRegistry = options?.formatRegistry;
    this.keywords = options?.keywords;
    this.compiler = new SchemaCompiler({
      'lookupCompiled': (schemaId) => {
        const entry = this.schemas.get(schemaId);

        if (entry !== undefined) {
          return this.compiled(schemaId);
        }

        return undefined;
      }
    });
  }

  public errors(schemaId: string, data: unknown): ValidationErrors {
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      return new ValidationErrors([{
        'keyword': 'unknown',
        'message': `No validator registered for schema: ${schemaId}`,
        'params': {},
        'path': ''
      }]);
    }

    const result = compiled.validate(data, { 'collectErrors': true });

    return result.errors.length === 0 ? NO_VALIDATION_ERRORS : new ValidationErrors(result.errors);
  }

  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.schemas.get(schemaId)?.schema;
  }

  public graph(schemaId: string): SchemaGraph | undefined {
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    return this.graphOf(entry);
  }

  public is(
    schema: string | (Record<string, unknown> & { '$id': string }),
    data: unknown
  ): boolean {
    const schemaId = typeof schema === 'string' ? schema : schema.$id;
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      throw new Error(`Schema not registered: ${schemaId}. Call register() first.`);
    }

    return compiled.check(data);
  }

  public list(): ReadonlyArray<Record<string, unknown>> {
    return [...this.schemas.values()].map((entry) => {
      return entry.schema;
    });
  }

  public listGraphs(): ReadonlyArray<SchemaGraph> {
    return [...this.schemas.values()].map((entry) => {
      return this.graphOf(entry);
    });
  }

  public parse(
    schema: string | (Record<string, unknown> & { '$id': string }),
    data: unknown
  ): unknown {
    const schemaObj = typeof schema === 'string'
      ? this.schemas.get(schema)?.schema
      : schema;

    if (schemaObj === undefined) {
      throw new Error(`Schema not registered: ${String(schema)}. Call register() first.`);
    }

    const schemaId = schemaObj.$id as string;
    const compiled = this.compiled(schemaId)!;

    const result = compiled.validate(structuredClone(data), {
      'applyDefaults': true,
      'coerce': this.coerce,
      'collectErrors': true,
      'removeAdditional': true
    });

    if (!result.valid) {
      throw new ParseError(new ValidationErrors(result.errors));
    }

    const decoder = Transform.getDecoder(schemaObj);

    return decoder === undefined ? result.value : decoder.decode(result.value);
  }

  public register(
    schemas: ReadonlyArray<Record<string, unknown>> | Record<string, unknown>
  ): void {
    const list = Array.isArray(schemas) ? schemas : [schemas];

    for (const element of list) {
      this.registerSingle(element);
    }
  }

  public validate(schemaId: string, data: unknown): string[] {
    const compiled = this.compiled(schemaId);

    if (compiled === undefined) {
      return [`No validator registered for schema: ${schemaId}`];
    }

    if (compiled.compiled && compiled.check(data)) {
      return NO_ERRORS;
    }

    const result = compiled.validate(data, { 'collectErrors': true });

    if (result.errors.length === 0) {
      return NO_ERRORS;
    }

    return result.errors.map((error) => {
      return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
    });
  }

  public validateAt(schemaId: string, pointer: string, data: unknown): string[] {
    const entry = this.schemas.get(schemaId);

    if (!entry) {
      return [`No schema registered for: ${schemaId}`];
    }

    try {
      const errors = this.execute(entry.schema, data, {
        'applyDefaults': false,
        'collectErrors': true,
        'coerce': false,
        'removeAdditional': false
      }, pointer).errors;

      if (errors.length === 0) {
        return NO_ERRORS;
      }

      return errors.map((error) => {
        return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      return [`Failed to compile validator for ${schemaId}#${pointer}: ${errorMessage}`];
    }
  }

  public cast(schemaOrId: string | (Record<string, unknown> & { '$id': string }), data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId)!;

    return compiled.validate(structuredClone(data), {
      'applyDefaults': true,
      'coerce': true,
      'collectErrors': false
    }).value;
  }

  public clean(schemaOrId: string | (Record<string, unknown> & { '$id': string }), data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId)!;

    return compiled.validate(structuredClone(data), {
      'collectErrors': false,
      'stripUnknownProperties': true
    }).value;
  }

  public convert(schemaOrId: string | (Record<string, unknown> & { '$id': string }), data: unknown): unknown {
    const schemaId = this.resolveSchemaId(schemaOrId);
    const compiled = this.compiled(schemaId)!;

    return compiled.validate(structuredClone(data), {
      'coerce': true,
      'collectErrors': false
    }).value;
  }

  private resolveSchemaId(schemaOrId: string | (Record<string, unknown> & { '$id': string })): string {
    return typeof schemaOrId === 'string' ? schemaOrId : schemaOrId.$id;
  }

  public create(schemaId: string): unknown {
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      throw new Error(`No schema registered for: ${schemaId}`);
    }

    return this.instanceFromSchema(entry.schema);
  }

  private compiled(schemaId: string): CompiledValidator | undefined {
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    if (entry.compiled === undefined) {
      const engine = this.engine(entry.schema);

      entry.compiled = this.compiler.compile(engine);
    }

    return entry.compiled;
  }

  private execute(
    schema: Record<string, unknown>,
    data: unknown,
    options: {
      'applyDefaults': boolean;
      'collectErrors': boolean;
      'coerce': boolean;
      'removeAdditional': boolean;
    },
    pointer = ''
  ) {
    const engine = this.engine(schema);

    return engine.execute(data, pointer, options);
  }

  private fastHash(str: string): string {
    let hash = 2_166_136_261;
    const fnvPrime = 16_777_619;

    for (let i = 0; i < str.length; i++) {
      hash ^= str.codePointAt(i) ?? 0;
      hash = (hash * fnvPrime) >>> 0;
    }

    return hash.toString(16);
  }

  public engine(schema: Record<string, unknown>): GraphEngine {
    const schemaId = schema.$id as string;
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      throw new Error(`No validator registered for schema: ${schemaId}`);
    }
    if (entry.engine === undefined) {
      entry.engine = new GraphEngine(entry.schema, {
        ...(this.formatRegistry ? { 'formatRegistry': this.formatRegistry } : {}),
        ...(this.keywords && this.keywords.length > 0 ? { 'keywords': this.keywords } : {}),
        'lookupSchema': (lookupSchemaId) => {
          return this.schemas.get(lookupSchemaId)?.schema;
        }
      });
    }

    return entry.engine;
  }

  private graphOf(entry: SchemaRegistryEntry): SchemaGraph {
    if (entry.graph === undefined) {
      entry.graph = new SchemaGraph(entry.schema);
    }

    return entry.graph;
  }

  private hashSchema(schema: Record<string, unknown>): string {
    const copy = { ...schema };

    delete copy.$id;
    const sortedKeys = Object.keys(copy).sort();

    return this.fastHash(JSON.stringify(copy, sortedKeys));
  }

  private registerSingle(schema: Record<string, unknown>): void {
    const schemaId = schema.$id as string | undefined;

    if (schemaId === undefined || schemaId === '') {
      throw new Error('Schema must have a $id property');
    }

    const hash = this.hashSchema(schema);

    if (this.schemas.has(schemaId)) {
      if (this.schemas.get(schemaId)?.hash === hash) {
        this.logger.trace(`Schema already registered (identical): ${schemaId}`);

        return;
      }
      this.logger.warn(`Schema ID already registered with different content (overwriting): ${schemaId}`);
    }

    const existingId = this.schemaHashes.get(hash);

    if (existingId !== undefined && existingId !== schemaId) {
      this.logger.warn(`Schema content already registered under different ID: existing="${existingId}" new="${schemaId}"`);
    }

    this.schemas.set(schemaId, {
      hash,
      schema
    });
    this.schemaHashes.set(hash, schemaId);
    this.logger.trace(`Schema registered: ${schemaId}`);

    const graph = this.graphOf(this.schemas.get(schemaId) as SchemaRegistryEntry);
    const warnings = graph.validateStructure();

    if (warnings.length > 0) {
      throw new Error(
        `Structure validation failed for schema "${schemaId}": ${warnings.map((w) => w.message).join('; ')}`
      );
    }
  }

  private instanceFromSchema(schema: Record<string, unknown>): unknown {
    if ('default' in schema) {
      return structuredClone(schema['default']);
    }
    if ('const' in schema) {
      return schema['const'];
    }
    if (Array.isArray(schema['enum']) && (schema['enum'] as unknown[]).length > 0) {
      return (schema['enum'] as unknown[])[0];
    }

    if (typeof schema['$ref'] === 'string') {
      const refSchema = this.schemas.get(schema['$ref'] as string)?.schema;

      if (refSchema) {
        return this.instanceFromSchema(refSchema);
      }
    }

    const type = schema['type'];

    if (type === 'string') return '';
    if (type === 'number' || type === 'integer') return 0;
    if (type === 'boolean') return false;
    if (type === 'null') return null;
    if (type === 'array') return [];

    if (type === 'object') {
      const result: Record<string, unknown> = {};
      const properties = schema['properties'] as Record<string, Record<string, unknown>> | undefined;
      const required = Array.isArray(schema['required']) ? schema['required'] as string[] : [];

      if (properties) {
        for (const key of Object.keys(properties)) {
          const propSchema = properties[key];
          const hasDefault = 'default' in propSchema || 'const' in propSchema ||
            (Array.isArray(propSchema['enum']) && (propSchema['enum'] as unknown[]).length > 0);

          if (hasDefault || required.includes(key)) {
            result[key] = this.instanceFromSchema(propSchema);
          }
        }
      }

      return result;
    }

    return null;
  }
}
