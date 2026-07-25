import type { IdentityType } from './IdentityType.js';

export type CompositionAccumulatorType = IdentityType<{
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'value': unknown;
}>;
