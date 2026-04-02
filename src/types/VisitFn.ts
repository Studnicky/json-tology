import type { SchemaGraphNodeInterface } from '../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { EffectiveOptionsType } from './EffectiveOptions.js';
import type { DynamicScopeEntryInterface } from '../interfaces/DynamicScopeEntry.js';
import type { InternalExecutionResultInterface } from '../interfaces/InternalExecutionResult.js';
import type { VisitContextInterface } from '../interfaces/VisitContext.js';

export type VisitFnType = (
  context: VisitContextInterface,
  node: SchemaGraphNodeInterface,
  graph: SchemaGraphInterface,
  value: unknown,
  path: string,
  options: EffectiveOptionsType,
  refStack: Set<string>,
  dynamicScope: DynamicScopeEntryInterface[],
  depth: number
) => InternalExecutionResultInterface;
