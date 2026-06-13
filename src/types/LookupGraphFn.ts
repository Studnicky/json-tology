import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

/** Function that resolves a schema ID to its compiled graph, or undefined if not registered. */
export type LookupGraphFn = (schemaId: string) => SchemaGraphInterface | undefined;
