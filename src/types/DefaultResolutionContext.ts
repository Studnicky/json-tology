import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntry.js';
import type { RefTargetType } from './RefTarget.js';

export type DefaultResolutionContextType = {
  readonly 'resolveDynamicRef': (
    ref: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ) => RefTargetType;
  readonly 'resolveRef': (
    ref: string,
    currentGraph: SchemaGraphInterface
  ) => RefTargetType;
};
