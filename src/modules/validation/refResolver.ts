import type { SchemaGraphNodeInterface } from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import { SchemaGraph } from '../graph/schemaGraph.js';

export interface ResolvedRefInterface {
  readonly 'graph': SchemaGraphInterface;
  readonly 'node': SchemaGraphNodeInterface;
}

export class RefResolver {
  static resolve(
    ref: string,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined
  ): ResolvedRefInterface | undefined {
    if (ref.startsWith('#')) {
      try {
        return {
          graph,
          'node': graph.resolveFragment(ref.slice(1))
        };
      } catch {
        return undefined;
      }
    }

    const hashIndex = ref.indexOf('#');
    const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
    const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
    const refSchema = lookupSchema?.(schemaId);

    if (refSchema === undefined) {
      return undefined;
    }

    const refGraph = new SchemaGraph(refSchema);

    if (fragment !== '' && fragment !== '/') {
      try {
        return {
          'graph': refGraph,
          'node': refGraph.resolveFragment(fragment)
        };
      } catch {
        return undefined;
      }
    }

    return {
      'graph': refGraph,
      'node': refGraph.rootNode
    };
  }
}
