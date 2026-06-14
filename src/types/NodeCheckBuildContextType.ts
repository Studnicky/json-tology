import type { SchemaCompilerCheckExecutionContextType } from './SchemaCompilerCheckExecutionContext.js';
import type { FormatRegistryInterface } from '../interfaces/FormatRegistry.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

/** Bundled graph-traversal context for node-check builder helpers. */
export type NodeCheckBuildContextType = {
  'context': SchemaCompilerCheckExecutionContextType;
  'formatRegistry': FormatRegistryInterface;
  'graph': SchemaGraphInterface;
  'lookupSchema': ((id: string) => Record<string, unknown> | undefined) | undefined;
};
