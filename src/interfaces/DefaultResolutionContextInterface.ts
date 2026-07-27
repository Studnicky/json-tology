import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { DynamicScopeEntryInterface } from './DynamicScopeEntryInterface.js';
import type { ReferenceTargetInterface } from './ReferenceTargetInterface.js';

/** Public resolver contract implemented by the default `$ref` / `$dynamicRef` resolution context. */
export interface DefaultResolutionContextInterface {
  'resolveDynamicReference': (
    reference: string,
    currentGraph: SchemaGraphInterface,
    dynamicScope: DynamicScopeEntryInterface[]
  ) => ReferenceTargetInterface;
  'resolveReference': (
    reference: string,
    currentGraph: SchemaGraphInterface
  ) => ReferenceTargetInterface;
}
