import type { SchemaGraphNodeInterface } from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import { isRecord } from '../data/DataTypes.js';
import { SchemaGraph } from '../graph/SchemaGraph.js';

export function resolveImplicitDefaultValue(
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
  visited: Set<unknown>
): unknown {
  if (!isRecord(node.schema)) {
    return undefined;
  }

  if (visited.has(node.schema)) {
    return undefined;
  }
  visited.add(node.schema);

  const sem = graph.semantics(node);

  if (sem.hasDefault) {
    return structuredClone(sem.defaultValue);
  }
  if (sem.hasConst) {
    return sem.constValue;
  }

  if (sem.ref !== undefined) {
    const ref = sem.ref;

    if (ref.startsWith('#')) {
      try {
        const targetNode = graph.resolveFragment(ref.slice(1));

        return resolveImplicitDefaultValue(targetNode, graph, lookupSchema, visited);
      } catch {
        return undefined;
      }
    }

    if (lookupSchema !== undefined) {
      const hashIndex = ref.indexOf('#');
      const schemaId = hashIndex === -1 ? ref : ref.slice(0, hashIndex);
      const fragment = hashIndex === -1 ? '' : ref.slice(hashIndex + 1);
      const refSchema = lookupSchema(schemaId);

      if (refSchema !== undefined) {
        const refGraph = new SchemaGraph(refSchema);

        if (fragment !== '' && fragment !== '/') {
          try {
            const targetNode = refGraph.resolveFragment(fragment);

            return resolveImplicitDefaultValue(targetNode, refGraph, lookupSchema, visited);
          } catch {
            return undefined;
          }
        }

        return resolveImplicitDefaultValue(refGraph.rootNode, refGraph, lookupSchema, visited);
      }
    }

    return undefined;
  }

  const types = sem.schemaTypes;

  if (types.includes('object') || sem.properties.size > 0) {
    const result: Record<string, unknown> = {};
    let hasValue = false;

    for (const [
      key,
      propNode
    ] of sem.properties) {
      const childValue = resolveImplicitDefaultValue(propNode, graph, lookupSchema, new Set(visited));

      if (childValue !== undefined) {
        result[key] = childValue;
        hasValue = true;
      }
    }

    return hasValue ? result : undefined;
  }

  return undefined;
}
