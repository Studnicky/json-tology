import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

export type GraphLookupType = (schema: Record<string, unknown>) => SchemaGraphInterface | undefined;
