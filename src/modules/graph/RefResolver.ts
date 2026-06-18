/**
 * RefResolver — thin compatibility shim over the canonical `RefResolution.resolve` method.
 *
 * The validation compiler (SchemaCompilerPlan, SchemaCompilerDefaults) tolerates
 * an unresolvable `$ref` by skipping the check rather than aborting compilation.
 * The canonical `RefResolution.resolve` throws on miss, so this shim catches `GraphError` and
 * maps it back to `undefined` to preserve the compiler's fallback contract.
 *
 * Call sites in SchemaCompilerDefaults treat `undefined` as "fall back to root node".
 * Call sites in SchemaCompilerPlan treat `undefined` as "no validator for this ref".
 * Both semantics are preserved here: the throw is caught and `undefined` is returned.
 */

import type { RefTargetType } from '../../types/RefTargetType.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { RefResolutionOptionsType } from '../../types/RefResolutionOptionsType.js';
import { RefResolution } from './RefResolution.js';
import { GraphError } from '../../errors/GraphError.js';

export class RefResolver {
  static resolve(
    ref: string,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): RefTargetType | undefined {
    const opts: RefResolutionOptionsType = {
      ...(lookupGraph !== undefined && { 'lookupGraph': lookupGraph }),
      ...(lookupSchema !== undefined && { 'lookupSchema': lookupSchema })
    };

    try {
      return RefResolution.resolve(ref, graph, opts);
    } catch (error) {
      if (error instanceof GraphError) {
        return undefined;
      }

      throw error;
    }
  }
}
