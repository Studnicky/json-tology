/**
 * Validator
 *
 * Stateless schema validation without a registry.
 */

import { ParseError } from './ParseError.js';
import { ValidationErrors } from './ValidationErrors.js';
import { OkResult } from './OkResult.js';
import {
  FailResult, type ParseResult
} from './FailResult.js';
import { GraphEngine } from './GraphEngine.js';
import type { ValidationResult } from '../interfaces/validation.js';

export type { ValidationResult } from '../interfaces/validation.js';

export class Validator {
  private readonly validators = new Map<string, GraphEngine>();

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
      const errors = this.getOrCompileValidator(schema).errors(data);

      return errors.length === 0 ? new ValidationErrors([]) : new ValidationErrors(errors);
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
    return this.validate(schema, data).length === 0;
  }

  public isValid(schema: Record<string, unknown>, data: unknown): boolean {
    return this.validate(schema, data).length === 0;
  }

  public parse<T>(schema: Record<string, unknown>, data: unknown): T {
    const errs = this.errors(schema, data);

    if (!errs.ok) {
      throw new ParseError(errs);
    }

    return data as T;
  }

  public safeParse<T>(schema: Record<string, unknown>, data: unknown): ParseResult<T> {
    const errs = this.errors(schema, data);

    if (!errs.ok) {
      return new FailResult<T>(errs);
    }

    return new OkResult(data as T);
  }

  public validate(schema: Record<string, unknown>, data: unknown): string[] {
    try {
      const errors = this.getOrCompileValidator(schema).errors(data);

      return errors.map((error) => {
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

  private getOrCompileValidator(schema: Record<string, unknown>): GraphEngine {
    const cacheKey = (schema.$id as string | undefined) ?? JSON.stringify(schema);

    if (!this.validators.has(cacheKey)) {
      this.validators.set(cacheKey, new GraphEngine(schema));
    }

    const validator = this.validators.get(cacheKey);

    if (validator === undefined) {
      throw new Error(`Validator unexpectedly missing for: ${cacheKey}`);
    }

    return validator;
  }
}
