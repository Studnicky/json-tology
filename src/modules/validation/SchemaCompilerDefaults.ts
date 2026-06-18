import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import type { DefaultResolutionContextType } from '../../types/DefaultResolutionContextType.js';
import type { RefTargetType } from '../../types/RefTargetType.js';
import { GraphEngineDefaults } from '../graph/GraphEngineDefaults.js';
import { RefResolver } from './RefResolver.js';
import { GraphError } from '../../errors/GraphError.js';
import { GraphErrorCode } from '../../constants/ERROR_CODES.js';
import { GraphEngineSupport } from '../graph/GraphEngineSupport.js';

import type { LookupSchemaFnType } from '../../types/LookupSchemaFnType.js';

function buildCompilerDefaultContext(
  lookupSchema: LookupSchemaFnType | undefined,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
): DefaultResolutionContextType {
  return {
    resolveDynamicRef(
      dynamicRef: string,
      currentGraph: SchemaGraphInterface,
      dynamicScope
    ): RefTargetType {
      const resolved = RefResolver.resolve(dynamicRef, currentGraph, lookupSchema, lookupGraph);

      if (resolved === undefined) {
        // observability: throw is surfaced to caller (SchemaCompiler.compile → GraphEngineDefaults)
        throw new GraphError(
          `Cannot resolve $dynamicRef '${dynamicRef}' — schema not found`,
          {
            'code': GraphErrorCode.REF_NOT_FOUND,
            'pointer': dynamicRef
          }
        );
      }

      // Mirror the dynamic scope walk from resolveDynamicRefTarget in SchemaCompilerPlan.
      const fragment = GraphEngineSupport.extractNamedFragment(dynamicRef);
      const resolvedSem = resolved.graph.semantics(resolved.node);
      const resolvedAnchor = resolvedSem.dynamicAnchor;

      if (fragment === undefined || resolvedAnchor !== fragment) {
        return resolved;
      }

      for (const entry of dynamicScope) {
        if (entry.anchor === fragment) {
          return {
            'graph': entry.graph,
            'node': entry.node
          };
        }
      }

      return resolved;
    },
    resolveRef(ref: string, currentGraph: SchemaGraphInterface): RefTargetType {
      const resolved = RefResolver.resolve(ref, currentGraph, lookupSchema, lookupGraph);

      if (resolved === undefined) {
        // observability: throw is surfaced to caller (SchemaCompiler.compile → GraphEngineDefaults)
        throw new GraphError(
          `Cannot resolve $ref '${ref}' — schema not found`,
          {
            'code': GraphErrorCode.REF_NOT_FOUND,
            'pointer': ref
          }
        );
      }

      return resolved;
    }
  };
}

export const SchemaCompilerDefaults = {
  resolveImplicitDefaultValue(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): unknown {
    const context = buildCompilerDefaultContext(lookupSchema, lookupGraph);
    const stringVisited = new Set<string>();

    for (const item of visited) {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        stringVisited.add((item as SchemaGraphNodeType).id);
      }
    }

    return GraphEngineDefaults.createImplicitDefaultValueSeeded(context, node, graph, [], stringVisited);
  },
  synthesizeZeroValue(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): unknown {
    const context = buildCompilerDefaultContext(lookup, lookupGraph);

    return GraphEngineDefaults.synthesizeZeroValue(context, node, graph, []);
  }
} as const;
