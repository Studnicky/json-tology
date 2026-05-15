import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

export type GraphLookupType = (schema: Record<string, unknown>) => SchemaGraphInterface | undefined;
