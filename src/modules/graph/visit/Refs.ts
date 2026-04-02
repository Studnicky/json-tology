import type { VisitFnType } from '../../../types/VisitFn.js';
import type { EffectiveOptionsType } from '../../../types/EffectiveOptions.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphImpl.js';
import type { DynamicScopeEntryInterface } from '../../../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../../../interfaces/InternalExecutionResult.js';
import type { VisitContextInterface } from '../../../interfaces/VisitContext.js';
import {
  schemaId
} from '../GraphEngineSupport.js';

export class Refs {
  static resolveDynamicRef(
    context: VisitContextInterface,
    dynamicRef: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultInterface {
    const refKey = `${schemaId(graph.rootSchema) ?? '<anonymous>'}::dynamic::${dynamicRef}`;

    if (refStack.has(refKey)) {
      return {
        'errors': [],
        'evaluatedItems': new Set(),
        'evaluatedProperties': new Set(),
        'valid': true,
        'value': workingValue
      };
    }

    refStack.add(refKey);
    const resolved = context.resolveDynamicRef(dynamicRef, graph, dynScope);
    const result = visitNode(
      context,
      resolved.node,
      resolved.graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth + 1
    );

    refStack.delete(refKey);

    return result;
  }

  static resolveRef(
    context: VisitContextInterface,
    ref: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryInterface[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultInterface {
    const refKey = `${schemaId(graph.rootSchema) ?? '<anonymous>'}::${ref}`;

    if (refStack.has(refKey)) {
      return {
        'errors': [],
        'evaluatedItems': new Set(),
        'evaluatedProperties': new Set(),
        'valid': true,
        'value': workingValue
      };
    }

    refStack.add(refKey);
    const resolved = context.resolveRef(ref, graph);
    const result = visitNode(
      context,
      resolved.node,
      resolved.graph,
      workingValue,
      path,
      options,
      refStack,
      dynScope,
      depth + 1
    );

    refStack.delete(refKey);

    return result;
  }
}
