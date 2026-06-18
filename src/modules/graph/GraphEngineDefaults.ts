import type {
  SchemaGraphNodeType,
  SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import type { DynamicScopeEntryType } from '../../types/DynamicScopeEntryType.js';
import type { DefaultResolutionContextType } from '../../types/DefaultResolutionContextType.js';
import { MAX_DEFAULT_DEPTH } from '../../constants/NUMERIC.js';
import type { DefaultResolutionStateType } from '../../types/DefaultResolutionStateType.js';

function propertiesFromSemantics(sem: SchemaGraphSemanticsType): ReadonlyMap<string, SchemaGraphNodeType> {
  return sem.properties;
}

/** Build an implicit default from a node's property tree, if any properties yield values. */
function buildImplicitObjectDefault(
  state: DefaultResolutionStateType,
  node: SchemaGraphNodeType,
  depth: number
): Record<string, unknown> | undefined {
  const sem = state.graph.semantics(node);
  const result: Record<string, unknown> = {};
  let hasValue = false;

  for (const [
    key,
    childNode
  ] of propertiesFromSemantics(sem)) {
    const childValue = createImplicitDefaultValueInternal(state, childNode, depth + 1);

    if (childValue !== undefined) {
      result[key] = childValue;
      hasValue = true;
    }
  }

  return hasValue ? result : undefined;
}

function createImplicitDefaultValueInternal(
  state: DefaultResolutionStateType,
  node: SchemaGraphNodeType,
  depth: number
): unknown {
  if (depth > MAX_DEFAULT_DEPTH) {
    return undefined;
  }

  if (typeof node.schema === 'boolean') {
    return undefined;
  }

  if (state.visited.has(node.id)) {
    return undefined;
  }
  state.visited.add(node.id);

  const sem = state.graph.semantics(node);
  const defaultValue = sem.hasDefault ? sem.defaultValue : undefined;
  const ref = sem.ref;
  const dynamicRef = sem.dynamicRef;

  if (defaultValue !== undefined) {
    return GraphEngineSupport.cloneDefault(defaultValue);
  }
  if (typeof ref === 'string') {
    const {
      'graph': rGraph, 'node': rNode
    } = state.context.resolveRef(ref, state.graph);

    return createImplicitDefaultValueInternal({
      ...state,
      'graph': rGraph
    }, rNode, depth + 1);
  }
  if (typeof dynamicRef === 'string') {
    const {
      'graph': rGraph, 'node': rNode
    } = state.context.resolveDynamicRef(dynamicRef, state.graph, state.dynamicScope);

    return createImplicitDefaultValueInternal({
      ...state,
      'graph': rGraph
    }, rNode, depth + 1);
  }

  const hasProperties = sem.properties.size > 0;

  if (sem.schemaTypes.includes('object') || hasProperties) {
    return buildImplicitObjectDefault(state, node, depth);
  }

  return undefined;
}

/** Resolve zero-value for primitive schema types. Returns a sentinel undefined when type is unknown. */
function synthesizePrimitiveZeroValue(types: readonly string[]): unknown {
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
  if (types.includes('object')) {
    return {};
  }

  return undefined;
}

/** Merge allOf member zero-values into a single object, or return null when no object members. */
function synthesizeAllOfZeroValue(
  state: DefaultResolutionStateType,
  allOf: readonly SchemaGraphNodeType[],
  depth: number
): null | Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  let hasObjectMember = false;

  for (const memberNode of allOf) {
    const memberValue = synthesizeZeroValueInternal(state, memberNode, depth + 1);

    if (memberValue !== null && memberValue !== undefined && typeof memberValue === 'object' && !Array.isArray(memberValue)) {
      hasObjectMember = true;

      for (const [
        key,
        val
      ] of Object.entries(memberValue as Record<string, unknown>)) {
        merged[key] = val;
      }
    }
  }

  return hasObjectMember ? merged : null;
}

