import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';
import type { AboxOptionsType } from './AboxOptionsType.js';
import type { SchemaGraphNodeType } from './SchemaGraph.js';

/**
 * Options accepted by {@link AboxProjectorInterface.abox}.
 *
 * Extends {@link AboxOptionsType} with the entry node and cross-schema graph
 * lookup callback used during ABox projection.
 */
export type AboxProjectionOptionsType = AboxOptionsType & {
  'entryNode'?: SchemaGraphNodeType | undefined;
  'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
};
