/**
 * Validator
 *
 * Stateless schema validation without a registry.
 * Internally uses SchemaCompiler for optimized validation.
 */

import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { GraphEngine } from './GraphEngine.js';
import { SchemaCompiler, type CompiledValidator } from './SchemaCompiler.js';
import type { ValidationResult } from '../interfaces/validation.js';

export type { ValidationResult } from '../interfaces/validation.js';

const compiler = new SchemaCompiler();

export class Validator {
  private readonly validators = new Map<string, CompiledValidator>();

  public constructor() {}

  public assert(schema: Record<string, unknown>, data: unknown, context?: string): void {
    const errors = this.validate(schema, data);

    if (errors.length > 0) {
      const message = context === undefined ? errors.join('; ') : `${context}: ${errors.join('; ')}`;

      throw new Error(message);
    }
  }

  public errors(schema: Record<string, unknown>, data: unknown): ValidationErrors {
    try {
      const compiled = this.compiled(schema);
      const result = compiled.validate(data, { 'collectErrors': true });

      return result.errors.length === 0 ? new ValidationErrors([]) : new ValidationErrors(result.errors);
    } catch (error) {
      return new ValidationErrors([{
        'keyword': 'unknown',
        'message': String(error),
        'params': {},
        'path': ''
      }]);
    }
  }

  public is<T>(schema: Record<string, unknown>, data: unknown): data is T {
    return this.compiled(schema).check(data);
  }

  public isValid(schema: Record<string, unknown>, data: unknown): boolean {
    return this.compiled(schema).check(data);
  }

  public parse<T>(schema: Record<string, unknown>, data: unknown): T {
    const errs = this.errors(schema, data);

    if (!errs.ok) {
      throw new ParseError(errs);
    }

    return data as T;
  }

  public validate(schema: Record<string, unknown>, data: unknown): string[] {
    try {
      const compiled = this.compiled(schema);

      if (compiled.compiled && compiled.check(data)) {
        return [];
      }

      const result = compiled.validate(data, { 'collectErrors': true });

      return result.errors.map((error) => {
        return `${error.path === '' ? 'root' : error.path}: ${error.message}`;
      });
    } catch (error) {
      return [`Failed to validate: ${error instanceof Error ? error.message : String(error)}`];
    }
  }

  public validateTyped<T>(schema: Record<string, unknown>, data: unknown): ValidationResult<T> {
    const errors = this.validate(schema, data);

    if (errors.length === 0) {
      return {
        'data': data as T,
        'valid': true
      };
    }

    return {
      errors,
      'valid': false
    };
  }

  private compiled(schema: Record<string, unknown>): CompiledValidator {
    const cacheKey = (schema.$id as string | undefined) ?? JSON.stringify(schema);
    let compiled = this.validators.get(cacheKey);

    if (compiled === undefined) {
      const engine = new GraphEngine(schema);

      compiled = compiler.compile(engine);
      this.validators.set(cacheKey, compiled);
    }

    return compiled;
  }
}
