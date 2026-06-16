import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { DefaultResolutionContextType } from '../../types/DefaultResolutionContext.js';
import type { RefTargetType } from '../../types/RefTarget.js';
import { GraphEngineDefaults } from '../graph/GraphEngineDefaults.js';
import { RefResolver } from './RefResolver.js';

import type { LookupSchemaFnType } from '../../types/LookupSchema.js';

function buildCompilerDefaultContext(
  lookupSchema: LookupSchemaFnType | undefined,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
): DefaultResolutionContextType {
  return {
    resolveDynamicRef(
      _: string,
      currentGraph: SchemaGraphInterface
    ): RefTargetType {
      return {
        'graph': currentGraph,
        'node': currentGraph.rootNode
      };
    },
    resolveRef(ref: string, currentGraph: SchemaGraphInterface): RefTargetType {
      const resolved = RefResolver.resolve(ref, currentGraph, lookupSchema, lookupGraph);

      if (resolved === undefined) {
        return {
          'graph': currentGraph,
          'node': currentGraph.rootNode
        };
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
