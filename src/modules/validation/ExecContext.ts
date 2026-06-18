import type { ExecContextType } from '../../types/ExecContext.js';

/**
 * ExecContext — constructs validation execution contexts.
 *
 * `build` overlays the supplied partial onto the standard field defaults,
 * keeping the 14-field {@link ExecContextType} shape in a single place so call
 * sites only declare the fields that deviate from the defaults.
 */
export class ExecContext {
  /**
   * Construct an {@link ExecContextType}, filling every omitted field with its
   * standard default.
   *
   * Defaults: applyDefaults=false, collectErrors=true, depth=0, doCoerce=false,
   * dynamicScope=[], errors=[], evaluatedItems=undefined,
   * evaluatedProperties=undefined, ignoreAdditionalProperties=false,
   * maxDepth=100, refStack=new Set(), stripUnknown=false,
   * synthesizeDefaults=false, trackEvaluated=false.
   *
   * @param partial - Fields that deviate from the defaults.
   * @returns A fully-populated execution context.
   */
  public static build(partial: Partial<ExecContextType>): ExecContextType {
    return {
      'applyDefaults': partial.applyDefaults ?? false,
      'collectErrors': partial.collectErrors ?? true,
      'depth': partial.depth ?? 0,
      'doCoerce': partial.doCoerce ?? false,
      'dynamicScope': partial.dynamicScope ?? [],
      'errors': partial.errors ?? [],
      'evaluatedItems': partial.evaluatedItems,
      'evaluatedProperties': partial.evaluatedProperties,
      'ignoreAdditionalProperties': partial.ignoreAdditionalProperties ?? false,
      'maxDepth': partial.maxDepth ?? 100,
      'refStack': partial.refStack ?? new Set(),
      'stripUnknown': partial.stripUnknown ?? false,
      'synthesizeDefaults': partial.synthesizeDefaults ?? false,
      'trackEvaluated': partial.trackEvaluated ?? false
    };
  }
}
