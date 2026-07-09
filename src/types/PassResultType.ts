/**
 * Internal discriminated union for the pass (success) branch.
 * Carries a validated value; errors is always undefined.
 */
export type PassResultType<T> = {
  'data': T;
  'errors': undefined;
  'success': true;
};
