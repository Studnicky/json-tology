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
  /** The raw list of validation errors. */
  public readonly items: ReadonlyArray<ValidationError>;

  public constructor(items: ReadonlyArray<ValidationError>) {
    this.items = items;
  }

  /** Number of errors. */
  public get length(): number {
    return this.items.length;
  }

  /** True when there are no errors. */
  public get ok(): boolean {
    return this.items.length === 0;
  }

  /** All error messages as plain strings (path prefix included). */
  public messages(): string[] {
    return this.items.map((error) => `${error.path || 'root'}: ${error.message}`);
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

  /**
   * Separate errors into field errors (keyed by path) and form-level errors (no path).
   *
   * @example
   * const { fieldErrors, formErrors } = errs.flatten();
   * // fieldErrors: { "/email": ["invalid format"] }
   * // formErrors:  ["must have required property 'email'"]
   */
  public flatten(): { fieldErrors: Record<string, string[]>; formErrors: string[] } {
    const fieldErrors: Record<string, string[]> = {};
    const formErrors: string[] = [];
    for (const error of this.items) {
      if (!error.path) {
        formErrors.push(error.message);
      } else {
        (fieldErrors[error.path] ??= []).push(error.message);
      }
    }
    return { fieldErrors, formErrors };
  }

  public [Symbol.iterator](): Iterator<ValidationError> {
    return this.items[Symbol.iterator]();
  }

  /**
   * Map raw AJV errors to a ValidationErrors instance.
   */
  public static fromAjvErrors(
    ajvErrors:
      | Array<{
          instancePath: string;
          message?: string;
          keyword: string;
          params: Record<string, unknown>;
        }>
      | null
      | undefined,
  ): ValidationErrors {
    if (!ajvErrors || ajvErrors.length === 0) {
      return new ValidationErrors([
        { path: '', message: 'Unknown validation error', keyword: 'unknown', params: {} },
      ]);
    }
    return new ValidationErrors(
      ajvErrors.map((ajvError) => ({
        path:    ajvError.instancePath,
        message: ajvError.message ?? 'Validation failed',
        keyword: ajvError.keyword,
        params:  ajvError.params,
      })),
    );
  }
}
