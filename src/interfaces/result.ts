import type { ValidationErrors } from '../errors/ValidationErrors.js';

export interface ResultInterface<T> {
  readonly 'data': T | undefined;
  readonly 'errors': undefined | ValidationErrors;
  map<U>(transform: (data: T) => U): ResultInterface<U>;
  orElse(fallback: (errors: ValidationErrors) => T): T;
  readonly 'success': boolean;
  unwrap(): T;
}
