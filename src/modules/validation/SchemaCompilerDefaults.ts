import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { DefaultResolutionContextInterface } from '../../interfaces/DefaultResolutionContext.js';
import type { RefTargetInterface } from '../../interfaces/RefTarget.js';
import { GraphEngineDefaults } from '../graph/GraphEngineDefaults.js';
import { RefResolver } from './RefResolver.js';

import type { LookupSchemaFnType } from '../../types/LookupSchema.js';

function buildCompilerDefaultContext(
  lookupSchema: LookupSchemaFnType | undefined,
  lookupGraph?: (id: string) => SchemaGraphInterface | undefined
): DefaultResolutionContextInterface {
  return {
    resolveDynamicRef(
      _: string,
      currentGraph: SchemaGraphInterface
    ): RefTargetInterface {
      return {
        'graph': currentGraph,
        'node': currentGraph.rootNode
      };
    },
    resolveRef(ref: string, currentGraph: SchemaGraphInterface): RefTargetInterface {
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
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): unknown {
    const context = buildCompilerDefaultContext(lookupSchema, lookupGraph);
    const stringVisited = new Set<string>();

    for (const item of visited) {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        stringVisited.add((item as SchemaGraphNodeInterface).id);
      }
    }

    return GraphEngineDefaults.createImplicitDefaultValueSeeded(context, node, graph, [], stringVisited);
  }
} as const;
