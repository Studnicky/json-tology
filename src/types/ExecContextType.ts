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

/**
 * Explicit overrides accepted by `ExecContext.build()` — every field of
 * {@link ExecContextType}, individually optional, at least one present.
 *
 * @remarks
 * Spelled out field-by-field rather than derived via `Partial<ExecContextType>`
 * so the full set of overridable fields stays visible at the call site. Modeled
 * as an N-way union (one variant per field promoted to required) rather than a
 * single all-optional literal, so the type isn't structurally subsumed by any
 * unrelated all-optional shape (see {@link ProblemDetailsOverridesType}).
 */
export type ExecContextOverridesType
  = | {
    'applyDefaults': boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce': boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors': boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth': number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope': DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors': ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems': Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties': Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties': boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth': number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack': Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown': boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults': boolean;
    'trackEvaluated'?: boolean;
  }
  | {
    'applyDefaults'?: boolean;
    'coerce'?: boolean;
    'collectErrors'?: boolean;
    'depth'?: number;
    'dynamicScope'?: DynamicScopeEntryType[];
    'errors'?: ValidationErrorType[];
    'evaluatedItems'?: Set<number> | undefined;
    'evaluatedProperties'?: Set<string> | undefined;
    'ignoreAdditionalProperties'?: boolean;
    'maxDepth'?: number;
    'refStack'?: Set<string>;
    'stripUnknown'?: boolean;
    'synthesizeDefaults'?: boolean;
    'trackEvaluated': boolean;
  };
