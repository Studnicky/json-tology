import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { LookupSchemaFunctionType } from './LookupSchemaFunctionType.js';
import type { LoggerInterface } from '../interfaces/LoggerInterface.js';

/**
 * Options bag for the canonical `ReferenceResolution.resolve` method.
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
 * `logger` — optional logger for trace/debug diagnostics during resolution; defaults
 *   to a silent logger when omitted.
 */
export type ReferenceResolutionOptionsType = {
  'graphFor'?: (schema: Record<string, unknown>) => SchemaGraphInterface;
  'logger'?: LoggerInterface;
  'lookupGraph'?: (schemaId: string) => SchemaGraphInterface | undefined;
  'lookupSchema'?: LookupSchemaFunctionType;
  'rootId'?: string;
  'rootSchema'?: Record<string, unknown>;
};
