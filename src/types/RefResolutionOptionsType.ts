import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFnType } from './LookupSchemaFnType.js';

/**
 * Options bag for the canonical `RefResolution.resolve` method.
 *
 * `lookupGraph` — resolve a schema ID to its pre-compiled graph (e.g. from a registry).
 * `lookupSchema` — resolve a schema ID to its raw JSON Schema object; used to construct
 *   an on-the-fly `SchemaGraph` when no pre-compiled graph is registered.
 * `graphFor` — construct (or retrieve a cached) `SchemaGraphInterface` for a given raw
 *   schema object. GraphEngine supplies its per-engine cache here; call-sites without a
 *   cache may omit this and accept `new SchemaGraph(schema)` construction on each miss.
 * `rootId` — the `$id` of the root schema at the current resolution site; when set,
 *   a ref whose parsed ID matches this value is resolved against `graphFor(rootSchema)`
 *   rather than the external registry. Mirrors the self-ref short-circuit in GraphEngine.
 * `rootSchema` — the root schema object at the current resolution site; required when
 *   `rootId` is provided or when embedded-$id fallback must walk the root graph's index.
 */
export type RefResolutionOptionsType = {
  readonly 'graphFor'?: (schema: Record<string, unknown>) => SchemaGraphInterface;
  readonly 'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  readonly 'lookupSchema'?: LookupSchemaFnType;
  readonly 'rootId'?: string;
  readonly 'rootSchema'?: Record<string, unknown>;
};
