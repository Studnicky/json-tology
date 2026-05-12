import type {
  SchemaGraphNodeInterface,
  SchemaGraphSemanticsInterface
} from '../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphImpl.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import type { DynamicScopeEntryInterface } from '../../interfaces/DynamicScopeEntry.js';
import type { DefaultResolutionContextInterface } from '../../interfaces/DefaultResolutionContext.js';
import { MAX_DEFAULT_DEPTH } from '../../constants/NUMERIC.js';

function propertiesFromSemantics(sem: SchemaGraphSemanticsInterface): Map<string, SchemaGraphNodeInterface> {
  return sem.properties;
}

export const GraphEngineDefaults = {
  createImplicitDefaultValue(
    context: DefaultResolutionContextInterface,
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[],
    visited = new Set<string>(),
    depth = 0
  ): unknown {
    if (depth > MAX_DEFAULT_DEPTH) {
      return undefined;
    }

    if (typeof node.schema === 'boolean') {
      return undefined;
    }

    if (visited.has(node.id)) {
      return undefined;
    }
    visited.add(node.id);

    const sem = graph.semantics(node);
    const defaultValue = sem.hasDefault ? sem.defaultValue : undefined;
    const ref = sem.ref;
    const dynamicRef = sem.dynamicRef;

    if (defaultValue !== undefined) {
      return GraphEngineSupport.cloneDefault(defaultValue);
    }
    if (typeof ref === 'string') {
      const {
        'graph': rGraph, 'node': rNode
      } = context.resolveRef(ref, graph);

      return GraphEngineDefaults.createImplicitDefaultValue(context, rNode, rGraph, dynamicScope, visited, depth + 1);
    }
    if (typeof dynamicRef === 'string') {
      const {
        'graph': rGraph, 'node': rNode
      } = context.resolveDynamicRef(dynamicRef, graph, dynamicScope);

      return GraphEngineDefaults.createImplicitDefaultValue(context, rNode, rGraph, dynamicScope, visited, depth + 1);
    }

    const hasProperties = sem.properties.size > 0;

    if (sem.schemaTypes.includes('object') || hasProperties) {
      const result: Record<string, unknown> = {};
      let hasValue = false;

      for (const [
        key,
        childNode
      ] of propertiesFromSemantics(sem)) {
        const childValue = GraphEngineDefaults.createImplicitDefaultValue(
          context,
          childNode,
          graph,
          dynamicScope,
          visited,
          depth + 1
        );

        if (childValue !== undefined) {
          result[key] = childValue;
          hasValue = true;
        }
      }

      return hasValue ? result : undefined;
    }

    return undefined;
  },

  synthesizeZeroValue(
    context: DefaultResolutionContextInterface,
    node: SchemaGraphNodeInterface,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[],
    visited = new Set<string>(),
    depth = 0
  ): unknown {
    if (depth > MAX_DEFAULT_DEPTH) {
      return undefined;
    }

    if (typeof node.schema === 'boolean') {
      return null;
    }

    if (visited.has(node.id)) {
      return undefined;
    }
    visited.add(node.id);

    const sem = graph.semantics(node);

    if (sem.hasDefault) {
      return GraphEngineSupport.cloneDefault(sem.defaultValue);
    }
    if (sem.hasConst) {
      return sem.constValue;
    }
    if (sem.enumValues !== undefined && sem.enumValues.length > 0) {
      return sem.enumValues[0];
    }

    if (typeof sem.ref === 'string') {
      const resolved = context.resolveRef(sem.ref, graph);
      const {
        'graph': rGraph, 'node': rNode
      } = resolved;

      return GraphEngineDefaults.synthesizeZeroValue(context, rNode, rGraph, dynamicScope, visited, depth + 1);
    }
    if (typeof sem.dynamicRef === 'string') {
      const resolved = context.resolveDynamicRef(sem.dynamicRef, graph, dynamicScope);
      const {
        'graph': rGraph, 'node': rNode
      } = resolved;

      return GraphEngineDefaults.synthesizeZeroValue(context, rNode, rGraph, dynamicScope, visited, depth + 1);
    }

    const types = sem.schemaTypes;

    if (types.includes('string')) {
      return '';
    }
    if (types.includes('number') || types.includes('integer')) {
      return 0;
    }
    if (types.includes('boolean')) {
      return false;
    }
    if (types.includes('null')) {
      return null;
    }
    if (types.includes('array')) {
      return [];
    }
    if (types.includes('object') || sem.properties.size > 0) {
      return {};
    }

    return null;
  }
} as const;
