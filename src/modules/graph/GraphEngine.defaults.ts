import type {
  SchemaGraphNodeInterface,
  SchemaGraphSemanticsInterface
} from '../../interfaces/schema-graph.js';
import type { SchemaGraphInterface } from '../../interfaces/schema-graph-impl.js';
import {
  cloneDefault,
  type DynamicScopeEntryInterface,
  type RefTargetInterface
} from './GraphEngine.support.js';

export interface DefaultResolutionContextInterface {
  readonly 'resolveDynamicRef': (
    ref: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ) => RefTargetInterface;
  readonly 'resolveRef': (
    ref: string,
    currentGraph: SchemaGraphInterface
  ) => RefTargetInterface;
}

function propertiesFromSemantics(sem: SchemaGraphSemanticsInterface): Map<string, SchemaGraphNodeInterface> {
  return sem.properties;
}

export function createImplicitDefaultValue(
  context: DefaultResolutionContextInterface,
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  dynamicScope: DynamicScopeEntryInterface[],
  visited = new Set<string>()
): unknown {
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
    return cloneDefault(defaultValue);
  }
  if (typeof ref === 'string') {
    const resolved = context.resolveRef(ref, graph);

    return createImplicitDefaultValue(context, resolved.node, resolved.graph, dynamicScope, visited);
  }
  if (typeof dynamicRef === 'string') {
    const resolved = context.resolveDynamicRef(dynamicRef, graph, dynamicScope);

    return createImplicitDefaultValue(context, resolved.node, resolved.graph, dynamicScope, visited);
  }

  const hasProperties = sem.properties.size > 0;

  if (sem.schemaTypes.includes('object') || hasProperties) {
    const result: Record<string, unknown> = {};
    let hasValue = false;

    for (const [
      key,
      childNode
    ] of propertiesFromSemantics(sem)) {
      const childValue = createImplicitDefaultValue(context, childNode, graph, dynamicScope, visited);

      if (childValue !== undefined) {
        result[key] = childValue;
        hasValue = true;
      }
    }

    return hasValue ? result : undefined;
  }

  return undefined;
}

export function synthesizeZeroValue(
  context: DefaultResolutionContextInterface,
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  dynamicScope: DynamicScopeEntryInterface[],
  visited = new Set<string>()
): unknown {
  if (typeof node.schema === 'boolean') {
    return null;
  }

  if (visited.has(node.id)) {
    return undefined;
  }
  visited.add(node.id);

  const sem = graph.semantics(node);

  if (sem.hasDefault) {
    return cloneDefault(sem.defaultValue);
  }
  if (sem.hasConst) {
    return sem.constValue;
  }
  if (sem.enumValues !== undefined && sem.enumValues.length > 0) {
    return sem.enumValues[0];
  }

  if (typeof sem.ref === 'string') {
    const resolved = context.resolveRef(sem.ref, graph);

    return synthesizeZeroValue(context, resolved.node, resolved.graph, dynamicScope, visited);
  }
  if (typeof sem.dynamicRef === 'string') {
    const resolved = context.resolveDynamicRef(sem.dynamicRef, graph, dynamicScope);

    return synthesizeZeroValue(context, resolved.node, resolved.graph, dynamicScope, visited);
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
