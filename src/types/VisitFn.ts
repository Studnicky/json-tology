import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { EffectiveOptionsType } from './EffectiveOptions.js';
import type { DynamicScopeEntryType } from '../types/DynamicScopeEntry.js';
import type { InternalExecutionResultType } from '../types/InternalExecutionResult.js';
import type { VisitContextType } from '../types/VisitContext.js';

export type VisitFnType = (
  context: VisitContextType,
  node: SchemaGraphNodeType,
  graph: SchemaGraphInterface,
  value: unknown,
  path: string,
  options: EffectiveOptionsType,
  refStack: Set<string>,
  dynamicScope: DynamicScopeEntryType[],
  depth: number
) => InternalExecutionResultType;
