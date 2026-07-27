import type { TrueFlagEntity } from '../entities/TrueFlagEntity.js';

/**
 * Internal discriminated union for the pass (success) branch.
 * Carries a validated value; errors is always undefined.
 *
 * Authored as an interface rather than a schema-derived entity: `data` is
 * generic — not representable in JSON Schema.
 */
export interface PassResultInterface<T> {
  'data': T;
  'errors': undefined;
  'success': TrueFlagEntity.Type;
}
