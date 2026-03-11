/**
 * Validator
 *
 * Stateless schema validation without a registry.
 * Validates data at runtime using the same schemas used for TypeScript types.
 */

import type { Options as AjvOptions } from 'ajv';
import AjvModule from 'ajv';
import addFormatsModule from 'ajv-formats';
import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { OkResult } from './OkResult.js';
import { FailResult, type ParseResult } from './FailResult.js';
import type { ValidationResult } from '../interfaces/validation.js';

export type { ValidationResult } from '../interfaces/validation.js';

const Ajv = (AjvModule as any).default ?? AjvModule;
const addFormats = (addFormatsModule as any).default ?? addFormatsModule;

export class Validator {
  private ajv: InstanceType<typeof Ajv>;
  private validators = new Map<string, any>();

  public constructor(options?: AjvOptions) {
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: false,
      strict: true,
      useDefaults: false,
      verbose: true,
      ...options,
    });

    addFormats(this.ajv);
  }

  // ---------------------------------------------------------------------------
  // validate() — returns string[] (backwards compatible)
  // ---------------------------------------------------------------------------

  public validate(schema: Record<string, unknown>, data: unknown): string[] {
    try {
      const compiled = this.getOrCompileValidator(schema);
      const valid = compiled(data);
      if (!valid) {
        return (
          compiled.errors?.map((ajvError: any) => `${ajvError.instancePath || 'root'}: ${ajvError.message}`) ?? [
            'Unknown validation error',
          ]
        );
      }
      return [];
    } catch (error) {
      return [`Failed to validate: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  // ---------------------------------------------------------------------------
  // validateTyped() — returns ValidationResult<T>
  // ---------------------------------------------------------------------------

  public validateTyped<T>(schema: Record<string, unknown>, data: unknown): ValidationResult<T> {
    const errors = this.validate(schema, data);
    if (errors.length === 0) return { valid: true, data: data as T };
    return { valid: false, errors };
  }

  // ---------------------------------------------------------------------------
  // isValid() — boolean check
  // ---------------------------------------------------------------------------

  public isValid(schema: Record<string, unknown>, data: unknown): boolean {
    return this.validate(schema, data).length === 0;
  }

  // ---------------------------------------------------------------------------
  // assert() — throws on invalid data
  // ---------------------------------------------------------------------------

  public assert(schema: Record<string, unknown>, data: unknown, context?: string): void {
    const errors = this.validate(schema, data);
    if (errors.length > 0) {
      const message = context ? `${context}: ${errors.join('; ')}` : errors.join('; ');
      throw new Error(message);
    }
  }

  // ---------------------------------------------------------------------------
  // errors() — returns ValidationError[] (rich structured errors)
  // ---------------------------------------------------------------------------

  /**
   * Validate data and return structured ValidationError[] instead of string[].
   */
  public errors(schema: Record<string, unknown>, data: unknown): ValidationErrors {
    try {
      const compiled = this.getOrCompileValidator(schema);
      const valid = compiled(data);
      return valid
        ? new ValidationErrors([])
        : ValidationErrors.fromAjvErrors(compiled.errors as Parameters<typeof ValidationErrors.fromAjvErrors>[0]);
    } catch (error) {
      return new ValidationErrors([{ path: '', message: String(error), keyword: 'unknown', params: {} }]);
    }
  }

  // ---------------------------------------------------------------------------
  // parse() — validates and returns typed data, throws ParseError on failure
  // Note: Validator has useDefaults: false — defaults are not applied.
  //       Use SchemaRegistry or EntityBuilder for default-filling behaviour.
  // ---------------------------------------------------------------------------

  public parse<T>(schema: Record<string, unknown>, data: unknown): T {
    const errs = this.errors(schema, data);
    if (!errs.ok) throw new ParseError(errs);
    return data as T;
  }

  // ---------------------------------------------------------------------------
  // safeParse() — returns ParseResult<T>
  // ---------------------------------------------------------------------------

  public safeParse<T>(schema: Record<string, unknown>, data: unknown): ParseResult<T> {
    const errs = this.errors(schema, data);
    if (!errs.ok) return new FailResult<T>(errs);
    return new OkResult(data as T);
  }

  // ---------------------------------------------------------------------------
  // is() — type guard
  // ---------------------------------------------------------------------------

  public is<T>(schema: Record<string, unknown>, data: unknown): data is T {
    return this.validate(schema, data).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private getOrCompileValidator(schema: Record<string, unknown>): any {
    const cacheKey = (schema['$id'] as string | undefined) ?? JSON.stringify(schema);
    if (!this.validators.has(cacheKey)) {
      this.validators.set(cacheKey, this.ajv.compile(schema));
    }
    return this.validators.get(cacheKey);
  }
}
