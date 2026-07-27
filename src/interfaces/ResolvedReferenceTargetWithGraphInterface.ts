import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

/**
 * Cached resolved target for a cross-schema `$ref` node — graph available.
 *
 * When `targetGraph` is present the walk continues into the target graph;
 * `targetNode` is always defined alongside `targetGraph`.
 */
export interface ResolvedReferenceTargetWithGraphInterface {
  'targetGraph': SchemaGraphInterface;
  'targetNode': SchemaGraphNodeInterface;
  'targetSchema': Record<string, unknown>;
}
