import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { DynamicScopeEntryInterface } from './DynamicScopeEntryInterface.js';
import type { DefaultResolutionContextInterface } from './DefaultResolutionContextInterface.js';

/**
 * Shared context threaded through recursive default-resolution calls.
 *
 * @remarks
 * Distinct from {@link DefaultResolutionContextInterface}, which is the public
 * resolver contract. This is the private internal state bundle used by
 * {@link GraphEngineDefaults} to track visited nodes and dynamic scope across
 * recursive calls.
 *
 * @internal
 */
export interface DefaultResolutionStateInterface {
  'context': DefaultResolutionContextInterface;
  'dynamicScope': DynamicScopeEntryInterface[];
  'graph': SchemaGraphInterface;
  'visited': Set<string>;
}
