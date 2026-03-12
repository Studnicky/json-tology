/**
 * ValidationErrors — collection class with rich query methods
 */

import type { ValidationError } from '../interfaces/validation.js';

/**
 * An ordered collection of ValidationError items.
 *
 * Returned by jt.errors(), registry.errors(), and carried on ParseError.
 * Iterable so it works in for-of loops.
 *
 * @example
 * const errs = jt.errors(UserSchema.$id, data);
 * errors.length;                   // number of errors
 * errors.messages();               // string[] — one per error
 * errors.format();                 // { "/name": ["must be string"], ... }
 * errors.flatten();                // { fieldErrors: { ... }, formErrors: [...] }
 * for (const error of errors) { ... } // iterate ValidationError items
 */
export class ValidationErrors implements Iterable<ValidationError> {
  /**
   * Map external validator errors to a ValidationErrors instance.
   */
  public static fromValidatorErrors(rawErrors:
      | Array<{
        'instancePath': string;
        'keyword': string;
        'message'?: string;
        'params': Record<string, unknown>;
      }>
      | null
      | undefined): ValidationErrors {
    if (!rawErrors || rawErrors.length === 0) {
      return new ValidationErrors([{
        'keyword': 'unknown',
        'message': 'Unknown validation error',
        'params': {},
        'path': ''
      }]);
    }

    return new ValidationErrors(rawErrors.map((rawError) => {
      return {
        'keyword': rawError.keyword,
        'message': rawError.message ?? 'Validation failed',
        'params': rawError.params,
        'path': rawError.instancePath
      };
    }));
  }

  /** The raw list of validation errors. */
  public readonly items: readonly ValidationError[];

  public constructor(items: readonly ValidationError[]) {
    this.items = items;
  }

  /**
   * Separate errors into field errors (keyed by path) and form-level errors (no path).
   *
   * @example
   * const { fieldErrors, formErrors } = errs.flatten();
   * // fieldErrors: { "/email": ["invalid format"] }
   * // formErrors:  ["must have required property 'email'"]
   */
  public flatten(): { 'fieldErrors': Record<string, string[]>;
    'formErrors': string[] } {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];

    for (const error of this.items) {
      if (error.path) {
        (fieldErrors[error.path] ??= []).push(error.message);
      } else {
        formErrors.push(error.message);
      }
    }

    return {
      fieldErrors,
      formErrors
    };
  }

  /**
   * Group errors by JSON Pointer path.
   * Root-level errors (no path) are keyed as `"_root"`.
   *
   * @example
   * errs.format();
   * // { "/name": ["must be string"], "_root": ["must have required property 'email'"] }
   */
  public format(): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const error of this.items) {
      const key = error.path || '_root';

      (result[key] ??= []).push(error.message);
    }

    return result;
  }

  /** Number of errors. */
  public get length(): number {
    return this.items.length;
  }

  /** All error messages as plain strings (path prefix included). */
  public messages(): string[] {
    return this.items.map((error) => {
      return `${error.path || 'root'}: ${error.message}`;
    });
  }

  /** True when there are no errors. */
  public get ok(): boolean {
    return this.items.length === 0;
  }

  public [Symbol.iterator](): Iterator<ValidationError> {
    return this.items[Symbol.iterator]();
  }
}
