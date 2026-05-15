import type { ResolvedRefInterface } from '../../interfaces/ResolvedRef.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';

export class RefResolver {
  static resolve(
    ref: string,
    graph: SchemaGraphInterface,
    lookupSchema?: (id: string) => Record<string, unknown> | undefined,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
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

    const refGraph = lookupGraph?.(schemaId) ?? ((): SchemaGraphInterface | undefined => {
      const refSchema = lookupSchema?.(schemaId);

      return refSchema === undefined ? undefined : new SchemaGraph(refSchema);
    })();

    if (refGraph === undefined) {
      return undefined;
    }

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
