import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntryType.js';
import type { ReferenceTargetType } from './ReferenceTargetType.js';
import type { IdentityType } from './IdentityType.js';

export type DefaultResolutionContextType = IdentityType<{
  'resolveDynamicReference': (
    reference: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryType[]
  ) => ReferenceTargetType;
  'resolveReference': (
    reference: string,
    currentGraph: SchemaGraphInterface
  ) => ReferenceTargetType;
}>;