function synthesizeZeroValueInternal(
  state: DefaultResolutionStateType,
  node: SchemaGraphNodeType,
  depth: number
): unknown {
  if (depth > MAX_DEFAULT_DEPTH) {
    return undefined;
  }

  if (typeof node.schema === 'boolean') {
    return null;
  }

  if (state.visited.has(node.id)) {
    return undefined;
  }
  state.visited.add(node.id);

  const sem = state.graph.semantics(node);

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
    const {
      'graph': rGraph, 'node': rNode
    } = state.context.resolveRef(sem.ref, state.graph);

    return synthesizeZeroValueInternal({
      ...state,
      'graph': rGraph
    }, rNode, depth + 1);
  }
  if (typeof sem.dynamicRef === 'string') {
    const {
      'graph': rGraph, 'node': rNode
    } = state.context.resolveDynamicRef(sem.dynamicRef, state.graph, state.dynamicScope);

    return synthesizeZeroValueInternal({
      ...state,
      'graph': rGraph
    }, rNode, depth + 1);
  }

  const types = sem.schemaTypes;
  const primitiveValue = synthesizePrimitiveZeroValue(types);

  if (primitiveValue !== undefined) {
    return primitiveValue;
  }

  if (sem.properties.size > 0) {
    return {};
  }

  // allOf-composed schema: no own type/properties but has allOf members.
  // Synthesize each member and merge — later members override earlier on key
  // conflict (in practice keys are disjoint). Handles Compose.subClassOf and
  // Compose.extend wire shapes whose top-level carries only { $id, allOf }.
  if (sem.allOf.length > 0) {
    return synthesizeAllOfZeroValue(state, sem.allOf, depth);
  }

  // anyOf/oneOf: synthesize from the first member that yields a non-null value.
  // The same logic as allOf synthesis but we stop at the first viable member
  // because union members are alternatives, not additive constraints.
  if (sem.anyOf.length > 0) {
    for (const memberNode of sem.anyOf) {
      const memberValue = synthesizeZeroValueInternal(state, memberNode, depth + 1);

      if (memberValue !== null && memberValue !== undefined) {
        return memberValue;
      }
    }
  }

  if (sem.oneOf.length > 0) {
    for (const memberNode of sem.oneOf) {
      const memberValue = synthesizeZeroValueInternal(state, memberNode, depth + 1);

      if (memberValue !== null && memberValue !== undefined) {
        return memberValue;
      }
    }
  }

  return null;
}

/**
 * Default value resolution and zero-value synthesis for the graph engine.
 *
 * @remarks
 * Provides two resolution strategies: `createImplicitDefaultValue` walks a node's
 * property tree collecting authored `default` values; `synthesizeZeroValue` builds
 * a type-appropriate zero value from the schema type metadata when no explicit
 * default is present. Both strategies are cycle-safe via a visited-set guard and
 * honour `$ref` / `$dynamicRef` resolution.
 *
 * @example
 * ```ts
 * const defaultValue = GraphEngineDefaults.createImplicitDefaultValue(ctx, node, graph, []);
 * const zeroValue    = GraphEngineDefaults.synthesizeZeroValue(ctx, node, graph, []);
 * ```
 *
 * @category Graph
 * @since 0.1.0
 * @see {@link GraphEngine}
 * @group Graph
 */
export const GraphEngineDefaults = {
  createImplicitDefaultValue(
    context: DefaultResolutionContextType,
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ): unknown {
    return createImplicitDefaultValueInternal({
      context,
      dynamicScope,
      graph,
      'visited': new Set<string>()
    }, node, 0);
  },

  createImplicitDefaultValueSeeded(
    context: DefaultResolutionContextType,
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[],
    visited: Set<string>
  ): unknown {
    return createImplicitDefaultValueInternal({
      context,
      dynamicScope,
      graph,
      visited
    }, node, 0);
  },

  synthesizeZeroValue(
    context: DefaultResolutionContextType,
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ): unknown {
    return synthesizeZeroValueInternal({
      context,
      dynamicScope,
      graph,
      'visited': new Set<string>()
    }, node, 0);
  }
} as const;
