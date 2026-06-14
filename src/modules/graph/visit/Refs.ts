import type { VisitFnType } from '../../../types/VisitFn.js';
import type { EffectiveOptionsType } from '../../../types/EffectiveOptions.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphImpl.js';
import type { DynamicScopeEntryType } from '../../../types/DynamicScopeEntry.js';
import type { InternalExecutionResultType } from '../../../types/InternalExecutionResult.js';
import type { VisitContextType } from '../../../types/VisitContext.js';
import { GraphEngineSupport } from '../GraphEngineSupport.js';

export class Refs {
  static resolveDynamicRef(
    context: VisitContextType,
    dynamicRef: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultType {
    const refKey = `${GraphEngineSupport.schemaId(graph.rootSchema) ?? '<anonymous>'}::dynamic::${dynamicRef}`;

    if (refStack.has(refKey)) {
      return {
        'errors': [],
        'evaluatedItems': undefined,
        'evaluatedProperties': undefined,
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
    context: VisitContextType,
    ref: string,
    graph: SchemaGraphInterface,
    workingValue: unknown,
    path: string,
    options: EffectiveOptionsType,
    refStack: Set<string>,
    dynScope: DynamicScopeEntryType[],
    depth: number,
    visitNode: VisitFnType
  ): InternalExecutionResultType {
    const refKey = `${GraphEngineSupport.schemaId(graph.rootSchema) ?? '<anonymous>'}::${ref}`;

    if (refStack.has(refKey)) {
      return {
        'errors': [],
        'evaluatedItems': undefined,
        'evaluatedProperties': undefined,
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
