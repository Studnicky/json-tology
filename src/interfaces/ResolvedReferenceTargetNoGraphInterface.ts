/**
 * Cached resolved target for a cross-schema `$ref` node — no graph available.
 *
 * The registry knows about the schema but cannot produce a graph for it;
 * `decodeWithSchema` is applied to the value directly.
 */
export interface ResolvedReferenceTargetNoGraphInterface {
  'targetGraph': undefined;
  'targetNode': undefined;
  'targetSchema': Record<string, unknown>;
}
