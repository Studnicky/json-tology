import type { SchemaCompilerCheckExecutionContextInterface } from './SchemaCompilerCheckExecutionContext.js';
import type { FormatRegistryInterface } from './FormatRegistry.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

/** Bundled graph-traversal context for node-check builder helpers. */
export interface NodeCheckBuildContextType {
  'context': SchemaCompilerCheckExecutionContextInterface;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupSchema': ((id: string) => Record<string, unknown> | undefined) | undefined;
}
