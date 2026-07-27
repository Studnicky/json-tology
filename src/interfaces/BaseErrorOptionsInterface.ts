import type { ErrorCodeValueEntity } from '../entities/ErrorCodeValueEntity.js';
import type { RetryableFlagEntity } from '../entities/RetryableFlagEntity.js';

/**
 * Base options bag accepted by every json-tology error constructor.
 *
 * `code` is required so the shape satisfies the standard JavaScript
 * `Error(message, options)` contract and the `unicorn/custom-error-definition`
 * ESLint rule. `cause` holds a real `Error` instance — not JSON-representable
 * data — which is why this is a behavioral contract (`interface`), not a
 * schema-derived data type.
 */
export interface BaseErrorOptionsInterface {
  'cause'?: Error;
  'code': ErrorCodeValueEntity.Type;
  /**
   * Set `true` only for transient failures whose cause is external and may clear
   * on retry (e.g. HTTP 5xx). Omit (defaults to `false`) for deterministic
   * failures that recur on identical input. See {@link BaseError.retryable}.
   */
  'retryable'?: RetryableFlagEntity.Type;
}
