import type { CurieInterface } from './CurieInterface.js';

/**
 * Options for `QuadFactory.emitLiterals` /
 * `QuadFactory.emitConstraintLiteral` — shared shape across the
 * literal-emission helpers.
 */
export interface QuadFactoryEmitOptionsInterface {
  'curie'?: CurieInterface | undefined;
}
