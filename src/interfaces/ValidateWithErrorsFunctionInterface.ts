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
 * @category Validation
 * @since 0.1.0
 *
 * @remarks
 * `@typescript-eslint/prefer-function-type` flags this as a call-signature-only
 * interface, but converting it to a type alias reintroduces the
 * `@studnicky/type-alias-invariants` / `folder-content-shape` violation this
 * shape exists to satisfy. `@studnicky/eslint-config`'s own `entitySuite`
 * disables `prefer-function-type` for exactly this reason (see its README);
 * the project's `eslint.config.mjs` re-enables it globally, which reintroduces
 * the contradiction for every callable interface in `src/interfaces/`. Left as
 * a documented exception pending a scoped config fix.
 */
export interface ValidateWithErrorsFunctionInterface {
  (value: unknown, path: string, context: ExecContextInterface): ValidateWithErrorsResultEntity.Type;
}
