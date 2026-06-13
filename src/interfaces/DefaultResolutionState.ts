import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { DynamicScopeEntryInterface } from './DynamicScopeEntry.js';
import type { DefaultResolutionContextInterface } from './DefaultResolutionContext.js';

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
  readonly 'context': DefaultResolutionContextInterface;
  readonly 'dynamicScope': DynamicScopeEntryInterface[];
  readonly 'graph': SchemaGraphInterface;
  readonly 'visited': Set<string>;
}
