import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

/** Function that resolves a schema ID to its compiled graph, or undefined if not registered. */
export type LookupGraphFnType = (schemaId: string) => SchemaGraphInterface | undefined;
