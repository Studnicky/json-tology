import type { DynamicScopeEntryType } from './DynamicScopeEntry.js';
import type { ValidationErrorType } from './Validation.js';

export type ExecContextType = {
  'applyDefaults': boolean;
  'collectErrors': boolean;
  'depth': number;
  'doCoerce': boolean;
  'dynamicScope': DynamicScopeEntryType[];
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'maxDepth': number;
  'refStack': Set<string>;
  'stripUnknown': boolean;
  /** Whether evaluated properties/items are accumulated (required only for `unevaluated*`). */
  'trackEvaluated': boolean;
};
