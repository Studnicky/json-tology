/**
 * Internal discriminated union for the pass (success) branch.
 * Carries a validated value; errors is always undefined.
 */
export type PassResultType<T> = {
  readonly 'data': T;
  readonly 'errors': undefined;
  readonly 'success': true;
};
