import type { DynamicScopeEntryType } from './DynamicScopeEntryType.js';
import type { ValidationErrorType } from './Validation.js';

export type ExecContextType = {
  'applyDefaults': boolean;
  'coerce': boolean;
  'collectErrors': boolean;
  'depth': number;
  'dynamicScope': DynamicScopeEntryType[];
  'errors': ValidationErrorType[];
  'evaluatedItems': Set<number> | undefined;
  'evaluatedProperties': Set<string> | undefined;
  'ignoreAdditionalProperties': boolean;
  'maxDepth': number;
  'refStack': Set<string>;
  'stripUnknown': boolean;
  'synthesizeDefaults': boolean;
  /** Whether evaluated properties/items are accumulated (required only for `unevaluated*`). */
  'trackEvaluated': boolean;
};
