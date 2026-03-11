/**
 * Schema Registry
 *
 * Single in-repo graph engine shared by validation, parsing, materialization, and
 * pointer-based sub-schema execution.
 */

import type {
  FromSchema, JSONSchema
} from 'json-schema-to-ts';
import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { OkResult } from './OkResult.js';
import {
  FailResult, type ParseResult
} from './FailResult.js';
import { Transform } from './Transform.js';
import { GraphEngine } from './GraphEngine.js';
import { SchemaGraph } from './SchemaGraph.js';
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
  'engine'?: GraphEngine;
  'graph'?: SchemaGraph;
  'hash': string;
  'schema': Record<string, unknown>;
}

export class SchemaRegistry {
  public readonly coerce: boolean;

  private readonly logger: RegistryLogger;
  private readonly schemaHashes = new Map<string, string>();
  private readonly schemas = new Map<string, SchemaRegistryEntry>();

  public constructor(options?: RegistryOptions) {
    this.logger = options?.logger ?? SilentLogger;
    this.coerce = options?.coerce ?? false;
  }

  public errors(schemaId: string, data: unknown): ValidationErrors {
    const entry = this.schemas.get(schemaId);

    if (!entry) {
      return new ValidationErrors([{
        'keyword': 'unknown',
        'message': `No validator registered for schema: ${schemaId}`,
        'params': {},
        'path': ''
      }]);
    }

    const errors = this.execute(entry.schema, data, {
      'applyDefaults': false,
      'collectErrors': true,
      'coerce': false,
      'removeAdditional': false
    }).errors;

    return errors.length === 0 ? NO_VALIDATION_ERRORS : new ValidationErrors(errors);
  }

  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.schemas.get(schemaId)?.schema;
  }

  public graph(schemaId: string): SchemaGraph | undefined {
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      return undefined;
    }

    return this.getGraph(entry);
  }

  public is<T = unknown>(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): data is T {
    this.register(schema);

    return this.execute(schema, data, {
      'applyDefaults': false,
      'collectErrors': false,
      'coerce': false,
      'removeAdditional': false
    }).valid;
  }

  public list(): ReadonlyArray<Record<string, unknown>> {
    return [...this.schemas.values()].map((entry) => {
      return entry.schema;
    });
  }

  public listGraphs(): ReadonlyArray<SchemaGraph> {
    return [...this.schemas.values()].map((entry) => {
      return this.getGraph(entry);
    });
  }

  public parse<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    data: unknown,
  ): FromSchema<TSchema>;
  public parse(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): unknown {
    this.register(schema);
    const clone = structuredClone(data);
    const result = this.execute(schema, clone, {
      'applyDefaults': true,
      'collectErrors': true,
      'coerce': this.coerce,
      'removeAdditional': false
    });

    if (!result.valid) {
      throw new ParseError(new ValidationErrors(result.errors));
    }

    const decoder = Transform.getDecoder(schema);

    return decoder === undefined ? result.value : decoder.decode(result.value);
  }

  public register(schemas: Array<Record<string, unknown>> | Record<string, unknown>): void {
    const list = Array.isArray(schemas) ? schemas : [schemas];

    for (const element of list) {
      this.registerSingle(element);
    }
  }

  public safeParse<TSchema extends JSONSchema & { readonly '$id': string }>(
    schema: TSchema,
    data: unknown,
  ): ParseResult<FromSchema<TSchema>>;
  public safeParse(
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): ParseResult<unknown> {
    try {
      const result = (this.parse as (parseSchema: typeof schema, parseData: unknown) => unknown)(schema, data);

      return new OkResult(result);
    } catch (error) {
      if (Transform.hasFallback(schema)) {
        return new OkResult(Transform.getFallback(schema));
      }
      if (error instanceof ParseError) {
        return new FailResult(error.errors);
      }

      return new FailResult(new ValidationErrors([{
        'keyword': 'unknown',
        'message': String(error),
        'params': {},
        'path': ''
      }]));
    }
  }

  public validate(schemaId: string, data: unknown): string[] {
    const entry = this.schemas.get(schemaId);

    if (!entry) {
      return [`No validator registered for schema: ${schemaId}`];
    }

    const errors = this.execute(entry.schema, data, {
      'applyDefaults': false,
      'collectErrors': true,
      'coerce': false,
      'removeAdditional': false
    }).errors;

    if (errors.length === 0) {
      return NO_ERRORS;
    }

    return errors.map((error) => {
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
    const engine = this.getEngine(schema);

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

  private getEngine(schema: Record<string, unknown>): GraphEngine {
    const schemaId = schema.$id as string;
    const entry = this.schemas.get(schemaId);

    if (entry === undefined) {
      throw new Error(`No validator registered for schema: ${schemaId}`);
    }
    if (entry.engine === undefined) {
      entry.engine = new GraphEngine(entry.schema, {
        'lookupSchema': (lookupSchemaId) => {
          return this.schemas.get(lookupSchemaId)?.schema;
        }
      });
    }

    return entry.engine;
  }

  private getGraph(entry: SchemaRegistryEntry): SchemaGraph {
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
  }
}
