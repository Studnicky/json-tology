import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { DynamicScopeEntryInterface } from './DynamicScopeEntry.js';
import type { RefTargetInterface } from './RefTarget.js';

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
