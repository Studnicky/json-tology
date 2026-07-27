import type { ExecContextInterface } from './ExecContextInterface.js';
import type { ValidateWithErrorsResultEntity } from '../entities/ValidateWithErrorsResultEntity.js';

/**
 * The compiled validator function signature used throughout the validation engine.
 *
 * @remarks
 * Every schema node compiles to a function matching this signature. All
 * execution flags (collectErrors, applyDefaults, coerce, stripUnknown) are
 * bundled in the `ExecContextInterface` context object. The context also carries
 * the accumulated error list, ref-cycle guard stack, and dynamic scope.
 *
 * @example
 * ```ts
 * const validate: ValidateWithErrorsFunctionInterface = registry.compile(schema);
 * const ctx: ExecContextInterface = { errors: [], collectErrors: true, applyDefaults: false, coerce: false, ignoreAdditionalProperties: false, synthesizeDefaults: false, stripUnknown: false, refStack: new Set(), dynamicScope: [], evaluatedItems: undefined, evaluatedProperties: undefined, depth: 0, maxDepth: 100, trackEvaluated: false };
 * const { valid } = validate(data, '', ctx);
 * ```
 *
 * Carries a `unique symbol` brand member alongside the call signature so it has real
 * contract evidence beyond "only a call signature" (optional, so plain function values
 * still satisfy the interface structurally).
 *
 * @category Validation
 * @since 0.1.0
 */
export interface ValidateWithErrorsFunctionInterface {
  (value: unknown, path: string, context: ExecContextInterface): ValidateWithErrorsResultEntity.Type;
  readonly 'validateWithErrorsFunctionBrand'?: unique symbol;
}
