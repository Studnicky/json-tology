/**
 * Schema Registry
 *
 * Single AJV instance (useDefaults: true) shared by validation and building.
 * validate() clones data before passing to AJV so callers' objects are never mutated.
 * parse() / safeParse() return the AJV-mutated clone with defaults applied.
 */

import type { ValidateFunction, Options as AjvOptions } from 'ajv';
import type { FromSchema, JSONSchema } from 'json-schema-to-ts';
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { OkResult } from './OkResult.js';
import { FailResult, type ParseResult } from './FailResult.js';
import { Transform } from './Transform.js';
import { Compiler, type CompiledSchema } from './Compiler.js';
import type { RegistryLogger, RegistryOptions } from '../interfaces/registry.js';
import { SilentLogger } from '../SilentLogger.js';

export type { RegistryLogger, RegistryOptions } from '../interfaces/registry.js';

// Reusable empty results — avoid per-call allocation on the happy path
const NO_ERRORS: string[] = Object.freeze([]) as unknown as string[];
const NO_VALIDATION_ERRORS = new ValidationErrors([]);

const Ajv = (AjvModule as any).default ?? AjvModule;
const addFormats = (addFormatsModule as any).default ?? addFormatsModule;

interface SchemaRegistryEntry {
  schema: Record<string, unknown>;
  hash: string;
  jit?: CompiledSchema | null;   // null = tried and fell back to AJV
}

export class SchemaRegistry {
  /** Shared AJV instance — useDefaults: true */
  public readonly ajv: InstanceType<typeof Ajv>;

  private readonly schemas = new Map<string, SchemaRegistryEntry>();
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly schemaHashes = new Map<string, string>();
  private readonly logger: RegistryLogger;

  public constructor(options?: AjvOptions | RegistryOptions) {
    let ajvOptions: AjvOptions | undefined;
    let coerce = false;
    this.logger = SilentLogger;

    if (options && typeof options === 'object') {
      if ('ajv' in options || 'logger' in options || 'coerce' in options) {
        const registryOptions = options as RegistryOptions;
        ajvOptions = registryOptions.ajv;
        this.logger = registryOptions.logger ?? SilentLogger;
        coerce = registryOptions.coerce ?? false;
      } else {
        ajvOptions = options as AjvOptions;
      }
    }

    this.ajv = new Ajv({
      allErrors: true,
      strict: false,
      verbose: true,
      coerceTypes: coerce,
      useDefaults: true,
      removeAdditional: false,
      ...(ajvOptions ?? {}),
    });

    addFormats(this.ajv);
  }

  // ---------------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------------

  public register(schemas: Record<string, unknown> | Record<string, unknown>[]): void {
    const list = Array.isArray(schemas) ? schemas : [schemas];
    for (let i = 0; i < list.length; i++) {
      this.registerSingle(list[i]);
    }
  }

