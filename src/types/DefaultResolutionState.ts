import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntry.js';
import type { DefaultResolutionContextType } from './DefaultResolutionContext.js';

/**
 * Shared context threaded through recursive default-resolution calls.
 *
 * @remarks
 * Distinct from {@link DefaultResolutionContextType}, which is the public
 * resolver contract. This is the private internal state bundle used by
 * {@link GraphEngineDefaults} to track visited nodes and dynamic scope across
 * recursive calls.
 *
 * @internal
 */
export type DefaultResolutionStateType = {
  readonly 'context': DefaultResolutionContextType;
  readonly 'dynamicScope': DynamicScopeEntryType[];
  readonly 'graph': SchemaGraphInterface;
  readonly 'visited': Set<string>;
};
