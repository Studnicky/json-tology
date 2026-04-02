import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import type { DefaultResolutionContextInterface } from '../../interfaces/DefaultResolutionContext.js';
import type { RefTargetInterface } from '../../interfaces/RefTarget.js';
import { createImplicitDefaultValue } from '../graph/graphEngineDefaults.js';
import { RefResolver } from './refResolver.js';

import type { LookupSchemaFnType } from '../../types/LookupSchema.js';

function buildCompilerDefaultContext(lookupSchema: LookupSchemaFnType | undefined): DefaultResolutionContextInterface {
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
      const resolved = RefResolver.resolve(ref, currentGraph, lookupSchema);

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

export function resolveImplicitDefaultValue(
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
  visited: Set<unknown>
): unknown {
  const context = buildCompilerDefaultContext(lookupSchema);
  const stringVisited = new Set<string>();

  for (const item of visited) {
    if (typeof item === 'object' && item !== null && 'id' in item) {
      stringVisited.add((item as SchemaGraphNodeInterface).id);
    }
  }

  return createImplicitDefaultValue(context, node, graph, [], stringVisited);
}