  private registerSingle(schema: Record<string, unknown>): void {
    const schemaId = schema['$id'] as string | undefined;
    if (!schemaId) throw new Error('Schema must have a $id property');

    const hash = this.hashSchema(schema);

    if (this.schemas.has(schemaId)) {
      if (this.schemas.get(schemaId)?.hash === hash) {
        this.logger.trace(`Schema already registered (identical): ${schemaId}`);
        return;
      }
      this.logger.warn(
        `Schema ID already registered with different content (overwriting): ${schemaId}`,
      );
    }

    const existingId = this.schemaHashes.get(hash);
    if (existingId && existingId !== schemaId) {
      this.logger.warn(
        `Schema content already registered under different ID: existing="${existingId}" new="${schemaId}"`,
      );
    }

    try {
      this.schemas.set(schemaId, { schema, hash });
      this.schemaHashes.set(hash, schemaId);
      this.ajv.addSchema(schema);
      this.logger.trace(`Schema registered: ${schemaId}`);
    } catch (error) {
      this.schemas.delete(schemaId);
      this.schemaHashes.delete(hash);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Retrieval
  // ---------------------------------------------------------------------------

  public get(schemaId: string): Record<string, unknown> | undefined {
    return this.schemas.get(schemaId)?.schema;
  }

  /**
   * Return all registered schemas.
   */
  public list(): ReadonlyArray<Record<string, unknown>> {
    return Array.from(this.schemas.values()).map((e) => e.schema);
  }

  // ---------------------------------------------------------------------------
  // Internal: compile-and-cache
  // ---------------------------------------------------------------------------

  /** Returns the JIT-compiled schema if available, or null to use AJV. */
  private getJit(schemaId: string): CompiledSchema | null {
    const entry = this.schemas.get(schemaId);
    if (!entry) return null;
    if (entry.jit === undefined) {
      entry.jit = Compiler.compile(entry.schema) ?? null;
    }
    return entry.jit;
  }

  private getOrCompileValidator(schemaId: string, schema: Record<string, unknown>): ValidateFunction {
    if (!this.validators.has(schemaId)) {
      this.validators.set(schemaId, this.ajv.compile(schema));
    }
    return this.validators.get(schemaId)!;
  }

  // ---------------------------------------------------------------------------
  // validate() — backwards-compatible, returns string[]
  // ---------------------------------------------------------------------------

  /**
   * Validate data against a registered schema.
   * Data is cloned before validation so defaults are never applied to the caller's object.
   *
   * @returns Array of error strings (empty if valid)
   */
  public validate(schemaId: string, data: unknown): string[] {
    const entry = this.schemas.get(schemaId);
    if (!entry) return [`No validator registered for schema: ${schemaId}`];

    const jit = this.getJit(schemaId);
    if (jit) {
      if (jit.check(data)) return NO_ERRORS;
      return jit.errors(data).map((e) => `${e.path || 'root'}: ${e.message}`);
    }

    // AJV fallback
    const validator = this.getOrCompileValidator(schemaId, entry.schema);
    const clone = structuredClone(data);
    const valid = validator(clone);
    if (!valid) {
      return (
        validator.errors?.map((ajvError) => `${ajvError.instancePath || 'root'}: ${ajvError.message}`) ?? [
          'Unknown validation error',
        ]
      );
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // errors() — rich ValidationError[] alternative to validate()
  // ---------------------------------------------------------------------------

  /**
   * Validate data against a registered schema.
   * Returns structured ValidationError[] rather than string[].
   *
   * @param schemaId - Registered schema $id
   * @param data     - Data to validate
   */
  public errors(schemaId: string, data: unknown): ValidationErrors {
    const entry = this.schemas.get(schemaId);
    if (!entry) {
      return new ValidationErrors([{
        path: '',
        message: `No validator registered for schema: ${schemaId}`,
        keyword: 'unknown',
        params: {},
      }]);
    }

    const jit = this.getJit(schemaId);
    if (jit) {
      if (jit.check(data)) return NO_VALIDATION_ERRORS;
      return new ValidationErrors(jit.errors(data));
    }

    const validator = this.getOrCompileValidator(schemaId, entry.schema);
    const clone = structuredClone(data);
    const valid = validator(clone);
    return valid ? new ValidationErrors([]) : ValidationErrors.fromAjvErrors(validator.errors as Parameters<typeof ValidationErrors.fromAjvErrors>[0]);
  }

  // ---------------------------------------------------------------------------
  // parse() — typed, throws ParseError, returns clone with defaults applied
  // ---------------------------------------------------------------------------

  /** Typed overload — return type inferred from schema via FromSchema<TSchema>. */
  public parse<TSchema extends JSONSchema & { readonly $id: string }>(
    schema: TSchema,
    data: unknown,
  ): FromSchema<TSchema>;

  /** Implementation — loose types to avoid FromSchema deep instantiation. */
  public parse(
    schema: Record<string, unknown> & { $id: string },
    data: unknown,
  ): unknown {
    this.register(schema);
    const validator = this.getOrCompileValidator(schema.$id, schema);
    const clone = structuredClone(data);
    const valid = validator(clone);
    if (!valid) {
      throw new ParseError(ValidationErrors.fromAjvErrors(validator.errors as Parameters<typeof ValidationErrors.fromAjvErrors>[0]));
    }
    const tfn = Transform.getDecoder(schema);
    return tfn ? tfn.decode(clone) : clone;
  }

  // ---------------------------------------------------------------------------
  // safeParse() — typed, returns ParseResult discriminated union
  // ---------------------------------------------------------------------------

  /** Typed overload. */
  public safeParse<TSchema extends JSONSchema & { readonly $id: string }>(
    schema: TSchema,
    data: unknown,
  ): ParseResult<FromSchema<TSchema>>;

  /** Implementation. */
  public safeParse(
    schema: Record<string, unknown> & { $id: string },
    data: unknown,
  ): ParseResult<unknown> {
    try {
      const result = (this.parse as (parseSchema: typeof schema, data: unknown) => unknown)(schema, data);
      return new OkResult(result);
    } catch (error) {
      if (Transform.hasFallback(schema)) {
        return new OkResult(Transform.getFallback(schema));
      }
      if (error instanceof ParseError) return new FailResult(error.errors);
      return new FailResult(
        new ValidationErrors([{ path: '', message: String(error), keyword: 'unknown', params: {} }]),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // is() — type guard
  // ---------------------------------------------------------------------------

  /**
   * Type guard — returns true if data satisfies the schema.
   * Auto-registers the schema. Does not mutate data.
   *
   * `T` can be supplied manually for narrowing: `registry.is<User>(UserSchema, data)`
   * For fully inferred types at the call site, use safeParse() instead.
   */
  public is<T = unknown>(
    schema: Record<string, unknown> & { $id: string },
    data: unknown,
  ): data is T {
    this.register(schema);
    const jit = this.getJit(schema.$id);
    if (jit) return jit.check(data);
    return this.validate(schema.$id, data).length === 0;
  }

  // ---------------------------------------------------------------------------
  // validateAt() — JSON Pointer sub-schema validation
  // ---------------------------------------------------------------------------

  public validateAt(schemaId: string, pointer: string, data: unknown): string[] {
    const cacheKey = `${schemaId}#${pointer}`;

    if (!this.validators.has(cacheKey)) {
      const entry = this.schemas.get(schemaId);
      if (!entry) return [`No schema registered for: ${schemaId}`];

      try {
        const compiled = this.ajv.getSchema(`${schemaId}#${pointer}`);
        if (!compiled) return [`No schema at pointer: ${pointer}`];
        this.validators.set(cacheKey, compiled);
      } catch (error) {
        return [`Failed to compile validator for ${schemaId}#${pointer}: ${error}`];
      }
    }

    const validator = this.validators.get(cacheKey)!;
    const clone = structuredClone(data);
    const valid = validator(clone);

    if (!valid) {
      return (
        validator.errors?.map((ajvError) => `${ajvError.instancePath || 'root'}: ${ajvError.message}`) ?? [
          'Unknown validation error',
        ]
      );
    }
    return [];
  }

  // ---------------------------------------------------------------------------
  // Hashing
  // ---------------------------------------------------------------------------

  private hashSchema(schema: Record<string, unknown>): string {
    const copy = { ...schema };
    delete copy['$id'];
    const sortedKeys = Object.keys(copy).sort();
    return this.fastHash(JSON.stringify(copy, sortedKeys));
  }

  private fastHash(str: string): string {
    let hash = 2166136261;
    const fnvPrime = 16777619;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * fnvPrime) >>> 0;
    }
    return hash.toString(16);
  }
}
