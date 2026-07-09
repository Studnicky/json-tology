import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { DynamicScopeEntryType } from './DynamicScopeEntryType.js';
import type { DefaultResolutionContextType } from './DefaultResolutionContextType.js';

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
  'context': DefaultResolutionContextType;
  'dynamicScope': DynamicScopeEntryType[];
  'graph': SchemaGraphInterface;
  'visited': Set<string>;
};
