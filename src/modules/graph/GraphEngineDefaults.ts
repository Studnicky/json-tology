import type {
  SchemaGraphNodeType,
  SchemaGraphSemanticsType
} from '../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import { GraphEngineSupport } from './GraphEngineSupport.js';
import type { DynamicScopeEntryType } from '../../types/DynamicScopeEntryType.js';
import type { DefaultResolutionContextType } from '../../types/DefaultResolutionContextType.js';
import { MAXIMUM_DEFAULT_DEPTH } from '../../constants/NUMERIC.js';
import { DataType } from '../data/DataType.js';
import type { DefaultResolutionStateType } from '../../types/DefaultResolutionStateType.js';
import type { ReferenceTargetType } from '../../types/ReferenceTargetType.js';
import type { LookupSchemaFunctionType } from '../../types/LookupSchemaFunctionType.js';
import type { ReferenceResolutionOptionsType } from '../../types/ReferenceResolutionOptionsType.js';
import { ReferenceResolver } from './ReferenceResolver.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';

/**
 * ImplicitDefaultValue — recursively resolves a node's implicit default value,
 * including the object-tree case where the default is assembled from each
 * property's own implicit default. The two resolution steps are mutually
 * recursive, so they live as static methods on a single class.
 */
class ImplicitDefaultValue {
  /** Build an implicit default from a node's property tree, if any properties yield values. */
  static buildObject(
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
    ] of ImplicitDefaultValue.propertiesOf(sem)) {
      const childValue = ImplicitDefaultValue.create(state, childNode, depth + 1);

      if (childValue !== undefined) {
        result[key] = childValue;
        hasValue = true;
      }
    }

    return hasValue ? result : undefined;
  }

  static create(
    state: DefaultResolutionStateType,
    node: SchemaGraphNodeType,
    depth: number
  ): unknown {
    if (depth > MAXIMUM_DEFAULT_DEPTH) {
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
    const reference = sem.ref;
    const dynamicReference = sem.dynamicRef;

    if (defaultValue !== undefined) {
      return GraphEngineSupport.cloneDefault(defaultValue);
    }
    if (typeof reference === 'string') {
      const {
        'graph': rGraph, 'node': rNode
      } = state.context.resolveReference(reference, state.graph);

      return ImplicitDefaultValue.create({
        ...state,
        'graph': rGraph
      }, rNode, depth + 1);
    }
    if (typeof dynamicReference === 'string') {
      const {
        'graph': rGraph, 'node': rNode
      } = state.context.resolveDynamicReference(dynamicReference, state.graph, state.dynamicScope);

      return ImplicitDefaultValue.create({
        ...state,
        'graph': rGraph
      }, rNode, depth + 1);
    }

    const hasProperties = sem.properties.size > 0;

    if (sem.schemaTypes.includes('object') || hasProperties) {
      return ImplicitDefaultValue.buildObject(state, node, depth);
    }

    return undefined;
  }

  private static propertiesOf(sem: SchemaGraphSemanticsType): ReadonlyMap<string, SchemaGraphNodeType> {
    const result = sem.properties;

    return result;
  }
}

/**
 * ZeroValueSynthesis — builds a type-appropriate zero value from schema type
 * metadata when no explicit default/const/enum is present. The primitive,
 * allOf-merge, and top-level resolution steps are mutually recursive, so they
 * live as static methods on a single class.
 */
class ZeroValueSynthesis {
  /** Merge allOf member zero-values into a single object, or return null when no object members. */
  static allOf(
    state: DefaultResolutionStateType,
    members: readonly SchemaGraphNodeType[],
    depth: number
  ): null | Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    let hasObjectMember = false;

    for (const memberNode of members) {
      const memberValue = ZeroValueSynthesis.create(state, memberNode, depth + 1);

      if (memberValue !== null && memberValue !== undefined && DataType.isRecord(memberValue)) {
        hasObjectMember = true;

        for (const [
          key,
          memberFieldValue
        ] of Object.entries(memberValue)) {
          merged[key] = memberFieldValue;
        }
      }
    }

    return hasObjectMember ? merged : null;
  }

  static create(
    state: DefaultResolutionStateType,
    node: SchemaGraphNodeType,
    depth: number
  ): unknown {
    if (depth > MAXIMUM_DEFAULT_DEPTH) {
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
      } = state.context.resolveReference(sem.ref, state.graph);

      return ZeroValueSynthesis.create({
        ...state,
        'graph': rGraph
      }, rNode, depth + 1);
    }
    if (typeof sem.dynamicRef === 'string') {
      const {
        'graph': rGraph, 'node': rNode
      } = state.context.resolveDynamicReference(sem.dynamicRef, state.graph, state.dynamicScope);

      return ZeroValueSynthesis.create({
        ...state,
        'graph': rGraph
      }, rNode, depth + 1);
    }

    const types = sem.schemaTypes;
    const primitiveValue = ZeroValueSynthesis.primitive(types);

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
      return ZeroValueSynthesis.allOf(state, sem.allOf, depth);
    }

    // anyOf/oneOf: synthesize from the first member that yields a non-null value.
    // The same logic as allOf synthesis but we stop at the first viable member
    // because union members are alternatives, not additive constraints.
    if (sem.anyOf.length > 0) {
      for (const memberNode of sem.anyOf) {
        const memberValue = ZeroValueSynthesis.create(state, memberNode, depth + 1);

        if (memberValue !== null && memberValue !== undefined) {
          return memberValue;
        }
      }
    }

    if (sem.oneOf.length > 0) {
      for (const memberNode of sem.oneOf) {
        const memberValue = ZeroValueSynthesis.create(state, memberNode, depth + 1);

        if (memberValue !== null && memberValue !== undefined) {
          return memberValue;
        }
      }
    }

    return null;
  }

  /** Resolve zero-value for primitive schema types. Returns a sentinel undefined when type is unknown. */
  static primitive(types: readonly string[]): unknown {
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
}

