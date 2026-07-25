import type { SchemaGraphNodeType } from './SchemaGraph.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/**
 * Cached resolved target for a cross-schema `$ref` node — graph available.
 *
 * When `targetGraph` is present the walk continues into the target graph;
 * `targetNode` is always defined alongside `targetGraph`.
 */
type ResolvedReferenceTargetWithGraphType = {
  readonly 'targetGraph': SchemaGraphInterface;
  readonly 'targetNode': SchemaGraphNodeType;
  readonly 'targetSchema': Record<string, unknown>;
};

/**
 * Cached resolved target for a cross-schema `$ref` node — no graph available.
 *
 * The registry knows about the schema but cannot produce a graph for it;
 * `decodeWithSchema` is applied to the value directly.
 */
type ResolvedReferenceTargetNoGraphType = {
  readonly 'targetGraph': undefined;
  readonly 'targetNode': undefined;
  readonly 'targetSchema': Record<string, unknown>;
};

/**
 * Discriminated union of resolved `$ref` target states.
 *
 * Stored in a `WeakMap` keyed on the source node so the resolution work
 * (parseReference → resolveSchemaId → getSchema → getGraph → resolveFragment)
 * executes at most once per source node per graph instance.
 *
 * `null` is the sentinel for an unresolvable ref — stored explicitly so
 * a missing schema is not re-probed on every value walk.
 */
export type ResolvedReferenceTargetType = ResolvedReferenceTargetNoGraphType | ResolvedReferenceTargetWithGraphType;
