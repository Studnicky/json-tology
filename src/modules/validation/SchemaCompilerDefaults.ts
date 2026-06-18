import type { SchemaGraphNodeType } from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import { GraphEngineDefaults } from '../graph/GraphEngineDefaults.js';

export const SchemaCompilerDefaults = {
  resolveImplicitDefaultValue(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    visited: Set<unknown>,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): unknown {
    const stringVisited = new Set<string>();

    for (const item of visited) {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        stringVisited.add((item as SchemaGraphNodeType).id);
      }
    }

    return GraphEngineDefaults.createImplicitDefaultValueForLookups(node, graph, lookupSchema, lookupGraph, stringVisited);
  },
  synthesizeZeroValue(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): unknown {
    return GraphEngineDefaults.synthesizeZeroValueForLookups(node, graph, lookup, lookupGraph);
  }
} as const;