/**
 * DynamicReferenceResolverContext — a DefaultResolutionContextType backed by a real
 * class instance rather than a per-call object literal of closures, so its
 * methods are ordinary class methods (not dispatch-map function values
 * reallocated on every `CompilerDefaultContext.build` call).
 */
class DynamicReferenceResolverContext implements DefaultResolutionContextType {
  readonly #referenceOptions: ReferenceResolutionOptionsType;

  constructor(referenceOptions: ReferenceResolutionOptionsType) {
    this.#referenceOptions = referenceOptions;
  }

  resolveDynamicReference(
    dynamicReference: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ): ReferenceTargetType {
    const resolved = ReferenceResolver.resolve(dynamicReference, currentGraph, this.#referenceOptions);

    if (resolved === undefined) {
      // observability: throw is surfaced to caller (SchemaCompiler.compile → GraphEngineDefaults)
      throw new GraphError(
        `Cannot resolve $dynamicRef '${dynamicReference}' — schema not found`,
        {
          'code': GRAPH_ERROR_CODE.REF_NOT_FOUND,
          'pointer': dynamicReference
        }
      );
    }

    // Mirror the dynamic scope walk from resolveDynamicRefTarget in SchemaCompilerPlan.
    const fragment = GraphEngineSupport.extractNamedFragment(dynamicReference);
    const resolvedSem = resolved.graph.semantics(resolved.node);
    const resolvedAnchor = resolvedSem.dynamicAnchor;

    if (fragment === undefined || resolvedAnchor !== fragment) {
      return resolved;
    }

    for (const entry of dynamicScope) {
      if (entry.anchor === fragment) {
        return {
          'graph': entry.graph,
          'node': entry.node
        };
      }
    }

    return resolved;
  }

  resolveReference(reference: string, currentGraph: SchemaGraphInterface): ReferenceTargetType {
    const resolved = ReferenceResolver.resolve(reference, currentGraph, this.#referenceOptions);

    if (resolved === undefined) {
      // observability: throw is surfaced to caller (SchemaCompiler.compile → GraphEngineDefaults)
      throw new GraphError(
        `Cannot resolve $ref '${reference}' — schema not found`,
        {
          'code': GRAPH_ERROR_CODE.REF_NOT_FOUND,
          'pointer': reference
        }
      );
    }

    return resolved;
  }
}

/** CompilerDefaultContext — builds a DefaultResolutionContextType from lookup callbacks. */
class CompilerDefaultContext {
  static build(
    lookupSchema: LookupSchemaFunctionType | undefined,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): DefaultResolutionContextType {
    const referenceOptions: ReferenceResolutionOptionsType = {
      ...(lookupSchema !== undefined && { 'lookupSchema': lookupSchema }),
      ...(lookupGraph !== undefined && { 'lookupGraph': lookupGraph })
    };

    return new DynamicReferenceResolverContext(referenceOptions);
  }
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
    const result = ImplicitDefaultValue.create({
      context,
      dynamicScope,
      graph,
      'visited': new Set<string>()
    }, node, 0);

    return result;
  },

  createImplicitDefaultValueForLookups(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookupSchema: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph: ((id: string) => SchemaGraphInterface | undefined) | undefined,
    visited: Set<string>
  ): unknown {
    const context = CompilerDefaultContext.build(lookupSchema, lookupGraph);

    return ImplicitDefaultValue.create({
      context,
      'dynamicScope': [],
      graph,
      visited
    }, node, 0);
  },

  createImplicitDefaultValueSeeded(
    context: DefaultResolutionContextType,
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[],
    visited: Set<string>
  ): unknown {
    const result = ImplicitDefaultValue.create({
      context,
      dynamicScope,
      graph,
      visited
    }, node, 0);

    return result;
  },

  synthesizeZeroValue(
    context: DefaultResolutionContextType,
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ): unknown {
    const result = ZeroValueSynthesis.create({
      context,
      dynamicScope,
      graph,
      'visited': new Set<string>()
    }, node, 0);

    return result;
  },

  synthesizeZeroValueForLookups(
    node: SchemaGraphNodeType,
    graph: SchemaGraphInterface,
    lookup: ((id: string) => Record<string, unknown> | undefined) | undefined,
    lookupGraph?: (id: string) => SchemaGraphInterface | undefined
  ): unknown {
    const context = CompilerDefaultContext.build(lookup, lookupGraph);

    return ZeroValueSynthesis.create({
      context,
      'dynamicScope': [],
      graph,
      'visited': new Set<string>()
    }, node, 0);
  }
} as const;
