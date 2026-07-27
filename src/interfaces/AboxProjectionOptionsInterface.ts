import type { SchemaGraphNodeInterface } from './SchemaGraphNodeInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';
import type { AboxOptionsInterface } from './AboxOptionsInterface.js';

/**
 * Options accepted by {@link AboxProjectorInterface.abox}.
 *
 * Extends {@link AboxOptionsInterface} with the entry node and cross-schema
 * graph lookup callback used during ABox projection.
 */
export interface AboxProjectionOptionsInterface extends AboxOptionsInterface {
  'entryNode'?: SchemaGraphNodeInterface | undefined;
  'lookupGraph'?: ((schemaId: string) => SchemaGraphInterface | undefined) | undefined;
}
