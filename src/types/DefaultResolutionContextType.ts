import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntryType.js';
import type { RefTargetType } from './RefTargetType.js';

export type DefaultResolutionContextType = {
  'resolveDynamicRef': (
    ref: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ) => RefTargetType;
  'resolveRef': (
    ref: string,
    currentGraph: SchemaGraphInterface
  ) => RefTargetType;
};
