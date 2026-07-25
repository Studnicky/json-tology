import type { SchemaWithIdType } from '../types/SchemaWithIdType.js';

/**
 * Contract for synthesizing a default instance from a registered schema.
 *
 * The registry depends on this abstraction (not on the concrete `Materializer`)
 * so the onion layering holds: `registry` does not import the higher
 * `materialization` layer. The facade (`JsonTology`) wires a `Materializer` in
 * as the concrete creator.
 */
export interface DefaultCreatorInterface {
  createDefault(schema: SchemaWithIdType): unknown;
}
