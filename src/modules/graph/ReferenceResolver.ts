/**
 * ReferenceResolver — thin compatibility shim over the canonical `ReferenceResolution.resolve` method.
 *
 * The validation compiler (SchemaCompilerPlan, SchemaCompilerDefaults) tolerates
 * an unresolvable `$ref` by skipping the check rather than aborting compilation.
 * The canonical `ReferenceResolution.resolve` throws on miss, so this shim catches `GraphError` and
 * maps it back to `undefined` to preserve the compiler's fallback contract.
 *
 * Call sites in SchemaCompilerDefaults treat `undefined` as "fall back to root node".
 * Call sites in SchemaCompilerPlan treat `undefined` as "no validator for this reference".
 * Both semantics are preserved here: the throw is caught and `undefined` is returned.
 */

import type { ReferenceTargetInterface } from '../../interfaces/ReferenceTargetInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { ReferenceResolutionOptionsInterface } from '../../interfaces/ReferenceResolutionOptionsInterface.js';
import { ReferenceResolution } from './ReferenceResolution.js';
import { GraphError } from '../../errors/GraphError.js';

export class ReferenceResolver {
  static resolve(
    reference: string,
    graph: SchemaGraphInterface,
    options: ReferenceResolutionOptionsInterface = {}
  ): ReferenceTargetInterface | undefined {
    try {
      return ReferenceResolution.resolve(reference, graph, options);
    } catch (error) {
      if (error instanceof GraphError) {
        return undefined;
      }

      throw error;
    }
  }
}
