/**
 * ValidationErrors — collection class with rich query methods
 */

import type { AggregateViewEntity } from '../entities/AggregateViewEntity.js';
import type { ProblemDetailsOverridesEntity } from '../entities/ProblemDetailsOverridesEntity.js';
import type { ProblemDetailsEntity } from '../entities/ProblemDetailsEntity.js';
import type { ValidationErrorEntity } from '../entities/ValidationErrorEntity.js';

import { Path } from '../modules/data/Path.js';
import { JT_VALIDATION_PROBLEM_TYPE } from '../constants/IRI.js';

/**
 * An ordered collection of ValidationErrorEntity.Type items.
 *
 * Returned by `JsonTology.validate()` and carried on `CoercionError`.
 * Iterable so it works in for-of loops.
 *
 * Three views over the same error data:
 * - `items` — raw `ValidationErrorEntity.Type[]` with JSON Pointer paths
 * - `aggregate()` — `{ count, paths, keywords }` compact rollup for logging and metrics (paths in access form)
 * - `report()` — RFC 7807 Problem Details payload for HTTP error response bodies
 *
 * Cookbook recipes for removed methods:
 * ```ts
 * // was messages()
 * errs.items.map(e => `${e.path}: ${e.message}`)
 *
 * // was format() — group by path
 * Object.groupBy(errs.items, e => e.path || '_root')
 *
 * // was flatten() — field vs form errors
 * Object.groupBy(errs.items, e => e.path ? 'fieldErrors' : 'formErrors')
 * ```
 *
 * @example
 * const errs = jt.validate(UserSchema.$id, data);
 * errs.length;                     // number of errors
 * errs.items;                      // ValidationErrorEntity.Type[] — raw items
 * errs.aggregate();                // { count: 2, paths: ['name'], keywords: ['type'] }
 * errs.report();                   // RFC 7807 Problem Details payload
 * for (const err of errs) { ... } // iterate ValidationErrorEntity.Type items
 */
export class ValidationErrors implements Iterable<ValidationErrorEntity.Type> {
  /**
   * Map external validator errors to a ValidationErrors instance.
   */
  /**
   * Map external validator error objects into a ValidationErrors instance.
   *
   * @param rawErrors - Raw error array from an external validator, or null/undefined
   * @returns ValidationErrors wrapping the mapped items, falling back to a single unknown error
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

  /** The raw list of validation errors (JSON Pointer paths). */
  public readonly items: readonly ValidationErrorEntity.Type[];

  /**
   * Create a ValidationErrors collection from an array of validation error items.
   *
   * @param items - Ordered list of validation errors
   */
  public constructor(items: readonly ValidationErrorEntity.Type[]) {
    this.items = items;
  }

  /**
   * Compact rollup suitable for structured logging and metric labels.
   *
   * Returns deduplicated, sorted paths (in access form) and keywords with a total count.
   * Safe to use as metric label values — bounded cardinality, no per-instance
   * `params` data.
   *
   * Paths are returned in access form (`items[0].quantity`) not JSON Pointer (`/items/0/quantity`).
   * Use `errs.items.map(e => e.path)` for JSON Pointer paths.
   */
  public aggregate(): AggregateViewEntity.Type {
    const pathSet = new Set<string>();
    const keywordSet = new Set<string>();

    for (const item of this.items) {
      pathSet.add(Path.toAccess(item.path));
      keywordSet.add(item.keyword);
    }

    return {
      'count': this.items.length,
      'keywords': [...keywordSet].sort(),
      'paths': [...pathSet].sort()
    };
  }

  /** Number of errors. */
  public get length(): number {
    return this.items.length;
  }

  /** True when there are no errors. */
  public get ok(): boolean {
    return this.items.length === 0;
  }

  /**
   * RFC 7807 Problem Details payload for HTTP error response bodies.
   *
   * Defaults: type 'https://json-tology.dev/problems/validation',
   * title 'Validation failed', status 422.
   * Pass `overrides` to attach `instance`, retarget `status`, or customize `title`/`type`.
   *
   * @param overrides - Explicit field overrides merged over the default payload
   */
  public report(overrides?: ProblemDetailsOverridesEntity.Type): ProblemDetailsEntity.Type {
    const count = this.items.length;
    const detail = count === 1
      ? '1 validation error'
      : `${count} validation errors`;

    const defaultPayload: ProblemDetailsEntity.Type = {
      'detail': detail,
      'errors': this.items.map((item) => {
        return {
          'keyword': item.keyword,
          'message': item.message,
          'params': item.params,
          'path': item.path
        };
      }),
      'status': 422,
      'title': 'Validation failed',
      'type': JT_VALIDATION_PROBLEM_TYPE
    };

    return {
      ...defaultPayload,
      ...overrides
    };
  }

  /**
   * Return an iterator over the validation error items.
   *
   * @returns Iterator yielding each ValidationErrorEntity.Type in order
   */
  public [Symbol.iterator](): Iterator<ValidationErrorEntity.Type> {
    const result = this.items[Symbol.iterator]();

    return result;
  }
}
