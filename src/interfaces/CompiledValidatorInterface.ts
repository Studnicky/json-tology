import type { CompiledValidateOptionsEntity } from '../entities/CompiledValidateOptionsEntity.js';
import type { CompiledValidationResultEntity } from '../entities/CompiledValidationResultEntity.js';
import type { CompiledFlagEntity } from '../entities/CompiledFlagEntity.js';

/**
 * A compiled validator produced by {@link SchemaCompilerInterface.compile}.
 *
 * @remarks
 * Provides two entry points: `check` for a fast boolean path that short-circuits
 * on the first error, and `validate` for the full result with coercion, defaults,
 * and error collection controlled by `CompiledValidateOptionsEntity`.
 * The `compiled` flag distinguishes real compiled validators from engine fallbacks.
 *
 * @example
 * ```ts
 * if (validator.check(data)) {
 *   const result = validator.validate(data, { applyDefaults: true });
 * }
 * ```
 *
 * @category Compiler
 * @since 0.1.0
 * @see {@link CompiledValidationResultEntity}
 * @group Validation
 */
export interface CompiledValidatorInterface {
  check(data: unknown): boolean;
  readonly 'compiled': CompiledFlagEntity.Type;
  validate(data: unknown, options?: CompiledValidateOptionsEntity.Type): CompiledValidationResultEntity.Type;
}
